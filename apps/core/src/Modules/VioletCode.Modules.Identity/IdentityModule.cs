using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.Modules.Identity.Domain;
using VioletCode.Modules.Identity.Endpoints;
using VioletCode.Modules.Identity.Infrastructure;
using VioletCode.SharedKernel;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Identity;

/// <summary>
/// Autenticación del personal (correo + contraseña → JWT de 15 min + refresh rotativo en cookie httpOnly).
/// Pendiente: cuentas de usuaria (OTP / anónimo, D-02) y 2FA para supervisión.
/// </summary>
public sealed class IdentityModule : IModule
{
    public string Name => "identity";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<StaffIdentityDbContext>(configuration, StaffIdentityDbContext.Schema);
        services.AddSingleton<IPasswordHasher<StaffUser>, PasswordHasher<StaffUser>>();
        services.AddSingleton<TokenService>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => AuthEndpoints.Map(endpoints);

    public async Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<StaffIdentityDbContext>();
        await db.Database.MigrateAsync(ct);

        if (!seedSyntheticData || await db.Users.AnyAsync(ct)) return;

        var password = sp.GetRequiredService<IConfiguration>()["Identity:DemoPassword"];
        if (string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Para sembrar cuentas de demostración define Identity:DemoPassword.");

        db.Users.AddRange(SyntheticStaff.Create(sp.GetRequiredService<IPasswordHasher<StaffUser>>(), password));
        await db.SaveChangesAsync(ct);
    }
}
