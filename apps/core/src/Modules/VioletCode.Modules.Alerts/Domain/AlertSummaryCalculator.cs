using VioletCode.SharedKernel.Time;

namespace VioletCode.Modules.Alerts.Domain;

public sealed record AlertDayCount(DateOnly Date, int Count);

public sealed record AlertSummary(int Active, int NewToday, int InProgress, int ClosedThisWeek, IReadOnlyList<AlertDayCount> ByDay);

/// <summary>Agregaciones del tablero de alertas. Lógica pura (sin EF) para poder probarla.</summary>
public static class AlertSummaryCalculator
{
    public const int DaysInChart = 7;

    /// <summary>
    /// "Hoy" y "esta semana" (los últimos 7 días, hoy incluido) se calculan en hora local de Los Mochis.
    /// <c>NewToday</c> = alertas creadas hoy. <c>ByDay</c> = alertas creadas por día, con ceros incluidos.
    /// </summary>
    public static AlertSummary Compute(IEnumerable<Alert> alerts, DateTimeOffset now)
    {
        var list = alerts as IReadOnlyCollection<Alert> ?? alerts.ToList();
        var today = LocalClock.Today(now);
        var firstDay = today.AddDays(-(DaysInChart - 1));

        var createdPerDay = list
            .GroupBy(a => LocalClock.ToLocalDate(a.CreatedAt))
            .ToDictionary(g => g.Key, g => g.Count());

        var byDay = Enumerable.Range(0, DaysInChart)
            .Select(i => firstDay.AddDays(i))
            .Select(d => new AlertDayCount(d, createdPerDay.GetValueOrDefault(d)))
            .ToList();

        return new AlertSummary(
            Active: list.Count(a => a.IsActive),
            NewToday: createdPerDay.GetValueOrDefault(today),
            InProgress: list.Count(a => a.Status == AlertStatus.InProgress),
            ClosedThisWeek: list.Count(a => a.Status == AlertStatus.Closed
                                            && a.ClosedAt is { } closed
                                            && LocalClock.ToLocalDate(closed) >= firstDay),
            ByDay: byDay);
    }
}
