namespace VioletCode.Modules.Alerts.Domain;

/// <summary>Alerta de auxilio recibida por el centro de atención.</summary>
public sealed class Alert
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public string Folio { get; private set; } = default!;
    public DateTimeOffset CreatedAt { get; private set; }
    public AlertStatus Status { get; private set; }
    public AlertPriority Priority { get; private set; }
    public AlertChannel Channel { get; private set; }
    public string Colonia { get; private set; } = default!;
    public string? AssignedToName { get; private set; }
    public DateTimeOffset? ClosedAt { get; private set; }

    private Alert() { } // EF Core

    public static Alert Create(
        string folio, DateTimeOffset createdAt, AlertStatus status, AlertPriority priority,
        AlertChannel channel, string colonia, string? assignedToName, DateTimeOffset? closedAt)
    {
        if (string.IsNullOrWhiteSpace(folio)) throw new ArgumentException("El folio es obligatorio.", nameof(folio));
        if (string.IsNullOrWhiteSpace(colonia)) throw new ArgumentException("La colonia es obligatoria.", nameof(colonia));
        if (status == AlertStatus.Closed && closedAt is null)
            throw new ArgumentException("Una alerta cerrada debe tener fecha de cierre.", nameof(closedAt));

        return new Alert
        {
            Folio = folio.Trim(),
            CreatedAt = createdAt.ToUniversalTime(),
            Status = status,
            Priority = priority,
            Channel = channel,
            Colonia = colonia.Trim(),
            AssignedToName = assignedToName,
            ClosedAt = closedAt?.ToUniversalTime(),
        };
    }

    public bool IsActive => Status != AlertStatus.Closed;
}

public enum AlertStatus { New = 1, InProgress = 2, Closed = 3 }

/// <summary>El orden numérico es el orden de atención: High primero.</summary>
public enum AlertPriority { High = 1, Medium = 2, Low = 3 }

public enum AlertChannel { App = 1, Phone = 2, WalkIn = 3 }
