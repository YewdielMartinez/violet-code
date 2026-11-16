using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.Modules.Audit.Endpoints;
using VioletCode.Modules.Audit.Infrastructure;
using VioletCode.SharedKernel;
using VioletCode.SharedKernel.Auditing;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Audit;

/// <summary>Bitácora append-only de lecturas y cambios. Los demás módulos solo ven IAuditLog.</summary>
public sealed class AuditModule : IModule
{
    public string Name => "audit";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<AuditDbContext>(configuration, AuditDbContext.Schema);
        services.AddScoped<IAuditLog, AuditLog>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => AuditEndpoints.Map(endpoints);

    public async Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AuditDbContext>().Database.MigrateAsync(ct);
    }
}
