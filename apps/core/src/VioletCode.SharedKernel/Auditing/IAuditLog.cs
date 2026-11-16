namespace VioletCode.SharedKernel.Auditing;

/// <summary>
/// Bitácora de auditoría (append-only). La implementa el módulo Audit.
/// Registrar LECTURAS y escrituras de datos sensibles. Nunca guardar contenido sensible en "Details".
/// </summary>
public interface IAuditLog
{
    Task RecordAsync(AuditEntry entry, CancellationToken ct = default);
}

public sealed record AuditEntry(
    string Action,        // p. ej. "case.read", "case.update", "alert.create"
    string Resource,      // p. ej. "case"
    string? ResourceId,
    string? ActorId,      // id del usuario (no nombre)
    string? Details = null);
