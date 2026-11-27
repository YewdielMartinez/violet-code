# 04 · Arquitectura preliminar

> [!WARNING]
> **DEPRECADO / SUPERADO (2026-11-26):** Este documento recoge la propuesta preliminar previa a la adopción oficial de **Supabase (PostgreSQL 17, RLS RBAC+ABAC, RPCs, Auth, Storage y Realtime)**. El componente `apps/core` (`ASP.NET Core Web API` / `EF Core`) fue retirado del monorepo. Consulta la arquitectura vigente en [ADR-0003](../adr/0003-arquitectura-hexagonal-admin-supabase.md) y [esquema-y-rpcs.md](../../supabase/doc-supabase/esquema-y-rpcs.md).

## 1. Vista de contexto

```
┌──────────────┐      HTTPS/JSON + FCM       ┌──────────────────────────────┐      HTTPS/JSON + SignalR      ┌───────────────────┐
│ Usuaria      │ ─────────────────────────►  │  Violet Code Core            │ ◄────────────────────────────  │ Personal SEMUJERES│
│ Android app  │ ◄───── push (neutro) ─────  │  ASP.NET Core Web API        │ ───── alertas en vivo ───────► │ Admin (React)     │
└──────────────┘                             │  (monolito modular)          │                                └───────────────────┘
       │ tel:911 (llamada nativa)            └──────────────┬───────────────┘
       ▼                                                    │
   911 / emergencias (fuera del sistema)              PostgreSQL (Docker)
```

**Principio:** el 911 queda fuera del sistema y se invoca con la marcación nativa del teléfono. Violet Code no promete rescate.

## 2. Backend — Violet Code Core

### Recomendación: Monolito modular + Clean Architecture "ligera"

| Opción | Pros | Contras | Veredicto para 5 días |
|---|---|---|---|
| Microservicios | Escala independiente | Overhead enorme (red, despliegue, consistencia) | **Descartado** |
| Monolito en capas clásico | Rápido | Módulos se acoplan, difícil separar después | Aceptable pero frágil |
| **Monolito modular** | Un despliegue, un proceso, una BD; límites claros por módulo; extraíble a servicios después | Requiere disciplina de límites | **Recomendado** |
| Clean Architecture completa (4 proyectos × módulo) | Testeable, puro | Demasiada ceremonia para 5 días | **Solo en forma ligera** |

**Forma propuesta:**

```
apps/core/
  src/
    VioletCode.Api/                 # Host: Program.cs, auth, middlewares, SignalR hubs, Swagger
    VioletCode.SharedKernel/        # Result, errores, IClock, IAuditLog, abstracciones comunes
    Modules/
      VioletCode.Modules.Identity/       # Autenticación + Gestión de usuarios
      VioletCode.Modules.Alerts/         # Alertas de auxilio
      VioletCode.Modules.Cases/          # Solicitudes, Expedientes, Intervenciones, Canalizaciones, Seguimiento
      VioletCode.Modules.Scheduling/     # Agenda (si entra al MVP)
      VioletCode.Modules.Catalogs/       # Directorio, Puntos Violeta, tipos, áreas
      VioletCode.Modules.Notifications/  # FCM, SignalR, (SMS futuro)
      VioletCode.Modules.Analytics/      # Lecturas agregadas (solo lectura)
      VioletCode.Modules.Audit/          # Bitácora append-only
  tests/
```

Dentro de cada módulo, Clean Architecture **por carpetas, no por proyectos**:

```
Modules.Cases/
  Domain/          # Entidades, value objects, reglas (sin dependencias)
  Application/     # Casos de uso (comandos/consultas), puertos
  Infrastructure/  # EF Core DbContext del módulo (schema propio), adaptadores
  Endpoints/       # Minimal APIs o controllers del módulo
```

**Reglas de límites:**
- Cada módulo tiene su **schema** de PostgreSQL (`cases.*`, `alerts.*`, `identity.*`, `audit.*`).
- Un módulo no lee tablas de otro; se comunica por interfaz pública del módulo o eventos en proceso (in-memory, p. ej. `AlertCreated` → Notifications, Audit).
- Analytics es la única excepción: lecturas de solo lectura sobre vistas agregadas.

### Candidatos técnicos (Propuesta)

| Tema | Propuesta | Alternativa | Decidir tras |
|---|---|---|---|
| Runtime | .NET 10 LTS | .NET 9 | Equipo |
| ORM | EF Core + Npgsql, migraciones por módulo | Dapper para Analytics | — |
| Tiempo real | SignalR (Admin) | Polling 5 s (si falla) | Q-27 |
| Push móvil | FCM, payload sin contenido sensible | Solo polling al abrir | Q-51 |
| Auth personal | ASP.NET Identity + JWT corto + refresh; 2FA TOTP deseable | — | Q-42/Q-43 |
| Auth usuaria | Teléfono + OTP simulado en demo / anónimo para orientación | — | Q-08 |
| Autorización | Roles + políticas por recurso (área, asignación) | — | Q-23 |
| Validación | FluentValidation | DataAnnotations | — |
| Documentación API | OpenAPI → cliente TS generado para Admin | Manual | — |
| Archivos | Fuera del MVP o volumen Docker cifrado | S3 compatible | Q-16 |

## 3. Admin — React + TypeScript

