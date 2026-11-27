# Sprint 03 · Adapters del admin listos para todas las RPC

Objetivo: que `apps/admin/src/infrastructure/supabase/adapters/` tenga un método para **cada** RPC del admin y que ninguno escriba directo en tablas cerradas. **No** se conecta nada nuevo al front: no se tocan `features/`, `hooks/` ni componentes.

Inventario y estado de cada RPC: [`../api/estado-rpcs.md`](../api/estado-rpcs.md). Contrato de cada RPC: `../rpcs/<rpc>.md`.

## Reglas (todas las tareas)

- Rama desde `develop`: `feat/front-adapters-<slug>`. Un responsable: Angel.
- Solo se tocan estos lugares:
  - `apps/admin/src/infrastructure/supabase/adapters/*`
  - `apps/admin/src/infrastructure/supabase/database.types.ts`
  - `apps/admin/src/domain/ports/*` (firmas nuevas)
  - `apps/admin/src/domain/models/*` (tipos de entrada y salida)
- Patrón a copiar: `adapters/SupabaseActividadPreventivaRepository.ts` + `domain/ports/ActividadPreventivaRepository.ts` + `domain/models/ActividadPreventiva.ts`.
  - Método en camelCase y en español.
  - Parámetros `p_*` desde un input camelCase.
  - `if (error) throw mapSupabaseError(error)` (de `adapters/errors.ts`).
  - Mapear la fila a un modelo del dominio en un `*.mapper.ts` si pasa de unas 10 líneas.
- No cambiar la firma pública de los métodos existentes. Si algo no se puede resolver sin tocar `features/`, marcarlo con `/** @deprecated <motivo> */`.
- **Hecho (todas):** en `apps/admin`, `npx tsc -b` sin errores y `npm run lint` sin errores nuevos. Cero `.insert/.update` sobre `persona`, `ficha_registro`, `agresor`, `historial_clinico`, `estudio_socioeconomico`, `derivacion`, `atencion`, `domicilio` y `cita`. Actualizar la columna "Admin" de `estado-rpcs.md`.

## Tareas

| # | Tarea | Archivos principales | RPC |
|---|---|---|---|
| 1 | Base: tipos, errores y doc | `database.types.ts`, `adapters/errors.ts`, `SupabaseAgresorRepository.ts`, `api/tablas-directas.md` | — |
| 2 | Corregir escrituras directas rotas | `SupabaseAgresorRepository.ts`, `SupabaseCitaRepository.ts`, `SupabaseSeguimientoRepository.ts`, `SupabaseFichaRepository.ts`, `seguimiento.mapper.ts`, `models/Cita.ts` | `guardar_agresor`, `desactivar_agresor`, `crear_cita`, `reagendar_cita`, `get_agenda`, `get_lista_urgencias` |
| 3 | Edición de expediente e historial clínico | `SupabaseFichaRepository.ts`, nuevo `SupabaseHistorialClinicoRepository.ts`, ports y models | `actualizar_persona`, `actualizar_ficha`, `actualizar_domicilio`, `cambiar_prioridad_expediente`, `registrar_estudio_socioeconomico`, `get_historial_clinico`, `guardar_historial_clinico` |
| 4 | Seguimiento, canalizaciones y mapa | `SupabaseSeguimientoRepository.ts`, `SupabaseDerivacionRepository.ts`, `SupabaseDashboardRepository.ts`, ports y models | `get_contexto_seguimiento`, `corregir_seguimiento`, `get_historial_canalizaciones`, `get_mapa_calor_asentamiento` |

Orden: 1 → 2 → (3 y 4 en cualquier orden). El texto de cada tarjeta está en [`sprint-03-notion-tareas.md`](./sprint-03-notion-tareas.md).

## Fuera de alcance

- Conectar los métodos nuevos a pantallas o hooks.
- `deactivate` de ficha (no hay RPC; queda `@deprecated`) y el `motivo` de archivar en `features/expedientes/api.ts:147`.
- RPC pendientes sin migración: `get_canalizaciones_por_agendar` y `generar_codigo_vinculacion`.
- RPC de la app de usuarias.
