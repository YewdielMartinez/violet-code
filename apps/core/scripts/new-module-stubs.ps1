# Genera la clase IModule vacía de cada módulo (solo si no existe). Uso: pwsh scripts/new-module-stubs.ps1
$modules = [ordered]@{
  Identity      = 'Autenticación (personal: correo + contraseña + JWT; usuaria: OTP o anónimo) y gestión de usuarios, roles y áreas.'
  Alerts        = 'Alertas de auxilio: recibir alerta + ubicación, estados (nueva, atendida, cerrada) y aviso en tiempo real a Admin (SignalR).'
  Cases         = 'Solicitudes, expedientes, intervenciones, canalizaciones y seguimiento. Campos sensibles cifrados.'
  Scheduling    = 'Agenda: citas por profesional y recordatorios.'
  Notifications = 'Notificaciones: push a la usuaria (FCM, contenido neutro) y en tiempo real al personal.'
  Analytics     = 'Estadísticas agregadas sin datos personales y mapa de calor por colonia/sindicatura con umbral mínimo.'
  Audit         = 'Bitácora append-only de lecturas y cambios. Implementa SharedKernel.Auditing.IAuditLog.'
}
$root = Join-Path $PSScriptRoot '..\src\Modules'
foreach ($m in $modules.Keys) {
  $lower = $m.ToLowerInvariant()
  $file = Join-Path $root "VioletCode.Modules.$m\${m}Module.cs"
  if (Test-Path $file) { continue }
  $desc = $modules[$m]
  @"
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VioletCode.SharedKernel.Modules;

namespace VioletCode.Modules.$m;

/// <summary>
/// $desc
/// Estructura a seguir: ver VioletCode.Modules.Catalogs (módulo de referencia).
/// </summary>
public sealed class ${m}Module : IModule
{
    public string Name => "$lower";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // TODO: services.AddModuleDbContext<${m}DbContext>(configuration, "$lower");
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/status", () => new { module = Name, status = "scaffold" })
            .WithTags("$m")
            .ExcludeFromDescription();
    }
}
"@ | Set-Content -Path $file -Encoding utf8
  Write-Host "creado $file"
}
