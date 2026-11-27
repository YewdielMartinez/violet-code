# Definition of Done (DoD) — Violet Code (SEMUJERES)

Criterios mínimos verificables para considerar una tarjeta del Kanban como **Listo**. Toda entrega debe cumplir la sección **General**, la sección de **Seguridad y Privacidad**, las secciones del **área que toca** y **Documentación y Cierre**.

---

## 1. DoD General (aplica a toda tarjeta)

- [ ] Cumple todos los criterios de aceptación de la tarjeta y las reglas de [`docs/requerimientos-y-reglas.md`](./requerimientos-y-reglas.md) / [`docs/flujo-operativo-mvp.md`](./flujo-operativo-mvp.md).
- [ ] Código limpio y legible: sin código muerto, bloques comentados sin uso, `console.log` de depuración ni archivos temporales.
- [ ] Sin cambios fuera del alcance de la tarjeta (por ejemplo, no modificar `package-lock.json` si no se agregaron/actualizaron dependencias).
- [ ] Commits siguiendo Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`) en rama de trabajo integrada en `develop` (nunca push directo a `main`).
- [ ] Tarjeta movida al estado correspondiente en el Kanban de Notion (`En progreso` → `Listo`).

---

## 2. DoD Backend de Datos / Supabase (`supabase/`)

- [ ] Todo cambio de esquema, RPC, trigger o política se agrega en una **nueva migración SQL** numerada en `supabase/migrations/` (no editar migraciones ya compartidas salvo acuerdo explícito).
- [ ] Políticas **RLS activas y verificadas por rol** bajo principio de mínimo privilegio (`Titular`, `Subdirección`, `Trabajo Social`, `Psicología`, `Jurídico`, `Recepción`, `UMECA`, `Usuaria App`), alineadas con [`supabase/doc-supabase/roles-y-permisos.md`](../supabase/doc-supabase/roles-y-permisos.md) y [`supabase/doc-supabase/seguridad-y-privacidad.md`](../supabase/doc-supabase/seguridad-y-privacidad.md).
- [ ] `npx supabase db reset` ejecuta sin errores de punta a punta aplicando todas las migraciones y [`supabase/seed.sql`](../supabase/seed.sql) (con datos 100% sintéticos).
- [ ] Tipos TypeScript regenerados (`npm run gen:types -w @violet-code/admin`) cuando cambia cualquier tabla, vista, enum o RPC.
- [ ] Documentación actualizada en `supabase/doc-supabase/` ([`esquema-y-rpcs.md`](../supabase/doc-supabase/esquema-y-rpcs.md) y/o [`esquema.dbml`](../supabase/doc-supabase/esquema.dbml)) si cambian contratos, tablas o RPCs.

---

## 3. DoD Frontend Web (`apps/admin`)

- [ ] Respeta las fronteras hexagonales de [`docs/estandar-frontend-arquitectura.md`](./estandar-frontend-arquitectura.md): `features/`, `hooks/` y `shared/` **no** importan `infrastructure/supabase/client` ni manipulan directamente columnas `snake_case` de la BD.
- [ ] Sigue [`docs/guia-motion-kit-frontend.md`](./guia-motion-kit-frontend.md):
  - Usa `@yewdiel21/motion-kit/react` con **CSS modular por componente** (nunca el bundle completo `@yewdiel21/motion-kit/css`).
  - Usa Tailwind CSS v4 exclusivamente con **tokens semánticos del tema** (`bg-primary`, `bg-surface-container-low`, `text-on-surface`, `border-outline-variant`, etc.), verificando modo **claro y oscuro**.
  - Configuraciones constantes (`COLUMNS`, opciones, acciones) declaradas fuera del cuerpo del componente.
- [ ] Cubre todos los estados reales de UI: carga (`Skeleton` / `LoadingButton`), vacío (`EmptyState`), error (`toast` / reintento) y visibilidad/acciones según el rol autenticado.
- [ ] `npm run lint -w @violet-code/admin` y `npm run build -w @violet-code/admin` (`tsc -b && vite build`) terminan con código de salida `0` sin errores.

---

## 4. DoD App Móvil (`apps/mobile`)

- [ ] `./gradlew test assembleDebug --no-daemon` pasa en verde en `apps/mobile`.
- [ ] Usa los tokens de color sincronizados desde `packages/design-tokens` (`VioletColors.kt`).
- [ ] Flujos críticos probados (registro/autenticación, botón de ayuda/alerta y directorio offline) sin registrar datos sensibles en Logcat.

---

## 5. DoD Pruebas y Validación

- [ ] Pruebas unitarias en verde para toda lógica nueva de dominio, validaciones (CURP, transiciones de estado, reglas de prioridad) y mappers (`snake_case ↔ camelCase`), siguiendo la estrategia de [`docs/estandar-frontend-arquitectura.md`](./estandar-frontend-arquitectura.md#4-estrategia-de-pruebas).
- [ ] Smoke test end-to-end del flujo afectado ejecutado contra Supabase local (`supabase db reset` + `seed.sql`) usando las cuentas sintéticas del rol correspondiente (`trabajo.social`, `recepcion`, `psicologia`, `titular`, `umeca`, `usuaria.app`).
- [ ] Cuando la tarea modifica permisos, consultas o endpoints con datos sensibles, verificación negativa explícita de que un rol no autorizado **no** puede leer ni modificar registros que no le corresponden (RLS / autorización).

---

## 6. DoD Seguridad, Privacidad (LGPDPPSO) y Datos *(no negociable)*

- [ ] **Cero datos reales** de usuarias (nombres, CURP, teléfonos, domicilios, casos clínicos o jurídicos) en código, migraciones, seeds, pruebas, capturas o demos.
- [ ] **Cero secretos** (`.env`, `service_role` keys, tokens, contraseñas reales) en el repositorio; nuevas variables documentadas únicamente en `.env.example`.
- [ ] **Cero PII en logs** (consola del navegador, Edge/Postgres logs o Logcat).
- [ ] **Resiliencia, concurrencia y sesiones:** cumple [`docs/resiliencia-concurrencia-sesiones.md`](./resiliencia-concurrencia-sesiones.md) (`retry: false` en mutaciones, CAS/bloqueo optimista en actualizaciones concurrentes, sin PII en `localStorage`/`sessionStorage`, fechas en `America/Mazatlan` y manejo estándar de errores `23505`/`42501`/`P0001`).

---

## 7. DoD Documentación y Cierre

- [ ] Documentación del monorepo actualizada si la tarea cambió flujo operativo, esquema, contratos de API, arquitectura o variables de entorno.
- [ ] Verificaciones ejecutadas después de la última edición (build, lint, tests, `supabase db reset` según corresponda) y cambios integrados/subidos a la rama acordada.
- [ ] Tarjeta en Notion actualizada a **Listo** con resumen breve de lo implementado y verificado.
