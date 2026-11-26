# Violet Code

Plataforma que conecta la solicitud de auxilio y orientación de una mujer con la gestión institucional y el seguimiento multidisciplinario de **SEMUJERES Ahome**.
2do Hackathon FIM-UAS 2026 · Ejes 1 (Prevención y atención) y 3 (Gestión interna, trazabilidad y analítica).

> **Solo datos sintéticos.** Nunca subir datos reales al repositorio.

## Componentes

| Componente                                          | Tecnología                                        | Carpeta                                          | Estado                                                             |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| **Violet Code Mobile** — app de la usuaria          | Kotlin + Jetpack Compose (MVVM)                   | [apps/mobile](apps/mobile)                       | Base: auxilio (911), directorio offline-first conectado a Supabase |
| **Violet Code Administration** — panel de SEMUJERES | React 19 + TS 7 + Tailwind v4 + motion-kit        | [apps/admin](apps/admin)                         | Auth (7 roles + UMECA), Dashboard y Directorio vía Supabase        |
| **Supabase** — BaaS y base de datos                 | PostgreSQL + Auth + RLS + Realtime (Supabase CLI) | [supabase](supabase)                             | Esquema completo (migraciones `01`–`09`, `seed.sql` y RLS)        |
| Design tokens                                       | Tema Material 3 generado con motion-kit           | [packages/design-tokens](packages/design-tokens) | Genera CSS (web) y Kotlin (Android)                                |

```text
apps/
  admin/      React + TS + Tailwind + motion-kit (npm workspace)
  mobile/     Android (Gradle)
packages/
  design-tokens/
supabase/     configuración, migraciones SQL, seeds y documentación (Supabase CLI)
docs/         discovery, arquitectura, estándares, DoD y flujo operativo MVP
```

Monorepo simple: cada app usa su herramienta nativa; npm workspaces solo para lo JS ([ADR-0001](docs/adr/0001-monorepo.md)).

## Desarrollo local

**Requisitos:** Node 20+, Docker Desktop, Supabase CLI, Android Studio (JDK 17 + Android SDK 35).

```sh
npm install                                             # dependencias JS (admin + tokens)

# 1. Supabase local → API :54321 · Studio http://127.0.0.1:54323
npx supabase start                                      # resetear BD + seeds: npx supabase db reset

# 2. Panel web → http://localhost:5173 (configurar apps/admin/.env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
npm run dev -w @violet-code/admin

# 3. App móvil: abrir apps/mobile en Android Studio (usa http://10.0.2.2:54321 o local.properties)
```

Verificaciones: `npm run lint -w @violet-code/admin` (Oxlint) · `npm run build -w @violet-code/admin` (TypeScript 7 + Vite).

## Diseño

Línea visual de [`@yewdiel21/motion-kit`](https://motion-kit-playground.vercel.app) con color principal violeta ([ADR-0002](docs/adr/0002-sistema-de-diseno-motion-kit.md)).
Un solo origen de color: `npm run tokens` regenera el tema para el panel (CSS → clases de Tailwind como `bg-primary`) y para Android (`VioletColors.kt`).
Cambiar color: `VIOLET_SEED="#5B2A86" npm run tokens`.

## Documentación

- [Flujo Operativo MVP](docs/flujo-operativo-mvp.md), [Requerimientos y Reglas](docs/requerimientos-y-reglas.md), [Alcance MVP](docs/alcance-mvp.md) y [Trazabilidad BD](docs/trazabilidad-requerimientos-db.md).
- [Estándar Frontend y Arquitectura Hexagonal](docs/estandar-frontend-arquitectura.md), [Guía de `@yewdiel21/motion-kit`](docs/guia-motion-kit-frontend.md) y [Definition of Done (DoD)](docs/definition-of-done.md).
- Documentación de base de datos, roles y privacidad: [supabase/doc-supabase/](supabase/doc-supabase/).

Cómo colaborar: [CONTRIBUTING.md](CONTRIBUTING.md).
