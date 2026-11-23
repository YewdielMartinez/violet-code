using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Scheduling.Domain;
using VioletCode.Modules.Scheduling.Infrastructure;
using VioletCode.SharedKernel.Security;
using VioletCode.SharedKernel.Time;

namespace VioletCode.Modules.Scheduling.Endpoints;

public sealed record AppointmentDto(
    Guid Id, string CaseFolio, DateTimeOffset StartsAt, int DurationMinutes, AppointmentKind Kind,
    string ProfessionalName, AppointmentStatus Status);

public sealed record SchedulingSummaryDto(
    int Today, DateTimeOffset? NextAt, string? NextCaseFolio, IReadOnlyList<AppointmentDateCount> ByDate);

internal static class SchedulingEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("").WithTags("Agenda").RequireAuthorization();

        g.MapGet("/appointments", async (
                DateOnly? from, DateOnly? to, bool? mine, ClaimsPrincipal user,
                SchedulingDbContext db, TimeProvider clock, CancellationToken ct) =>
            {
                var range = AgendaCalculator.ResolveRange(from, to, clock.GetUtcNow());
                var q = db.Appointments.AsNoTracking().Where(a => a.StartsAt >= range.FromUtc && a.StartsAt < range.ToUtc);
                if (mine == true)
                {
                    var me = user.DisplayName();
                    q = q.Where(a => a.ProfessionalName == me);
                }

                return await q
                    .OrderBy(a => a.StartsAt)
                    .Select(a => new AppointmentDto(a.Id, a.CaseFolio, a.StartsAt, a.DurationMinutes, a.Kind, a.ProfessionalName, a.Status))
                    .ToListAsync(ct);
            })
            .WithName("ListAppointments")
            .WithSummary("Citas del rango (fechas locales yyyy-MM-dd; por defecto hoy), ordenadas por hora.");

        g.MapGet("/summary", async (SchedulingDbContext db, TimeProvider clock, CancellationToken ct) =>
            {
                var now = clock.GetUtcNow();
                var today = LocalClock.Today(now);
                var monthStart = LocalClock.StartOfDayUtc(new DateOnly(today.Year, today.Month, 1));

                // Del inicio del mes en adelante: alcanza para "hoy", el calendario del mes y la siguiente cita.
                var appointments = await db.Appointments.AsNoTracking().Where(a => a.StartsAt >= monthStart).ToListAsync(ct);
                var s = AgendaCalculator.Summarize(appointments, now);
                return new SchedulingSummaryDto(s.Today, s.NextAt, s.NextCaseFolio, s.ByDate);
            })
            .WithName("SchedulingSummary");
    }
}
