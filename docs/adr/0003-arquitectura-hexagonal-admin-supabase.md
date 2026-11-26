# ADR-0003: Arquitectura Hexagonal en `apps/admin` e integración con Supabase

- **Estado:** Aceptado
- **Fecha:** 2026-11-25
- **Ámbito:** `apps/admin`, `supabase/`
- **Documentos relacionados:**
  - [`docs/estandar-frontend-arquitectura.md`](../estandar-frontend-arquitectura.md)
  - [`docs/guia-motion-kit-frontend.md`](../guia-motion-kit-frontend.md)
  - [`supabase/doc-supabase/buenas-practicas.md`](../../supabase/doc-supabase/buenas-practicas.md)
  - [`supabase/doc-supabase/roles-y-permisos.md`](../../supabase/doc-supabase/roles-y-permisos.md)
  - [`CONTRIBUTING.md`](../../CONTRIBUTING.md)

---

## 1. Contexto

El panel web **Violet Code Administration** (`apps/admin`) debe operar sobre **Supabase** (PostgreSQL 17, Auth, Storage privado, Realtime y políticas RLS RBAC + ABAC versionadas en `supabase/migrations/`) para cubrir los flujos operativos de SEMUJERES Ahome.

Con un equipo trabajando en paralelo (base de datos, panel web y app móvil), conectar los componentes React directamente a `supabase.from()` o a las filas crudas en `snake_case` genera tres problemas críticos:

1. Acopla las pantallas al esquema físico SQL: cualquier cambio en una tabla o RPC rompe múltiples vistas.
2. Mezcla reglas de negocio, transformación de datos, caché y renderizado visual en un mismo archivo `.tsx`.
3. Impide probar la lógica del dominio o trabajar con *fakes* en memoria mientras una migración o endpoint sigue en desarrollo.

---

## 2. Decisión

Adoptamos **Arquitectura Hexagonal (Puertos y Adaptadores)** dentro de `apps/admin/src/` y separamos estrictamente la administración de infraestructura de datos (`supabase/`) del consumo en cliente (`apps/admin/`).

### 2.1 Estructura vigente del repositorio (vista relevante)

```text
violet-code/
├── apps/
│   ├── admin/                                  # Panel Web (React 19 + TS + Tailwind v4 + motion-kit)
│   │   ├── .env                                # Local (ignorado): VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
│   │   ├── .env.example                        # Plantilla versionada sin secretos
│   │   └── src/
│   │       ├── app/                            # Composición raíz: Router, AppLayout, providers, RequireAuth, tema
│   │       │
│   │       ├── domain/                         # NÚCLEO (Cero dependencias externas / UI / SDKs)
│   │       │   ├── models/                     # Entidades y Value Objects en camelCase + validaciones puras
│   │       │   └── ports/                      # Contratos/interfaces (ej. ExpedienteRepository, CitaRepository)
│   │       │
│   │       ├── infrastructure/                 # ADAPTADORES SECUNDARIOS (Salida / Persistencia)
│   │       │   └── supabase/
│   │       │       ├── client.ts               # Instancia única createClient<Database>
│   │       │       ├── database.types.ts       # Autogenerado con `supabase gen types` (no editar a mano)
│   │       │       └── adapters/               # Implementación de puertos (.from(), .rpc() y mappers)
│   │       │
│   │       ├── hooks/                          # ADAPTADORES PRIMARIOS (Orquestación / TanStack Query)
│   │       ├── features/                       # ADAPTADORES PRIMARIOS (Pantallas, pasos y componentes por módulo)
│   │       └── shared/
│   │           └── ui/                         # Componentes visuales reutilizables basados en motion-kit
│   │
│   └── mobile/                                 # App Android (Kotlin + Jetpack Compose, MVVM)
│
├── packages/
│   └── design-tokens/                          # Fuente única de color y tokens Material 3 (Web + Android)
│
├── supabase/                                   # Fuente única de verdad de Base de Datos y Seguridad
│   ├── config.toml                             # Configuración local del CLI
│   ├── migrations/                             # Esquema SQL, triggers, vistas, RPCs y políticas RLS
│   ├── functions/                              # Edge Functions (Deno)
│   ├── seed.sql                                # Datos sintéticos de desarrollo y cuentas por rol
│   └── doc-supabase/                           # Contratos técnicos de BD, RPCs, RLS y LGPDPPSO
│
└── docs/                                       # Alcance, requerimientos, estándares y ADRs
```

### 2.2 Dirección de dependencias en `apps/admin`

```text
features/ y shared/ui/ (Presentación)
        │
        ▼
hooks/ (Aplicación / TanStack Query)
        │
        ▼
domain/ports/ ──▶ domain/models/   ◀── NÚCLEO (no importa nada externo)
        ▲
        │ implementa
infrastructure/supabase/adapters/ ──▶ client.ts + database.types.ts
```

