using VioletCode.Modules.Alerts.Domain;
using VioletCode.SharedKernel.Time;

namespace VioletCode.Modules.Alerts.Infrastructure;

/// <summary>
/// DATOS SINTÉTICOS y deterministas (semilla fija). Fechas relativas a "ahora" para que el tablero siempre se vea vivo.
/// Solo nombres públicos de colonias/sindicaturas de Ahome; el personal asignado son las cuentas "X Demo".
/// </summary>
internal static class SyntheticSeed
{
    private static readonly string[] Colonias =
    [
        "Centro", "Jiquilpan", "Scally", "Las Fuentes", "Bachomobampo", "Flores Magón",
        "Sindicatura Higuera de Zaragoza", "Sindicatura Ahome", "Sindicatura Topolobampo", "Sindicatura Juan José Ríos",
    ];

    private static readonly string[] Staff = ["Paula Demo", "Julia Demo", "Carla Demo"];

    public static IEnumerable<Alert> Alerts(DateTimeOffset now)
    {
        var rnd = new Random(2026);
        var drafts = new List<(DateTimeOffset At, AlertStatus Status)>();

        // 4 nuevas hoy, 5 en atención (hoy/ayer) y 31 cerradas en los últimos 14 días.
        var minutesToday = (int)(now - LocalClock.StartOfDayUtc(LocalClock.Today(now))).TotalMinutes;
        var todayWindow = Math.Max(20, Math.Min(480, minutesToday));
        for (var i = 0; i < 4; i++) drafts.Add((now.AddMinutes(-rnd.Next(5, todayWindow)), AlertStatus.New));
        for (var i = 0; i < 5; i++) drafts.Add((now.AddMinutes(-rnd.Next(30, 36 * 60)), AlertStatus.InProgress));
        for (var i = 0; i < 31; i++) drafts.Add((now.AddMinutes(-rnd.Next(180, 14 * 24 * 60)), AlertStatus.Closed));

        var n = 0;
        foreach (var (at, status) in drafts.OrderBy(d => d.At))
        {
            n++;
            var priority = rnd.Next(100) switch { < 25 => AlertPriority.High, < 70 => AlertPriority.Medium, _ => AlertPriority.Low };
            var channel = rnd.Next(100) switch { < 60 => AlertChannel.App, < 90 => AlertChannel.Phone, _ => AlertChannel.WalkIn };
            var colonia = Colonias[rnd.Next(Colonias.Length)];
            var assigned = status == AlertStatus.New ? null : Staff[rnd.Next(Staff.Length)];

            DateTimeOffset? closedAt = null;
            if (status == AlertStatus.Closed)
            {
                closedAt = at.AddMinutes(rnd.Next(20, 300));
                if (closedAt > now) closedAt = now;
            }

            yield return Alert.Create($"AL-{now.Year}-{n:0000}", at, status, priority, channel, colonia, assigned, closedAt);
        }
    }
}
