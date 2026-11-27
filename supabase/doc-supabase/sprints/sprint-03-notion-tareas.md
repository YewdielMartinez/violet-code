# Sprint 03 · Cuerpo de cada tarea para Notion

Leer antes que nada: [`sprint-03-adapters-rpc.md`](./sprint-03-adapters-rpc.md) (reglas, patrón y criterio de hecho común). Rutas relativas a `apps/admin/src/`. Contratos: `supabase/doc-supabase/rpcs/<rpc>.md`.

Propiedades de cada tarjeta: título tal cual (con prefijo `[Front]`), Status **Sin empezar**, responsable Angel.

---

**1. [Front] Regenerar tipos de Supabase y centralizar el manejo de errores en adapters** (va primero)
- Incluye:
  - Regenerar `infrastructure/supabase/database.types.ts` con `npm run gen:types`, que necesita `supabase start`. Hoy le faltan 14 RPC, por ejemplo `crear_canalizacion`, `guardar_agresor` y `crear_cita`.
  - Crear `infrastructure/supabase/adapters/errors.ts` con `mapSupabaseError(error)`, moviéndolo desde `SupabaseAgresorRepository.ts`. Traduce los códigos de [`api/errores.md`](../api/errores.md) (`42501`, `23514`, `23505`, `40001`, `P0001`) a `Error` con mensaje en español.
  - Que `SupabaseAgresorRepository.ts` lo importe.
  - En `supabase/doc-supabase/api/tablas-directas.md`, corregir `derivacion` (alta solo por `crear_canalizacion`, cerrado en `33`) y `atencion` (solo `registrar_seguimiento` y `corregir_seguimiento`, cerrado en `43`).
- Archivos: `database.types.ts`, `adapters/errors.ts`, `adapters/SupabaseAgresorRepository.ts`, `api/tablas-directas.md`.
- Hecho cuando:
  - `database.types.ts` tiene todas las RPC de `estado-rpcs.md` §1.
  - `npx tsc -b` está limpio.
  - `mapSupabaseError` existe una sola vez.

**2. [Front] Cambiar a RPC las escrituras directas que hoy fallan en agresor, citas y seguimiento** (después de la 1)
- Incluye:
  - `SupabaseAgresorRepository`:
    - `crear` y `actualizar` llaman a [`guardar_agresor`](../rpcs/guardar_agresor.md) (`actualizadoEnEsperado` → `p_actualizado_en`).
    - Método nuevo `desactivar(id, actualizadoEn)` con [`desactivar_agresor`](../rpcs/desactivar_agresor.md).
  - `SupabaseCitaRepository`:
    - `crear` llama a [`crear_cita`](../rpcs/crear_cita.md) (`p_persona_id, p_area_id, p_programada_en, p_recomendada_por, p_origen`) y ya no manda `prioridad`.
    - `reagendar` deja de mandar `p_prioridad`.
    - El mapeo de [`get_agenda`](../rpcs/get_agenda.md) y [`get_lista_urgencias`](../rpcs/get_lista_urgencias.md) se ajusta a la salida actual: sin `prioridad` en la cita y con `prioridad_actualizada_en`.
    - Los campos `prioridad` de `models/Cita.ts` se vuelven opcionales con `@deprecated`.
  - `SupabaseSeguimientoRepository`: se borra `guardarCopiaHoja` y sus mappers (`toDomicilioHistoricoInsert`, `toAtencionCopiaUpdate`). `registrar` solo llama a `registrar_seguimiento`.
  - `SupabaseFichaRepository.deactivate`: se marca `@deprecated` porque no hay RPC y la RLS lo bloquea (`42501`). No se borra.