| Tema | Propuesta |
|---|---|
| Build | Vite + React 18/19 + TypeScript estricto |
| UI | **motion-kit** (`@yewdiel21/motion-kit/react`) + tema `violet` de `@violet-code/design-tokens` |
| Estructura | **Feature-sliced**: `src/features/{alerts,requests,cases,interventions,referrals,schedule,stats,users,audit}` + `src/shared` |
| Datos | TanStack Query sobre cliente OpenAPI generado |
| Tiempo real | `@microsoft/signalr` → invalida queries de alertas/solicitudes |
| Estado UI | Local / Zustand si hace falta |
| Rutas | React Router con guardas por rol |
| Seguridad | Token en memoria + refresh en cookie httpOnly; cierre por inactividad |

## 4. Mobile — Kotlin + Jetpack Compose

### MVVM + Clean Architecture ligera

| Capa | Contenido |
|---|---|
| `ui/` | Pantallas Compose + `ViewModel` (StateFlow de UI state, eventos unidireccionales) |
| `domain/` | Casos de uso solo donde haya lógica (enviar alerta, crear solicitud) |
| `data/` | Repositorios, Retrofit/Ktor, Room (directorio/orientación offline), DataStore cifrado |

**Por qué MVVM:** es el patrón nativo de Compose + Jetpack ViewModel; el equipo lo conoce; encaja con estado reactivo. MVI completo es más ceremonia sin beneficio claro en 5 días.

**Modularización:** un solo módulo `:app` con paquetes por feature (`auxilio`, `solicitudes`, `orientacion`, `directorio`, `puntos`, `seguimiento`, `seguridad`). Multi-módulo Gradle = **Futuro**.

**Tema:** `VioletColors.kt` generado desde los mismos tokens que el Admin.

**Requisitos de seguridad de la usuaria (Propuesta):** salida rápida (gesto/botón que cierra y limpia la pila), PIN/biometría, `FLAG_SECURE` en pantallas sensibles, sin datos sensibles en notificaciones ni en logs, almacenamiento cifrado.

## 5. Datos — PostgreSQL

- Una instancia, **un schema por módulo**.
- IDs `uuid` (v7) — no exponer IDs secuenciales; folio legible aparte.
- Campos sensibles (notas de intervención, datos de contacto) candidatos a **cifrado a nivel de columna** (pgcrypto o cifrado en aplicación). Decidir tras Q-48.
- `audit.events` append-only (sin UPDATE/DELETE para el rol de la app).
- Semillas **sintéticas** (Bogus) — nunca datos reales.

Modelo conceptual preliminar (por validar con Q-14, Q-19, Q-20, Q-66):

```
Usuaria 1─N Solicitud ─0..1→ Expediente 1─N Intervención N─1 Profesional N─1 Área
Usuaria 1─N Alerta     ─0..1→ Expediente
Expediente 1─N Canalización N─1 Instancia(catálogo)
Expediente 1─N Cita N─1 Profesional
Expediente 1─N CambioDeEstado
* ─→ EventoDeAuditoría
```

## 6. Infraestructura

```
infra/
  docker-compose.yml   # postgres + core (+ admin estático) para demo local/servidor
```

- Contenedores: `postgres:17`, `violet-core` (multi-stage .NET), `violet-admin` (build Vite servido por nginx o desde Core).
- Secretos vía `.env` (no versionado) — `.env.example` sí versionado.
- HTTPS en demo vía proxy (Caddy) si se expone públicamente.
- Destino de despliegue real: **pendiente** (Q-52, Q-53).

## 7. Monorepo

```
/
├─ apps/
│  ├─ admin/            React + TS (npm workspace)
│  ├─ mobile/           Android (Gradle, fuera de npm workspaces)
│  └─ core/             ASP.NET Core (dotnet sln, fuera de npm workspaces)
├─ packages/
│  └─ design-tokens/    Tema violet (motion-kit) → CSS + JSON + Kotlin
├─ infra/               Docker Compose
└─ docs/                Discovery, arquitectura, ADRs, registro
```

Ver [ADR-0001](../adr/0001-monorepo.md).

## 8. Seguridad y privacidad desde el diseño (checklist preliminar)

- [ ] Minimización: solo campos que SEMUJERES confirme como necesarios.
- [ ] Consentimiento informado y aviso de privacidad en la app antes de enviar datos.
- [ ] TLS en todo; HSTS en Admin.
- [ ] Contraseñas con hash (Identity/PBKDF2 o Argon2); bloqueo por intentos.
- [ ] Autorización por recurso, no solo por rol (ver solo casos asignados/área).
- [ ] Auditoría de **lecturas** de expedientes, no solo escrituras.
- [ ] Notificaciones push sin contenido sensible.
- [ ] Logs sin datos personales.
- [ ] Datos sintéticos únicamente; ningún dato real en repositorio, capturas ni demo.
- [ ] Modelo de amenazas breve (agresor con acceso al teléfono, personal curioso, fuga de BD).

## 9. Decisiones abiertas

| ID | Decisión | Bloqueada por |
|---|---|---|
| D-01 | ¿Auxilio notifica en tiempo real a SEMUJERES o solo prioriza 911 y registra? | Q-26, Q-27 |
| D-02 | Modelo de cuenta de usuaria (anónima / OTP / ambas) | Q-08 |
| D-03 | Matriz de visibilidad entre áreas | Q-23 |
| D-04 | Adjuntos en MVP sí/no | Q-16 |
| D-05 | Destino de despliegue | Q-52, Q-53 |
| D-06 | Uso de FCM / servicios nube | Q-51 |
| D-07 | Módulos Agenda / Canalizaciones / Puntos Violeta en MVP | Q-24, Q-32, Q-65 |

Registro vivo en [../discovery/registro/decisiones-pendientes.md](../discovery/registro/decisiones-pendientes.md).
