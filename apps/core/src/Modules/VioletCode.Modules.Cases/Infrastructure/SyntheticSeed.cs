using VioletCode.Modules.Cases.Domain;

namespace VioletCode.Modules.Cases.Infrastructure;

/// <summary>
/// DATOS SINTÉTICOS y deterministas (semilla fija). Las usuarias solo tienen alias ("Usuaria 0012"); nunca nombres.
/// El personal asignado son las cuentas de demostración del módulo Identity.
/// </summary>
internal static class SyntheticSeed
{
    private static readonly (string Name, CaseArea Area)[] Staff =
    [
        ("Paula Demo", CaseArea.Psicologia),
        ("Julia Demo", CaseArea.Juridico),
        ("Carla Demo", CaseArea.Coordinacion),
    ];

    public static IEnumerable<CaseFile> Cases(DateTimeOffset now)
    {
        var rnd = new Random(2027);
        const int total = 25;

        for (var i = 1; i <= total; i++)
        {
            var (name, area) = Staff[rnd.Next(Staff.Length)];
            var risk = rnd.Next(100) switch { < 24 => RiskLevel.High, < 64 => RiskLevel.Medium, _ => RiskLevel.Low };
            var status = rnd.Next(100) switch
            {
                < 30 => CaseStatus.Open,
                < 65 => CaseStatus.InAttention,
                < 80 => CaseStatus.Referred,
                _ => CaseStatus.Closed,
            };

            var openedAt = now.AddDays(-rnd.Next(3, 120)).AddMinutes(-rnd.Next(0, 24 * 60));
            var updatedAt = now.AddMinutes(-rnd.Next(30, 10 * 24 * 60));
            if (updatedAt < openedAt) updatedAt = openedAt.AddHours(1);

            // Solo los expedientes abiertos pueden quedar pendientes de revisión.
            var needsReview = status != CaseStatus.Closed && rnd.Next(100) < 30;

            yield return CaseFile.Create(
                $"EX-{now.Year}-{i:0000}", $"Usuaria {i:0000}", status, area, risk, name, openedAt, updatedAt, needsReview);
        }
    }
}