- Archivos: `adapters/SupabaseAgresorRepository.ts`, `agresor.mapper.ts`, `adapters/SupabaseCitaRepository.ts`, `adapters/SupabaseSeguimientoRepository.ts`, `seguimiento.mapper.ts`, `adapters/SupabaseFichaRepository.ts`, `domain/ports/AgresorRepository.ts`, `domain/models/Cita.ts`.
- Hecho cuando:
  - `grep -nE "\.(insert|update)\(" adapters/` solo muestra `orden_proteccion`, `documento`, `nota_area`, `empleado` y `usuario_externo`, más `ficha_registro` en `deactivate`.
  - Ninguna llamada `rpc(...)` manda `p_prioridad` salvo `registrar_seguimiento`.
  - `npx tsc -b` está limpio.

**3. [Front] Agregar a los adapters la edición del expediente y el historial clínico** (después de la 1)
- Incluye métodos nuevos en `SupabaseFichaRepository`, con su firma en `domain/ports/FichaRepository.ts` y sus tipos en `domain/models/`:
  - `actualizarPersona(input)` → [`actualizar_persona`](../rpcs/actualizar_persona.md)
  - `actualizar(input)` → [`actualizar_ficha`](../rpcs/actualizar_ficha.md)
  - `actualizarDomicilio(input)` → [`actualizar_domicilio`](../rpcs/actualizar_domicilio.md)
  - `cambiarPrioridad(fichaId, prioridad)` → [`cambiar_prioridad_expediente`](../rpcs/cambiar_prioridad_expediente.md)
  - `registrarEstudioSocioeconomico(input)` → [`registrar_estudio_socioeconomico`](../rpcs/registrar_estudio_socioeconomico.md)
- Nuevo adapter `SupabaseHistorialClinicoRepository.ts`, con port `domain/ports/HistorialClinicoRepository.ts` y modelo `domain/models/HistorialClinico.ts`:
  - `obtener(fichaId)` → [`get_historial_clinico`](../rpcs/get_historial_clinico.md)
  - `guardar(input)` → [`guardar_historial_clinico`](../rpcs/guardar_historial_clinico.md)
- En las RPC con `p_actualizado_en`, el input lleva `actualizadoEn` (bloqueo optimista). Un `null` significa "no cambiar".
- Archivos: los nombrados arriba, más `domain/models/Persona.ts`, `FichaRegistro.ts`, `Domicilio.ts` y `EstudioSocioeconomico.ts` para los inputs.
- Hecho cuando:
  - Hay 7 métodos nuevos tipados con `database.types.ts`, sin `as unknown`.
  - `npx tsc -b` está limpio.
  - No hay cambios en `features/`.

**4. [Front] Agregar a los adapters el contexto y la corrección de seguimiento, el historial de canalizaciones y el mapa de calor** (después de la 1)
- Incluye:
  - `SupabaseSeguimientoRepository`:
    - `contexto(citaId)` → [`get_contexto_seguimiento`](../rpcs/get_contexto_seguimiento.md). Es nuevo: no se reemplaza el método actual que lee 3 tablas.
    - `corregir(input)` → [`corregir_seguimiento`](../rpcs/corregir_seguimiento.md)
  - `SupabaseDerivacionRepository`: `historialCanalizaciones(fichaId)` → [`get_historial_canalizaciones`](../rpcs/get_historial_canalizaciones.md)
  - `SupabaseDashboardRepository`: `mapaCalor(umbralMinimo = 3)` → `get_mapa_calor_asentamiento(p_umbral_minimo int)`. Devuelve `asentamiento_id, codigo_postal, nombre, tipo_asentamiento, municipio, estado, latitud, longitud, total_expedientes, total_alertas, total_actividades` y no tiene contrato en `rpcs/`.
  - Firmas en `domain/ports/SeguimientoRepository.ts`, `DerivacionRepository.ts` y `DashboardRepository.ts`; tipos en `domain/models/HojaSeguimiento.ts`, `Derivacion.ts` y `Dashboard.ts`.
- Archivos: los nombrados arriba.
- Hecho cuando:
  - Hay 4 métodos nuevos.
  - `npx tsc -b` está limpio.
  - En `estado-rpcs.md` ya no queda ningún ❌ en la columna Admin.
