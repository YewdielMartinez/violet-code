using VioletCode.Modules.Scheduling.Domain;
using VioletCode.SharedKernel.Time;

namespace VioletCode.Modules.Scheduling.Infrastructure;

/// <summary>
/// DATOS SINTÉTICOS y deterministas (semilla fija). Citas del mes en curso en horario local de Los Mochis (9:00 a 15:00).
/// Los folios apuntan a los expedientes sintéticos EX-AAAA-0001..0025 (solo texto; no hay dependencia con Cases).
/// </summary>
internal static class SyntheticSeed
{
    private const int CaseCount = 25;
    private const int TodayCount = 6;
    private const int TotalCount = 30;

    public static IEnumerable<Appointment> Appointments(DateTimeOffset now)
    {
        var rnd = new Random(2028);
        var today = LocalClock.Today(now);
        var daysInMonth = DateTime.DaysInMonth(today.Year, today.Month);

        for (var i = 0; i < TotalCount; i++)
        {
            // Las primeras citas son de hoy; el resto se reparte en el mes.
            var date = i < TodayCount ? today : new DateOnly(today.Year, today.Month, rnd.Next(1, daysInMonth + 1));
            var time = new TimeOnly(9, 0).AddMinutes(30 * rnd.Next(0, 11)); // 9:00 a 14:00
            var startsAt = LocalClock.AtLocal(date, time);

            var kind = rnd.Next(100) switch
            {
                < 35 => AppointmentKind.Psicologica,
                < 60 => AppointmentKind.Juridica,
                < 90 => AppointmentKind.Seguimiento,
                _ => AppointmentKind.Visita,
            };
            var professional = kind switch
            {
                AppointmentKind.Psicologica => "Paula Demo",
                AppointmentKind.Juridica => "Julia Demo",
                _ => rnd.Next(2) == 0 ? "Carla Demo" : "Paula Demo",
            };

            // Lo pasado ya se atendió (salvo alguna cancelada); lo futuro está programado. Las de hoy no se cancelan (demo).
            var cancelled = i >= TodayCount && rnd.Next(100) < 10;
            var status = cancelled ? AppointmentStatus.Cancelled
                : startsAt < now ? AppointmentStatus.Done : AppointmentStatus.Scheduled;

            var duration = kind == AppointmentKind.Visita ? 90 : (rnd.Next(2) == 0 ? 45 : 60);

            yield return Appointment.Create(
                $"EX-{now.Year}-{rnd.Next(1, CaseCount + 1):0000}", startsAt, duration, kind, professional, status);
        }
    }
}
