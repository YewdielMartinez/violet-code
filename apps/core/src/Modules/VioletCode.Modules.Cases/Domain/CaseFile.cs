namespace VioletCode.Modules.Cases.Domain;

/// <summary>
/// Expediente de una usuaria. Solo se identifica con un ALIAS (seudónimo): el dashboard nunca muestra nombres reales.
/// </summary>
public sealed class CaseFile
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();
    public string Folio { get; private set; } = default!;
    public string Alias { get; private set; } = default!;
    public CaseStatus Status { get; private set; }
    public CaseArea Area { get; private set; }
    public RiskLevel RiskLevel { get; private set; }
    public string AssignedToName { get; private set; } = default!;
    public DateTimeOffset OpenedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public bool NeedsReview { get; private set; }

    private CaseFile() { } // EF Core

    public static CaseFile Create(
        string folio, string alias, CaseStatus status, CaseArea area, RiskLevel riskLevel,
        string assignedToName, DateTimeOffset openedAt, DateTimeOffset updatedAt, bool needsReview)
    {
        if (string.IsNullOrWhiteSpace(folio)) throw new ArgumentException("El folio es obligatorio.", nameof(folio));
        if (string.IsNullOrWhiteSpace(alias)) throw new ArgumentException("El alias es obligatorio.", nameof(alias));
        if (string.IsNullOrWhiteSpace(assignedToName)) throw new ArgumentException("Falta la persona asignada.", nameof(assignedToName));
        if (updatedAt < openedAt) throw new ArgumentException("La actualización no puede ser anterior a la apertura.", nameof(updatedAt));

        return new CaseFile
        {
            Folio = folio.Trim(),
            Alias = alias.Trim(),
            Status = status,
            Area = area,
            RiskLevel = riskLevel,
            AssignedToName = assignedToName.Trim(),
            OpenedAt = openedAt.ToUniversalTime(),
            UpdatedAt = updatedAt.ToUniversalTime(),
            NeedsReview = needsReview,
        };
    }

    public bool IsOpen => Status != CaseStatus.Closed;

    /// <summary>Filtro "mis expedientes". Sin nombre de quien consulta nunca coincide con nadie.</summary>
    public bool IsAssignedTo(string? staffName) =>
        !string.IsNullOrWhiteSpace(staffName)
        && string.Equals(AssignedToName, staffName.Trim(), StringComparison.Ordinal);
}

public enum CaseStatus { Open = 1, InAttention = 2, Referred = 3, Closed = 4 }

public enum CaseArea { Psicologia = 1, Juridico = 2, TrabajoSocial = 3, Coordinacion = 4 }

/// <summary>El orden numérico es el orden de atención: High primero.</summary>
public enum RiskLevel { High = 1, Medium = 2, Low = 3 }
