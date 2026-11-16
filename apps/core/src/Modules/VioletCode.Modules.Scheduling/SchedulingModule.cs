using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Scheduling;

/// <summary>
/// Agenda: citas por profesional y recordatorios.
/// Estructura a seguir: ver VioletCode.Modules.Catalogs (módulo de referencia).
/// </summary>
public sealed class SchedulingModule : IModule
{
    public string Name => "scheduling";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // TODO: services.AddModuleDbContext<SchedulingDbContext>(configuration, "scheduling");
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/status", () => new { module = Name, status = "scaffold" })
            .WithTags("Scheduling")
            .ExcludeFromDescription();
    }
}
