using VioletCode.SharedKernel.Time;

namespace VioletCode.Modules.Scheduling.Domain;

public sealed record AppointmentDateCount(DateOnly Date, int Count);

public sealed record AgendaSummary(int Today, DateTimeOffset? NextAt, string? NextCaseFolio, IReadOnlyList<AppointmentDateCount> ByDate);

/// <summary>Rango de consulta ya convertido a UTC: [FromUtc, ToUtc).</summary>
public readonly record struct AgendaRange(DateTimeOffset FromUtc, DateTimeOffset ToUtc);

/// <summary>Reglas de la agenda. Lógica pura (sin EF) para poder probarla.</summary>
public static class AgendaCalculator
{
    /// <summary>
    /// Convierte fechas locales (Los Mochis) a un rango UTC. Sin fechas = hoy. "to" es inclusivo (día completo).
    /// Si "to" es anterior a "from" se usa solo el día de "from".
    /// </summary>
    public static AgendaRange ResolveRange(DateOnly? from, DateOnly? to, DateTimeOffset now)
    {
        var start = from ?? LocalClock.Today(now);
        var end = to ?? start;
        if (end < start) end = start;
        return new AgendaRange(LocalClock.StartOfDayUtc(start), LocalClock.StartOfDayUtc(end.AddDays(1)));
    }

    /// <summary>
    /// "Hoy" y las fechas del mes se calculan en hora local. Las citas canceladas no cuentan.
    /// <c>Next</c> = la siguiente cita programada a partir de ahora (de cualquier día).
    /// </summary>
    public static AgendaSummary Summarize(IEnumerable<Appointment> appointments, DateTimeOffset now)
    {
        var live = appointments.Where(a => a.Status != AppointmentStatus.Cancelled).ToList();
        var today = LocalClock.Today(now);

        var next = live
            .Where(a => a.Status == AppointmentStatus.Scheduled && a.StartsAt >= now)
            .OrderBy(a => a.StartsAt)
            .FirstOrDefault();

        var byDate = live
            .GroupBy(a => LocalClock.ToLocalDate(a.StartsAt))
            .Where(g => g.Key.Year == today.Year && g.Key.Month == today.Month)
            .OrderBy(g => g.Key)
            .Select(g => new AppointmentDateCount(g.Key, g.Count()))
            .ToList();

        return new AgendaSummary(
            Today: live.Count(a => LocalClock.ToLocalDate(a.StartsAt) == today),
            NextAt: next?.StartsAt,
            NextCaseFolio: next?.CaseFolio,
            ByDate: byDate);
    }
}
