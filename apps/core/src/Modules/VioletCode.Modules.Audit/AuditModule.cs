using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Audit;

/// <summary>
/// Bitácora append-only de lecturas y cambios. Implementa SharedKernel.Auditing.IAuditLog.
/// Estructura a seguir: ver VioletCode.Modules.Catalogs (módulo de referencia).
/// </summary>
public sealed class AuditModule : IModule
{
    public string Name => "audit";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // TODO: services.AddModuleDbContext<AuditDbContext>(configuration, "audit");
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/status", () => new { module = Name, status = "scaffold" })
            .WithTags("Audit")
            .ExcludeFromDescription();
    }
}
