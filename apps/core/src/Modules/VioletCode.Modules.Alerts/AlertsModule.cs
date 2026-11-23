using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.Modules.Alerts.Endpoints;
using VioletCode.Modules.Alerts.Infrastructure;
using VioletCode.SharedKernel;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Alerts;

/// <summary>
/// Alertas de auxilio: listado por prioridad y resumen para el tablero.
/// Pendiente: recibir alerta + ubicación y aviso en tiempo real a Admin (SignalR).
/// </summary>
public sealed class AlertsModule : IModule
{
    public string Name => "alerts";

    public void Register(IServiceCollection services, IConfiguration configuration) =>
        services.AddModuleDbContext<AlertsDbContext>(configuration, AlertsDbContext.Schema);

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => AlertEndpoints.Map(endpoints);

    public async Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AlertsDbContext>();
        await db.Database.MigrateAsync(ct);

        if (seedSyntheticData && !await db.Alerts.AnyAsync(ct))
        {
            db.Alerts.AddRange(SyntheticSeed.Alerts(scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow()));
            await db.SaveChangesAsync(ct);
        }
    }
}
