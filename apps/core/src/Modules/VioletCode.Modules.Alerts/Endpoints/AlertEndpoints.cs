using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Alerts.Domain;
using VioletCode.Modules.Alerts.Infrastructure;
using VioletCode.SharedKernel.Time;

namespace VioletCode.Modules.Alerts.Endpoints;

public sealed record AlertDto(
    Guid Id, string Folio, DateTimeOffset CreatedAt, AlertStatus Status, AlertPriority Priority,
    AlertChannel Channel, string Colonia, string? AssignedToName);

public sealed record AlertSummaryDto(int Active, int NewToday, int InProgress, int ClosedThisWeek, IReadOnlyList<AlertDayCount> ByDay);

internal static class AlertEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("").WithTags("Alertas").RequireAuthorization();

        g.MapGet("/", async (AlertStatus? status, int? take, AlertsDbContext db, CancellationToken ct) =>
            {
                var q = db.Alerts.AsNoTracking().AsQueryable();
                // Sin filtro: alertas activas (nuevas + en atención).
                q = status is null ? q.Where(a => a.Status != AlertStatus.Closed) : q.Where(a => a.Status == status);

                return await q
                    .OrderBy(a => a.Priority == AlertPriority.High ? 0 : a.Priority == AlertPriority.Medium ? 1 : 2)
                    .ThenByDescending(a => a.CreatedAt)
                    .Take(Math.Clamp(take ?? 20, 1, 100))
                    .Select(a => new AlertDto(a.Id, a.Folio, a.CreatedAt, a.Status, a.Priority, a.Channel, a.Colonia, a.AssignedToName))
                    .ToListAsync(ct);
            })
            .WithName("ListAlerts")
            .WithSummary("Alertas por prioridad y fecha. Sin 'status': nuevas + en atención.");

        g.MapGet("/summary", async (AlertsDbContext db, TimeProvider clock, CancellationToken ct) =>
            {
                var now = clock.GetUtcNow();
                var weekStart = LocalClock.StartOfDayUtc(LocalClock.Today(now).AddDays(-(AlertSummaryCalculator.DaysInChart - 1)));

                // Solo lo que el resumen necesita: activas + lo creado o cerrado en la ventana de 7 días.
                var alerts = await db.Alerts.AsNoTracking()
                    .Where(a => a.Status != AlertStatus.Closed || a.CreatedAt >= weekStart || a.ClosedAt >= weekStart)
                    .ToListAsync(ct);

                var s = AlertSummaryCalculator.Compute(alerts, now);
                return new AlertSummaryDto(s.Active, s.NewToday, s.InProgress, s.ClosedThisWeek, s.ByDay);
            })
            .WithName("AlertsSummary");
    }
}
