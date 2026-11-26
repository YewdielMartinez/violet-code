# Estándar de Arquitectura Hexagonal y Modularidad (`apps/admin`)

Guía práctica para mantener `apps/admin` limpio, modular y fácil de entender durante todo el desarrollo, sin imponer bloqueos rígidos ni burocracia innecesaria.

---

## 1. Arquitectura Hexagonal (Puertos y Adaptadores)

En `apps/admin` se sigue el principio de **Puertos y Adaptadores** documentado en [`apps/admin/src/infrastructure/supabase/adapters/README.md`](../apps/admin/src/infrastructure/supabase/adapters/README.md): el dominio y las pantallas no dependen directamente de Supabase ni del transporte HTTP.

### Capas y responsabilidades

| Capa | Ubicación en `apps/admin/src/` | Responsabilidad | Qué puede importar |
|---|---|---|---|
| **Dominio (Modelos)** | `domain/models/` | Tipos del negocio en `camelCase` (`Expediente`, `Cita`, `Alerta`, etc.) y reglas o validaciones puras | Solo otros módulos de `domain/` |
| **Dominio (Puertos)** | `domain/ports/` | Interfaces/contratos (`<Nombre>Repository`) que declaran qué operaciones necesita la app sin decir cómo se resuelven | Solo `domain/models/` |
| **Infraestructura (Adaptadores)** | `infrastructure/supabase/adapters/` | Implementa cada puerto (`Supabase<Nombre>Repository.ts`) usando `supabase.from()` / `supabase.rpc()`, traduce filas `snake_case` (`database.types.ts`) ↔ modelos `camelCase` y lanza los errores de Supabase | `../client`, `../database.types.ts`, `domain/` |
| **Aplicación (Hooks / Casos de uso)** | `hooks/` o `features/<modulo>/api.ts` | Hooks de TanStack Query, caché, invalidación de queries, estados de carga/error y orquestación entre puertos | `domain/` y el adaptador correspondiente |
| **Presentación (UI)** | `features/<modulo>/` y `shared/ui/` | Páginas, secciones, formularios y widgets con `@yewdiel21/motion-kit` + Tailwind CSS v4 | `domain/models/`, hooks/`api.ts` y componentes UI |

### Regla principal de frontera

```text
features/<modulo> (UI) ──▶ hooks / api.ts (TanStack Query) ──▶ domain/ports (<Nombre>Repository)
                                                                          ▲
                                                                          │ implementa
infrastructure/supabase/adapters/Supabase<Nombre>Repository.ts ───────────┴──▶ supabase/client + database.types.ts
```

- **Nunca importar `infrastructure/supabase/client` ni `database.types.ts` desde `features/`, `hooks/` o `shared/ui/`.**
- Un archivo por puerto (`Supabase<Nombre>Repository.ts` implementando `<Nombre>Repository`).
- El adaptador devuelve modelos de dominio en `camelCase` y **lanza** (`throw error`) el error de Supabase para que TanStack Query lo maneje de forma uniforme en la UI.
- Si en el futuro un módulo cambia de Supabase directo a `.NET` o a un stub de pruebas, solo cambia el adaptador; `domain/` y `features/` permanecen intactos.

---

## 2. Criterios de tamaño y modularidad (guía orientativa)

> Estos rangos **no son límites forzados ni reglas bloqueantes de build/lint**. Son señales prácticas para detectar a tiempo cuándo un archivo está acumulando demasiadas responsabilidades y conviene dividirlo.

| Tipo de archivo | Rango sugerido | Señal para revisar / dividir | Cómo dividirlo si crece |
|---|---|---|---|
| **Modelos y Puertos** (`domain/`) | `30 – 100` líneas | Más de un agregado o entidad no relacionada | Separar 1 entidad o 1 puerto por archivo |
| **Adaptadores** (`adapters/`) | `80 – 150` líneas | Consultas largas mezcladas con mucha transformación de campos | Extraer mapeos `snake_case ↔ camelCase` a un `<nombre>.mapper.ts` en la misma carpeta |
| **Hooks / API** (`hooks/`, `api.ts`) | `50 – 120` líneas | Demasiados hooks o lógica compleja de formularios/filtros | Separar queries/mutations por subflujo o extraer hook de formulario (`useFichaForm.ts`) |
| **Páginas y Componentes** (`features/`, `shared/ui/`) | Objetivo `<= 150 – 200` líneas | Se acerca o supera `250 – 300` líneas | Dividir por pasos/secciones (ej. `FichaIdentidadStep.tsx`, `FichaDomicilioStep.tsx`) o extraer diálogos/tablas a subcomponentes |

