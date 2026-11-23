namespace VioletCode.Modules.Cases.Domain;

public sealed record CaseSummary(int Open, int NeedsReview, int HighRisk, int Mine);

/// <summary>Agregaciones del tablero de expedientes. Lógica pura (sin EF) para poder probarla.</summary>
public static class CaseSummaryCalculator
{
    /// <summary>
    /// <c>Open</c>: no cerrados. <c>NeedsReview</c>: pendientes de revisión (abiertos).
    /// <c>HighRisk</c>: abiertos con riesgo alto. <c>Mine</c>: abiertos asignados a quien consulta.
    /// </summary>
    public static CaseSummary Compute(IEnumerable<CaseFile> cases, string? callerName)
    {
        var open = cases.Where(c => c.IsOpen).ToList();
        return new CaseSummary(
            Open: open.Count,
            NeedsReview: open.Count(c => c.NeedsReview),
            HighRisk: open.Count(c => c.RiskLevel == RiskLevel.High),
            Mine: open.Count(c => c.IsAssignedTo(callerName)));
    }
}
