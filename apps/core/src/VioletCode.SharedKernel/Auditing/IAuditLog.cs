namespace VioletCode.SharedKernel.Auditing;

/// <summary>
/// Bitácora de auditoría (append-only). La implementa el módulo Audit.
/// Registrar LECTURAS y escrituras de datos sensibles. Nunca guardar contenido sensible en "Details".
/// </summary>
public interface IAuditLog
{
    Task RecordAsync(AuditEntry entry, CancellationToken ct = default);
}

/// <param name="Action">Verbo con prefijo de módulo, p. ej. "auth.login.success", "case.read".</param>
/// <param name="Resource">Tipo de recurso, p. ej. "session", "case".</param>
/// <param name="ResourceId">Id del recurso afectado (nunca datos personales de la usuaria).</param>
/// <param name="ActorId">Id del personal que actuó; null si es anónimo.</param>
/// <param name="ActorName">Nombre visible del personal (no de usuarias).</param>
/// <param name="IpAddress">IP de origen, para detectar abuso.</param>
/// <param name="Details">Texto breve sin datos sensibles.</param>
public sealed record AuditEntry(
    string Action,
    string Resource,
    string? ResourceId = null,
    string? ActorId = null,
    string? ActorName = null,
    string? IpAddress = null,
    string? Details = null);

/// <summary>Acciones de auditoría conocidas. Centralizadas para que el dashboard pueda traducirlas.</summary>
public static class AuditActions
{
    public const string LoginSuccess = "auth.login.success";
    public const string LoginFailure = "auth.login.failure";
    public const string LoginLocked = "auth.login.locked";
    public const string Logout = "auth.logout";
}
