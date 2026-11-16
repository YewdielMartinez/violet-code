using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Alerts;

/// <summary>
/// Alertas de auxilio: recibir alerta + ubicación, estados (nueva, atendida, cerrada) y aviso en tiempo real a Admin (SignalR).
/// Estructura a seguir: ver VioletCode.Modules.Catalogs (módulo de referencia).
/// </summary>
public sealed class AlertsModule : IModule
{
    public string Name => "alerts";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // TODO: services.AddModuleDbContext<AlertsDbContext>(configuration, "alerts");
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/status", () => new { module = Name, status = "scaffold" })
            .WithTags("Alerts")
            .ExcludeFromDescription();
    }
}
