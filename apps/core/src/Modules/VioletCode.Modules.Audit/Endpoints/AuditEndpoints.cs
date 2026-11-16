using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Audit.Infrastructure;
using VioletCode.SharedKernel.Security;

namespace VioletCode.Modules.Audit.Endpoints;

public sealed record AuditEventDto(
    Guid Id, DateTimeOffset OccurredAt, string Action, string Resource, string? ActorName, string? Details);

internal static class AuditEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        // Solo supervisión. No se expone la IP en la respuesta.
        api.MapGet("/events", async (int? take, AuditDbContext db, CancellationToken ct) =>
            {
                var limit = Math.Clamp(take ?? 20, 1, 100);
                return await db.Events.AsNoTracking()
                    .OrderByDescending(x => x.OccurredAt)
                    .Take(limit)
                    .Select(x => new AuditEventDto(x.Id, x.OccurredAt, x.Action, x.Resource, x.ActorName, x.Details))
                    .ToListAsync(ct);
            })
            .WithName("ListAuditEvents")
            .WithTags("Auditoría")
            .WithSummary("Eventos de auditoría más recientes.")
            .RequireAuthorization(p => p.RequireRole(StaffRoles.Supervisors));
    }
}