---

## 3. Reglas obligatorias de desarrollo

Todo cambio que toque `apps/admin` o `supabase/` debe cumplir las siguientes reglas antes de integrarse a `develop`:

### Regla 1 — Ley de dependencia entre capas
- **`domain/` es puro:** Prohibido importar React, TanStack Query, `@supabase/supabase-js`, `motion-kit` o `database.types.ts` dentro de `domain/`.
- **Aislamiento del SDK:** Prohibido importar `infrastructure/supabase/client.ts` o `database.types.ts` desde `features/`, `hooks/` o `shared/ui/`. Solo `infrastructure/supabase/adapters/` conoce a Supabase.
- **Sin `snake_case` hacia arriba:** Ningún tipo de fila SQL (`Database['public']['Tables'][...]`) puede cruzar hacia `hooks/` o `features/`.

### Regla 2 — Contratos de Puertos y Adaptadores
- Por cada puerto `src/domain/ports/<Nombre>Repository.ts` existe su implementación `src/infrastructure/supabase/adapters/Supabase<Nombre>Repository.ts`.
- El adaptador traduce `snake_case` ↔ `camelCase` (extrayendo a `<nombre>.mapper.ts` si el mapeo crece).
- Prohibido `select('*')` por defecto: proyectar únicamente las columnas requeridas y paginar listados con `.range()` o `.limit()`.
- Operaciones transaccionales multi-tabla, métricas agregadas sin PII o consultas con auditoría obligatoria (ej. `get_umeca_citas`, `get_mapa_calor_asentamiento`, `buscar_pre_registro_por_curp`, `registrar_consulta`) deben consumirse vía `supabase.rpc()`.
- El adaptador hace `throw error` ante fallos de Supabase para que TanStack Query gestione `isError` / `error` de forma uniforme.

### Regla 3 — Orquestación de estado servidor (`hooks/`)
- Las lecturas y mutaciones asíncronas viven en `hooks/` usando **TanStack Query** (`useQuery`, `useMutation`, `invalidateQueries`), nunca con `fetch`/promesas manuales dentro de `useEffect` en componentes visuales.

### Regla 4 — Seguridad, variables de entorno y privacidad (RLS-First)
- **Separación de entornos:**
  - `apps/admin/.env` contiene únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (llave pública). **Jamás** colocar `service_role` en el frontend.
  - `supabase/` se administra vía Supabase CLI (`supabase login`, `supabase link`, `supabase db push`), nunca haciendo cambios manuales permanentes en el dashboard web sin migración en `supabase/migrations/`.
- **Datos sintéticos y cero PII en logs:** Prohibido subir datos reales o imprimir información sensible de usuarias/expedientes en `console.*`.

### Regla 5 — Sistema de diseño y modularidad
- Usar componentes de `@yewdiel21/motion-kit/react` importando solo el CSS modular del componente usado.
- Usar exclusivamente tokens semánticos en Tailwind v4 (`bg-primary`, `bg-surface-container`, `text-on-surface`, `border-outline-variant`, `bg-error-container`); prohibido usar colores fijos de la paleta base (`bg-purple-500`, `text-gray-700`, etc.) para no romper el modo oscuro.
- Mantener archivos pequeños y con una sola responsabilidad (dividir formularios extensos como Ficha Única en subcomponentes por paso).

### Regla 6 — Sincronización de tipos y verificación previa al merge a `develop`
- Cada vez que cambie una migración o RPC en `supabase/migrations/`, regenerar `src/infrastructure/supabase/database.types.ts` (`npm run gen:types -w @violet-code/admin` o `--linked`).
- Nunca editar `database.types.ts` manualmente.
- Antes de hacer `merge` a `develop` y `push`, deben pasar en verde las pruebas y validaciones locales (`npm run lint -w @violet-code/admin`, `npm run build -w @violet-code/admin` y `supabase test db` si hubo cambios en BD).

---

## 4. Consecuencias

### Positivas
- **Trabajo en paralelo:** Frontend puede definir un modelo y puerto en `domain/` y avanzar pantallas con un adaptador *fake* mientras se termina una migración o RPC.
- **Seguridad tipada de punta a punta:** Si una columna o RPC cambia en PostgreSQL, `gen:types` + `tsc -b` detectan el desajuste en el adaptador en tiempo de compilación, sin romper componentes visuales.
- **Sustituibilidad:** Si algún flujo requiere pasar por una Edge Function o por `apps/core` (.NET), solo se reemplaza el adaptador secundario sin reescribir `domain/`, `hooks/` ni `features/`.

### Costos / Mitigación
- Introduce una capa explícita de mapeo (`snake_case` → `camelCase`) por repositorio. Se mitiga manteniendo modelos concisos orientados a los casos de uso del MVP y evitando abstracciones genéricas innecesarias.
