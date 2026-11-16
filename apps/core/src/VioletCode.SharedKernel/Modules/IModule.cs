using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace VioletCode.SharedKernel.Modules;

/// <summary>
/// Contrato de un módulo del monolito modular (ADR-0003).
/// Cada módulo registra sus servicios, su DbContext (schema propio) y sus endpoints.
/// Un módulo NO referencia a otro módulo: solo a SharedKernel.
/// </summary>
public interface IModule
{
    /// <summary>Nombre corto; se usa como prefijo de ruta (/api/{name}) y como schema de PostgreSQL.</summary>
    string Name { get; }

    void Register(IServiceCollection services, IConfiguration configuration);

    void MapEndpoints(IEndpointRouteBuilder endpoints);

    /// <summary>Aplica migraciones y, en desarrollo, siembra datos SINTÉTICOS.</summary>
    Task InitializeAsync(IServiceProvider services, bool seedSyntheticData, CancellationToken ct) => Task.CompletedTask;
}
