using Microsoft.Extensions.Logging;
using VioletCode.Modules.Audit.Domain;
using VioletCode.SharedKernel.Auditing;

namespace VioletCode.Modules.Audit.Infrastructure;

/// <summary>Implementación de IAuditLog. Solo inserta: la bitácora nunca se edita ni se borra desde la app.</summary>
internal sealed class AuditLog(AuditDbContext db, TimeProvider clock, ILogger<AuditLog> logger) : IAuditLog
{
    public async Task RecordAsync(AuditEntry entry, CancellationToken ct = default)
    {
        db.Events.Add(AuditEvent.Record(
            clock.GetUtcNow(), entry.Action, entry.Resource, entry.ResourceId,
            entry.ActorId, entry.ActorName, entry.IpAddress, entry.Details));
        await db.SaveChangesAsync(ct);
        logger.LogInformation("audit {Action} {Resource} actor={ActorId}", entry.Action, entry.Resource, entry.ActorId);
    }
}
