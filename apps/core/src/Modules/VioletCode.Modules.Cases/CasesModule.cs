using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.Modules.Cases.Endpoints;
using VioletCode.Modules.Cases.Infrastructure;
using VioletCode.SharedKernel;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Cases;

/// <summary>
/// Expedientes (solo alias de las usuarias): listado por riesgo y resumen para el tablero.
/// Pendiente: solicitudes, intervenciones, canalizaciones y seguimiento; campos sensibles cifrados.
/// </summary>
public sealed class CasesModule : IModule
{
    public string Name => "cases";

    public void Register(IServiceCollection services, IConfiguration configuration) =>
        services.AddModuleDbContext<CasesDbContext>(configuration, CasesDbContext.Schema);

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => CaseEndpoints.Map(endpoints);

    public async Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CasesDbContext>();
        await db.Database.MigrateAsync(ct);

        if (seedSyntheticData && !await db.CaseFiles.AnyAsync(ct))
        {
            db.CaseFiles.AddRange(SyntheticSeed.Cases(scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow()));
            await db.SaveChangesAsync(ct);
        }
    }
}
