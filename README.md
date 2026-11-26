# Violet Code

Plataforma que conecta la solicitud de auxilio y orientación de una mujer con la gestión institucional y el seguimiento multidisciplinario de **SEMUJERES Ahome**.
2do Hackathon FIM-UAS 2026 · Ejes 1 (Prevención y atención) y 3 (Gestión interna, trazabilidad y analítica).

> **Solo datos sintéticos.** Nunca subir datos reales al repositorio.

## Componentes

| Componente | Tecnología | Carpeta | Estado |
|---|---|---|---|
| **Violet Code Mobile** — app de la usuaria | Kotlin + Jetpack Compose (MVVM) | [apps/mobile](apps/mobile) | Base: auxilio (911), directorio desde API, salida rápida |
| **Violet Code Administration** — panel de SEMUJERES | React + TypeScript + Tailwind + motion-kit | [apps/admin](apps/admin) | Base: layout, dashboard, directorio desde API |
| **Violet Code Core** — API central | ASP.NET Core 9, monolito modular, PostgreSQL | [apps/core](apps/core) | Base: 8 módulos, Catálogos completo, pruebas de arquitectura |
| **Supabase** — BaaS y base de datos | PostgreSQL + Auth + RLS + Realtime (Supabase CLI) | [supabase](supabase) | Base: inicializado (`config.toml`, `migrations/`, `functions/`) |
| Design tokens | Tema Material 3 generado con motion-kit | [packages/design-tokens](packages/design-tokens) | Genera CSS (web) y Kotlin (Android) |
| Infraestructura | Docker Compose | [infra](infra) | PostgreSQL + API |

```
apps/
  admin/      React + TS + Tailwind + motion-kit (npm workspace)
  mobile/     Android (Gradle)
  core/       ASP.NET Core (dotnet)
packages/
  design-tokens/
infra/        docker-compose.yml
supabase/     configuración, migraciones SQL y Edge Functions (Supabase CLI)
docs/         discovery, arquitectura, ADRs, registro de reuniones
```

Monorepo simple: cada app usa su herramienta nativa; npm workspaces solo para lo JS ([ADR-0001](docs/adr/0001-monorepo.md)).

## Desarrollo local

**Requisitos:** Node 20+, .NET SDK 9, Docker Desktop, Supabase CLI, Android Studio (JDK 17 + Android SDK 35).

```sh
npm install                                             # dependencias JS (admin + tokens)

# 0. Supabase local → API :54321 · Studio http://127.0.0.1:54323
supabase start                                          # resetear BD + seeds: supabase db reset · detener: supabase stop

# 1. Base de datos
docker compose -f infra/docker-compose.yml up -d db

# 2. API → http://localhost:5080  (explorador: /docs · contrato: /openapi/v1.json)
cd apps/core && dotnet tool restore && dotnet run --project src/VioletCode.Api

# 3. Panel → http://localhost:5173  (reenvía /api a :5080)
npm run dev -w @violet-code/admin

# 4. App móvil: abrir apps/mobile en Android Studio y correr en emulador (usa http://10.0.2.2:5080)
```

Todo en contenedores (DB + API): `docker compose -f infra/docker-compose.yml up -d --build`.

Pruebas: `cd apps/core && dotnet test` · Build del panel: `npm run build -w @violet-code/admin`.

## Diseño

Línea visual de [`@yewdiel21/motion-kit`](https://motion-kit-playground.vercel.app) con color principal violeta ([ADR-0002](docs/adr/0002-sistema-de-diseno-motion-kit.md)).
Un solo origen de color: `npm run tokens` regenera el tema para el panel (CSS → clases de Tailwind como `bg-primary`) y para Android (`VioletColors.kt`).
Cambiar color: `VIOLET_SEED="#5B2A86" npm run tokens`.

## Documentación

| # | Documento | Para qué |
|---|---|---|
| 00 | [Convocatoria y rúbrica](docs/00-convocatoria-y-rubrica.md) | Entregables y cómo cubrimos cada criterio |
| 01 | [Product Discovery](docs/discovery/01-product-discovery.md) | Problema, usuarios, hipótesis, alcance |
| 02 | [Estructura funcional](docs/discovery/02-estructura-funcional.md) | Módulos Mobile / Admin / Core |
| 03 | [Guía de entrevista](docs/discovery/03-guia-entrevista-semujeres.md) | Preguntas para SEMUJERES |
| 04 | [Arquitectura](docs/architecture/04-arquitectura-preliminar.md) | Monolito modular, MVVM, datos, seguridad |
| 05 | [Registro de descubrimiento](docs/discovery/registro/README.md) | Hipótesis, actas, requerimientos, riesgos |
| 06 | [Post-reunión](docs/discovery/06-post-reunion.md) | De respuestas a historias y MVP |
| ADR | [docs/adr/](docs/adr/) | Decisiones de arquitectura |

Cómo colaborar: [CONTRIBUTING.md](CONTRIBUTING.md).
