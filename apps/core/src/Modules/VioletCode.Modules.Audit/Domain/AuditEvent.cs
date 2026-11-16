namespace VioletCode.Modules.Audit.Domain;

/// <summary>Evento de auditoría. Inmutable: no hay métodos para modificarlo ni borrarlo.</summary>
public sealed class AuditEvent
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public DateTimeOffset OccurredAt { get; private set; }
    public string Action { get; private set; } = default!;
    public string Resource { get; private set; } = default!;
    public string? ResourceId { get; private set; }
    public string? ActorId { get; private set; }
    public string? ActorName { get; private set; }
    public string? IpAddress { get; private set; }
    public string? Details { get; private set; }

    private AuditEvent() { } // EF Core

    public static AuditEvent Record(
        DateTimeOffset at, string action, string resource, string? resourceId,
        string? actorId, string? actorName, string? ipAddress, string? details) => new()
    {
        OccurredAt = at,
        Action = action,
        Resource = resource,
        ResourceId = resourceId,
        ActorId = actorId,
        ActorName = actorName,
        IpAddress = ipAddress,
        Details = details,
    };
}
