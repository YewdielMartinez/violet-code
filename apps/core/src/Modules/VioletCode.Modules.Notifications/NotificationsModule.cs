using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.Notifications;

/// <summary>
/// Notificaciones: push a la usuaria (FCM, contenido neutro) y en tiempo real al personal.
/// Estructura a seguir: ver VioletCode.Modules.Catalogs (módulo de referencia).
/// </summary>
public sealed class NotificationsModule : IModule
{
    public string Name => "notifications";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // TODO: services.AddModuleDbContext<NotificationsDbContext>(configuration, "notifications");
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/status", () => new { module = Name, status = "scaffold" })
            .WithTags("Notifications")
            .ExcludeFromDescription();
    }
}
