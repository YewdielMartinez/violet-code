# Violet Code

Plataforma que conecta la solicitud de auxilio y orientación de una mujer con la gestión institucional y el seguimiento multidisciplinario de **SEMUJERES Ahome**.
2do Hackathon FIM-UAS 2026 · Ejes 1 (Prevención y atención) y 3 (Gestión interna, trazabilidad y analítica).

> **Solo datos sintéticos.** Nunca subir datos reales, credenciales ni archivos `.env` al repositorio.

---

## Componentes

| Componente | Tecnología | Carpeta | Estado |
|---|---|---|---|
| **Violet Code Mobile** — app de la usuaria | Kotlin + Jetpack Compose (MVVM) | [apps/mobile](apps/mobile) | Auxilio (alertas), directorio offline-first y pre-registro vía Supabase |
| **Violet Code Administration** — panel de SEMUJERES | React 19 + TypeScript 7 + Tailwind v4 + `@yewdiel21/motion-kit` + TanStack Query | [apps/admin](apps/admin) | Auth (6 roles internos + UMECA), expedientes editables, agresores, documentos privados, órdenes de protección, canalizaciones, seguimiento, notas privadas, historial clínico, agenda, alertas 24/7, actividades, informes y directorio |
| **Supabase** — backend, auth y base de datos | PostgreSQL 17 + Auth + RLS (`RBAC + ABAC`) + RPCs + Storage privado + Realtime (Supabase CLI) | [supabase](supabase) | Esquema completo, migraciones (`01`–`63`), `seed.sql` + `seeds/` y pruebas `pgTAP` |
| **Design tokens** | Tema Material 3 generado | [packages/design-tokens](packages/design-tokens) | Genera CSS (web) y Kotlin (Android) desde una sola semilla |

```text
apps/
  admin/            Panel web SEMUJERES (React + TS + Tailwind + motion-kit, npm workspace)
  mobile/           App móvil Android (Kotlin + Compose, Gradle)
packages/
  design-tokens/    Tokens Material 3 compartidos (CSS + Kotlin)
supabase/           Configuración, migraciones SQL, seeds, pruebas pgTAP y doc-supabase/
docs/               Requerimientos, arquitectura hexagonal, ADRs y flujo operativo MVP
```

Monorepo simple: cada plataforma usa su herramienta nativa; `npm workspaces` únicamente para los paquetes JavaScript/TypeScript ([ADR-0001](docs/adr/0001-monorepo.md) y [ADR-0003](docs/adr/0003-arquitectura-hexagonal-admin-supabase.md)).

---

## Desarrollo local

**Requisitos:** Node 20+, Docker Desktop (en ejecución), Android Studio (JDK 17 + Android SDK 35) para `apps/mobile`.
La CLI de Supabase viene incluida como devDependency (`npx supabase`, sin instalación global obligatoria).

### 1. Instalar dependencias JS

```sh
npm install
```

### 2. Levantar Supabase y correr migraciones (local)

Con **Docker Desktop** corriendo, desde la raíz del repositorio:

```sh
# Levantar los contenedores locales (aplica migraciones nuevas si el stack aún no existe)
#   API:     http://127.0.0.1:54321
#   DB:      127.0.0.1:54322
#   Studio:  http://127.0.0.1:54323
#   Correos: http://127.0.0.1:54324
npx supabase start

# Reconstruir la BD desde cero: corre TODAS las migraciones (supabase/migrations/) y seeds (seed.sql + seeds/)
npx supabase db reset

# Ver credenciales locales (API URL y Publishable/anon key) para configurar .env.local
npx supabase status

# Ejecutar toda la suite de pruebas pgTAP (supabase/tests/)
npx supabase test db

# Detener los contenedores locales al terminar
npx supabase stop
```

> Si acabas de hacer `git pull` y entraron nuevas migraciones en `supabase/migrations/`, ejecuta `npx supabase db reset` para aplicar todo desde cero junto con los datos sintéticos. Trabaja siempre en entorno local (nunca uses `--remote` contra producción).

### 3. Levantar el panel web (`apps/admin`)

Configura `apps/admin/.env.local` tomando como base `apps/admin/.env.example` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` obtenidos de `npx supabase status`, y luego:

```sh
# Regenerar tipos TypeScript de Supabase si hubo cambios en BD/RPCs
npm run gen:types -w @violet-code/admin

# Servidor de desarrollo → http://localhost:5173
npm run dev -w @violet-code/admin
```

Verificaciones de `apps/admin`:

```sh
npm run lint -w @violet-code/admin     # Oxlint
npm run build -w @violet-code/admin    # TypeScript 7 (tsc -b) + Vite
npm run test -w @violet-code/admin     # Vitest
```

### 4. Levantar la app móvil (`apps/mobile`)

Abre `apps/mobile` en **Android Studio** (emulador usa `http://10.0.2.2:54321` o la URL configurada en `local.properties`).

### Cuentas sintéticas locales (`seed.sql`)

Todas las cuentas de prueba locales usan la contraseña `Demo1234!`:

- `titular@demo.violetcode.local` (`titular`)
- `subdireccion@demo.violetcode.local` (`subdireccion`)
- `trabajo.social@demo.violetcode.local` (`trabajo_social`)
- `psicologia@demo.violetcode.local` (`psicologia`)
- `juridico@demo.violetcode.local` (`juridico`)
- `recepcion@demo.violetcode.local` (`recepcion`)
- `umeca@demo.violetcode.local` (`umeca`)
- `usuaria.app@demo.violetcode.local` / `usuaria.nueva@demo.violetcode.local` (app móvil)

---

## Diseño

Línea visual de [`@yewdiel21/motion-kit`](https://motion-kit-playground.vercel.app) con semilla violeta ([ADR-0002](docs/adr/0002-sistema-de-diseno-motion-kit.md)).
`npm run tokens` regenera el tema para el panel web (CSS → clases Tailwind como `bg-primary`) y para Android (`VioletColors.kt`).
Cambiar semilla: `VIOLET_SEED="#5B2A86" npm run tokens`.

---

## Documentación

- **Base de datos y Supabase:** [supabase/REGLAS.md](supabase/REGLAS.md), [supabase/README.md](supabase/README.md) y [supabase/doc-supabase/](supabase/doc-supabase/).
- **Producto y reglas de negocio:** [Flujo Operativo MVP](docs/flujo-operativo-mvp.md), [Requerimientos y Reglas](docs/requerimientos-y-reglas.md), [Alcance MVP](docs/alcance-mvp.md) y [Trazabilidad BD](docs/trazabilidad-requerimientos-db.md).
- **Arquitectura y estándares:** [Estándar Frontend y Arquitectura Hexagonal](docs/estandar-frontend-arquitectura.md), [Guía de `@yewdiel21/motion-kit`](docs/guia-motion-kit-frontend.md), [Resiliencia, Concurrencia y Sesiones](docs/resiliencia-concurrencia-sesiones.md) y [Definition of Done (DoD)](docs/definition-of-done.md).
- **Reglas del repo y colaboración:** [AGENT.md](AGENT.md) y [CONTRIBUTING.md](CONTRIBUTING.md).
