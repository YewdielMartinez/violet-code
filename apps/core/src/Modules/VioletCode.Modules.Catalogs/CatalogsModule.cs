using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.Modules.Catalogs.Endpoints;
using VioletCode.Modules.Catalogs.Infrastructure;
using VioletCode.SharedKernel;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Catalogs;

/// <summary>
/// MÓDULO DE REFERENCIA. Copiar esta estructura en los demás módulos:
///   Domain/          entidades y reglas (sin dependencias de infraestructura)
///   Infrastructure/  DbContext con schema propio y seeds sintéticos
///   Endpoints/       Minimal APIs del módulo
/// </summary>
public sealed class CatalogsModule : IModule
{
    public string Name => "catalogs";

    public void Register(IServiceCollection services, IConfiguration configuration) =>
        services.AddModuleDbContext<CatalogsDbContext>(configuration, CatalogsDbContext.Schema);

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => DirectoryEndpoints.Map(endpoints);

    public async Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CatalogsDbContext>();
        await db.Database.MigrateAsync(ct);

        if (seedSyntheticData && !await db.DirectoryEntries.AnyAsync(ct))
        {
            db.DirectoryEntries.AddRange(SyntheticSeed.Entries());
            await db.SaveChangesAsync(ct);
        }
    }
}
