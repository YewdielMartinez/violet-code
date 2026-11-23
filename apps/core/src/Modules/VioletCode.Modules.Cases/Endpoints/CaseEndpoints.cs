using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Cases.Domain;
using VioletCode.Modules.Cases.Infrastructure;
using VioletCode.SharedKernel.Auditing;
using VioletCode.SharedKernel.Security;

namespace VioletCode.Modules.Cases.Endpoints;

public sealed record CaseDto(
    Guid Id, string Folio, string Alias, CaseStatus Status, CaseArea Area, RiskLevel RiskLevel,
    string AssignedToName, DateTimeOffset UpdatedAt, bool NeedsReview);

public sealed record CaseSummaryDto(int Open, int NeedsReview, int HighRisk, int Mine);

internal static class CaseEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("").WithTags("Expedientes").RequireAuthorization();

        g.MapGet("/", async (
                bool? mine, bool? needsReview, int? take, ClaimsPrincipal user, HttpContext http,
                CasesDbContext db, IAuditLog audit, CancellationToken ct) =>
            {
                var q = db.CaseFiles.AsNoTracking().AsQueryable();
                if (mine == true)
                {
                    var me = user.DisplayName();
                    q = q.Where(c => c.AssignedToName == me);
                }
                if (needsReview == true) q = q.Where(c => c.NeedsReview);

                var items = await q
                    .OrderBy(c => c.RiskLevel == RiskLevel.High ? 0 : c.RiskLevel == RiskLevel.Medium ? 1 : 2)
                    .ThenByDescending(c => c.UpdatedAt)
                    .Take(Math.Clamp(take ?? 20, 1, 100))
                    .Select(c => new CaseDto(c.Id, c.Folio, c.Alias, c.Status, c.Area, c.RiskLevel, c.AssignedToName, c.UpdatedAt, c.NeedsReview))
                    .ToListAsync(ct);

                // Leer expedientes es una acción sensible: queda en la bitácora (sin datos de las usuarias).
                await audit.RecordAsync(new AuditEntry(
                    AuditActions.CaseList, "case",
                    ActorId: user.Id(), ActorName: user.DisplayName(),
                    IpAddress: http.Connection.RemoteIpAddress?.ToString(),
                    Details: $"mine={mine == true}, needsReview={needsReview == true}, resultados={items.Count}"), ct);

                return items;
            })
            .WithName("ListCases")
            .WithSummary("Expedientes por riesgo y última actualización (solo alias). Audita la lectura.");

        g.MapGet("/summary", async (ClaimsPrincipal user, CasesDbContext db, CancellationToken ct) =>
            {
                var cases = await db.CaseFiles.AsNoTracking().Where(c => c.Status != CaseStatus.Closed).ToListAsync(ct);
                var s = CaseSummaryCalculator.Compute(cases, user.DisplayName());
                return new CaseSummaryDto(s.Open, s.NeedsReview, s.HighRisk, s.Mine);
            })
            .WithName("CasesSummary");
    }
}
