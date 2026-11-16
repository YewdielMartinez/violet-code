using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using VioletCode.Modules.Alerts;
using VioletCode.Modules.Analytics;
using VioletCode.Modules.Audit;
using VioletCode.Modules.Cases;
using VioletCode.Modules.Catalogs;
using VioletCode.Modules.Identity;
using VioletCode.Modules.Notifications;
using VioletCode.Modules.Scheduling;
using VioletCode.SharedKernel.Modules;

var builder = WebApplication.CreateBuilder(args);

// ── Módulos del monolito (ADR-0003). Registro explícito: se ve de un vistazo qué existe. ──
IModule[] modules =
[
    new IdentityModule(),
    new CatalogsModule(),
    new AlertsModule(),
    new CasesModule(),
    new SchedulingModule(),
    new NotificationsModule(),
    new AnalyticsModule(),
    new AuditModule(),
];

foreach (var module in modules)
    module.Register(builder.Services, builder.Configuration);

// ── Infraestructura transversal ──
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services.AddCors(o => o.AddPolicy("admin", p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:AdminOrigins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

// JWT: el módulo Identity emitirá los tokens con esta misma configuración.
var jwt = builder.Configuration.GetSection("Jwt");
var signingKey = jwt["SigningKey"];
if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
    throw new InvalidOperationException("Jwt:SigningKey debe existir y tener al menos 32 caracteres (usar variable de entorno Jwt__SigningKey).");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();                       // /openapi/v1.json  → contrato para Admin y Mobile
    app.MapScalarApiReference("/docs");     // /docs             → explorador de la API
}
else
{
    app.UseHsts();
}

app.UseCors("admin");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).ExcludeFromDescription();

var api = app.MapGroup("/api");
foreach (var module in modules)
    module.MapEndpoints(api.MapGroup($"/{module.Name}"));

// Migraciones + datos SINTÉTICOS (nunca datos reales). Controlado por configuración.
var seed = app.Configuration.GetValue("Database:SeedSyntheticData", false);
if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
{
    foreach (var module in modules)
        await module.InitializeAsync(app.Services, seed, CancellationToken.None);
}

app.Run();

/// <summary>Expuesto para pruebas de integración y de arquitectura.</summary>
public partial class Program;
