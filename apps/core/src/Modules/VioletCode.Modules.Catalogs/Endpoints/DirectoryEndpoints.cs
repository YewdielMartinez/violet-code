using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using VioletCode.Modules.Catalogs.Domain;
using VioletCode.Modules.Catalogs.Infrastructure;

namespace VioletCode.Modules.Catalogs.Endpoints;

public sealed record DirectoryEntryDto(
    Guid Id, EntryKind Kind, string Name, string? Description, string? Phone, string? Address,
    string? Schedule, double? Latitude, double? Longitude, bool IsEmergency);

public sealed record CreateDirectoryEntryRequest(
    EntryKind Kind, string Name, string? Description, string? Phone, string? Address,
    string? Schedule, double? Latitude, double? Longitude, bool IsEmergency);

internal static class DirectoryEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        var g = api.MapGroup("/directory").WithTags("Catálogos · Directorio");

        // Público: la app móvil lo descarga para usarlo sin conexión.
        g.MapGet("/", async (EntryKind? kind, CatalogsDbContext db, CancellationToken ct) =>
            {
                var q = db.DirectoryEntries.AsNoTracking().Where(x => x.IsActive);
                if (kind is not null) q = q.Where(x => x.Kind == kind);

                var items = await q.OrderByDescending(x => x.IsEmergency).ThenBy(x => x.Name).ToListAsync(ct);
                return items.Select(ToDto).ToList();
            })
            .WithName("ListDirectoryEntries")
            .WithSummary("Lista instancias y Puntos Violeta activos.");

        g.MapGet("/{id:guid}", async Task<Results<Ok<DirectoryEntryDto>, NotFound>> (Guid id, CatalogsDbContext db, CancellationToken ct) =>
            {
                var e = await db.DirectoryEntries.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.IsActive, ct);
                return e is null ? TypedResults.NotFound() : TypedResults.Ok(ToDto(e));
            })
            .WithName("GetDirectoryEntry");

        // Escritura: solo personal autenticado (el módulo Identity emitirá los tokens).
        g.MapPost("/", async Task<Results<Created<DirectoryEntryDto>, ValidationProblem>> (CreateDirectoryEntryRequest r, CatalogsDbContext db, CancellationToken ct) =>
            {
                DirectoryEntry entry;
                try
                {
                    entry = DirectoryEntry.Create(r.Kind, r.Name, r.Description, r.Phone, r.Address, r.Schedule, r.Latitude, r.Longitude, r.IsEmergency);
                }
                catch (ArgumentException ex)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        [ex.ParamName ?? "request"] = [ex.Message],
                    });
                }

                db.DirectoryEntries.Add(entry);
                await db.SaveChangesAsync(ct);
                return TypedResults.Created($"/api/catalogs/directory/{entry.Id}", ToDto(entry));
            })
            .WithName("CreateDirectoryEntry")
            .RequireAuthorization();
    }

    private static DirectoryEntryDto ToDto(DirectoryEntry x) =>
        new(x.Id, x.Kind, x.Name, x.Description, x.Phone, x.Address, x.Schedule, x.Latitude, x.Longitude, x.IsEmergency);
}