### Excepciones explícitas

No aplican criterios de longitud a archivos generados o declarativos de esquema:
- `apps/admin/src/infrastructure/supabase/database.types.ts` (autogenerado con `supabase gen types`)
- Migraciones SQL en `supabase/migrations/`
- Datos semilla en `supabase/seed.sql`

### Señales concretas de que conviene refactorizar un archivo

Más allá del número de líneas, conviene separar un archivo si aparece cualquiera de estos síntomas:
1. Un componente de UI hace mapeos de `snake_case`, construye queries o conoce nombres de tablas de BD.
2. Una página de formulario multi-paso (ej. Ficha Única: CURP + Domicilio + Estudio Socioeconómico + Agresor) concentra todos los pasos y validaciones en un solo TSX.
3. Un mismo componente mezcla estado complejo de pantalla + varios diálogos/modales independientes.
4. Dos módulos duplican columnas, helpers de formato o componentes base que deberían vivir en `shared/ui/` o `domain/`.

---

## 3. Estándar de UI, estilos y librerías

Todo el código de presentación en `apps/admin` debe seguir también [`docs/guia-motion-kit-frontend.md`](./guia-motion-kit-frontend.md):
- Usar `@yewdiel21/motion-kit/react` para componentes complejos e interactivos, importando el CSS modular por componente en el archivo que lo usa (nunca `@yewdiel21/motion-kit/css` completo).
- Usar Tailwind CSS v4 únicamente con los tokens semánticos del tema (`bg-primary`, `bg-surface-container-low`, `text-on-surface`, `border-outline-variant`, `bg-error-container`, etc.), sin colores por defecto de Tailwind.
- Definir configuraciones constantes (`COLUMNS`, opciones estáticas, acciones) fuera del componente React.

---

## 4. Estrategia de pruebas

Aprovechando la separación hexagonal y el ritmo de entrega, las pruebas se enfocan en **alto retorno y bajo mantenimiento** en 4 niveles:

| Nivel | Qué se prueba | Herramienta | Cuándo / Prioridad |
|---|---|---|---|
| **1. Estático (obligatorio)** | Tipado estricto con TypeScript 7 (Go) contra `database.types.ts`, reglas Oxlint y bundle de producción | `npm run lint -w @violet-code/admin` + `npm run build -w @violet-code/admin` (`tsc -b && vite build`) | En cada cambio antes de hacer commit |
| **2. Unitarias puras (mayor ROI)** | Validaciones de `domain/` (CURP, transiciones de estado, reglas de negocio), mappers `snake_case ↔ camelCase` y hooks con **repositorios fake en memoria** de `domain/ports/` | **Vitest** | En toda lógica de dominio y adaptadores |
| **3. Componentes críticos** | Solo flujos sensibles: guards por rol (`RequireAuth`), búsqueda y precarga por CURP, validaciones de Ficha Única y transiciones de Citas/Alertas | **Vitest + `@testing-library/react` + `jsdom`** | Solo en flujos críticos del MVP |
| **4. Integración / Smoke E2E** | Recorrido de los 5 flujos de [`docs/flujo-operativo-mvp.md`](./flujo-operativo-mvp.md) contra Supabase local (`supabase db reset` + `seed.sql`) usando las cuentas reales del seed (`trabajo.social`, `recepcion`, `psicologia`, `titular`, `umeca`) | Verificación manual guiada (o **Playwright** al cerrar el MVP) | Al cerrar cada módulo conectado a BD |

### Qué no probar durante el hackathon

- Animaciones, estilos o comportamiento interno de `@yewdiel21/motion-kit` (la librería ya mantiene su propia suite de pruebas).
- *Snapshots* grandes de JSX (se rompen ante ajustes visuales menores y no detectan bugs reales de negocio).

---

## 5. Checklist rápido antes de integrar un módulo

- [ ] Ningún archivo en `features/`, `hooks/` o `shared/` importa `supabase/client` ni expone `snake_case` de la BD.
- [ ] El puerto vive en `domain/ports/` y su implementación en `infrastructure/supabase/adapters/Supabase<Nombre>Repository.ts`.
- [ ] Cada archivo tiene una responsabilidad clara (página, paso/sección, diálogo, hook de datos, adaptador o modelo).
- [ ] Las vistas importan únicamente el CSS modular de los componentes de `motion-kit` que utilizan y respetan los tokens semánticos del tema.
- [ ] No hay datos reales de usuarias ni logs con información sensible en consola o red.
- [ ] `npm run lint -w @violet-code/admin` y `npm run build -w @violet-code/admin` pasan en verde, y el flujo se probó con el rol correspondiente del seed.
