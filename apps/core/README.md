# Violet Code Core

API central. ASP.NET Core 9 + EF Core + PostgreSQL. **Monolito modular** ([ADR-0003](../../docs/adr/0003-backend-monolito-modular.md)).

```sh
docker compose -f ../../infra/docker-compose.yml up -d db
dotnet tool restore
dotnet run --project src/VioletCode.Api        # http://localhost:5080  · /docs · /openapi/v1.json · /health
dotnet test                                     # pruebas de arquitectura (límites entre módulos)
```

En desarrollo aplica migraciones y siembra **datos sintéticos** al arrancar (`Database:MigrateOnStartup`, `Database:SeedSyntheticData`).

## Estructura

```
src/
  VioletCode.Api/              host: auth JWT, CORS, OpenAPI, registro de módulos
  VioletCode.SharedKernel/     IModule, IAuditLog, AddModuleDbContext
  Modules/
    VioletCode.Modules.Catalogs/   ← MÓDULO DE REFERENCIA (completo)
      Domain/                  entidades y reglas, sin EF ni ASP.NET
      Infrastructure/          DbContext (schema "catalogs"), migraciones, seed sintético
      Endpoints/               Minimal APIs → /api/catalogs/...
    Identity · Alerts · Cases · Scheduling · Notifications · Analytics · Audit   (esqueleto)
tests/
  VioletCode.ArchitectureTests/   un módulo no referencia a otro; el dominio no depende de infraestructura
```

## Agregar funcionalidad a un módulo

1. Copiar la estructura de `Catalogs` (Domain / Infrastructure / Endpoints).
2. En `XxxModule.Register`: `services.AddModuleDbContext<XxxDbContext>(configuration, "xxx")`.
3. Migración: `dotnet ef migrations add Inicial -p src/Modules/VioletCode.Modules.Xxx -s src/VioletCode.Api -c XxxDbContext -o Infrastructure/Migrations`
4. Llamar `MigrateAsync` + seed en `InitializeAsync` (ver Catalogs).
5. `dotnet test` debe seguir en verde.

**Reglas:** un módulo no usa clases ni tablas de otro módulo; los datos sensibles se auditan con `IAuditLog`; nunca datos reales en seeds.
