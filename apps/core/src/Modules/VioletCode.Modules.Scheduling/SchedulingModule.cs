using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.Modules.Scheduling.Endpoints;
using VioletCode.Modules.Scheduling.Infrastructure;
using VioletCode.SharedKernel;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Scheduling;

/// <summary>
/// Agenda de citas: consulta por rango de fechas y resumen para el tablero.
/// Pendiente: crear/reprogramar/cancelar citas y recordatorios (módulo Notifications).
/// </summary>
public sealed class SchedulingModule : IModule
{
    public string Name => "scheduling";

    public void Register(IServiceCollection services, IConfiguration configuration) =>
        services.AddModuleDbContext<SchedulingDbContext>(configuration, SchedulingDbContext.Schema);

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => SchedulingEndpoints.Map(endpoints);

    public async Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SchedulingDbContext>();
        await db.Database.MigrateAsync(ct);

        if (seedSyntheticData && !await db.Appointments.AnyAsync(ct))
        {
            db.Appointments.AddRange(SyntheticSeed.Appointments(scope.ServiceProvider.GetRequiredService<TimeProvider>().GetUtcNow()));
            await db.SaveChangesAsync(ct);
        }
    }
}
