# Sprint 02 Supabase · Cuerpo de cada tarea para Notion

Base de todas: `docs/estandar-servicios-y-rpcs.md` y `supabase/doc-supabase/sprints/sprint-02-supabase.md`. Rama `feat/supabase-<slug>` desde `develop`. Carriles: **A · Expediente y canalizaciones** y **B · Seguimiento y usuarias de la app**. **Hecho (todas):** `db push` OK, `database.types.ts` regenerado, `supabase test db` en verde (las de la tarea y las del Sprint 01), `db reset` desde cero OK, contrato en `doc-supabase/rpcs/<rpc>.md` y entrada en `doc-supabase/api/<modulo>.md`.

Propiedades al crear cada tarjeta: título tal cual (con prefijo `[Supabase]`), Status **Sin empezar**, sin responsable.

---

**1. [Supabase] Agregar claves de permiso del Sprint 02 y glosario de nombres de negocio** (va primero)
- Incluye: en `tiene_permiso()` las claves `canalizacion.crear` (TS), `expediente.reabrir` (Titular y Subdirección) y `seguimiento.corregir` (Dirección y áreas; la regla "lo propio y el mismo día" va en B-04); se conservan todas las anteriores. Glosario en `esquema-y-rpcs.md` y `api/README.md` (canalización = `derivacion`, folio de seguimiento = `atencion`); tabla de claves en `roles-y-permisos.md`.
- Migración: `20261127000100_32_permisos_sprint02.sql`
- Archivos: migración, `roles-y-permisos.md`, `esquema-y-rpcs.md`, `api/README.md`, `tests/32_permisos_sprint02.test.sql`
- Hecho cuando: cada clave nueva da lo esperado para los 6 roles, y `false` sin sesión, con empleado inactivo y para UMECA; las claves del Sprint 01 no cambian.

**2. [Supabase] Restringir a Trabajo Social la creación de canalizaciones con RPC crear_canalizacion** (carril A)
- Incluye: `crear_canalizacion(p_ficha_id, p_destino, p_area_destino_id, p_institucion_id, p_institucion_otra, p_motivo)`; el área de origen sale de la sesión; valida expediente activo y no archivado y el destino (reusa `validar_derivacion_area`); RN-03 devuelve `aviso` sin bloquear (por confirmar); `derivacion_insert` en `with check (false)`. Si A-02 ya está en `develop`, inserta el primer evento del historial.
- Migración: `_33_rpc_crear_canalizacion.sql` · Permiso: `canalizacion.crear`
- Archivos: migración, `tests/33_crear_canalizacion.test.sql`, `rpcs/crear_canalizacion.md`, `api/derivaciones.md`
- Hecho cuando: TS crea; Dirección, Psicología y Jurídico reciben `42501`; destino interno sin área da `23514`; el `insert` directo falla.

**3. [Supabase] Guardar historial de cambios de estado de cada canalización por expediente** (carril A)
- Incluye: tabla `canalizacion_evento` de solo inserción (RLS de lectura igual a `derivacion_select`) con evento inicial para las existentes; `cambiar_estado_derivacion` escribe un evento por cambio y exige nota al concluir o cancelar; `get_derivaciones` y `cambiar_estado_derivacion` pasan a `tiene_permiso`; nueva `get_historial_canalizaciones(p_ficha_id)`; `get_linea_tiempo` (1.ª parte) muestra los eventos.
- Migración: `_34_historial_canalizaciones.sql` · Permiso: `derivacion.gestionar`
- Archivos: migración, `tests/34_historial_canalizaciones.test.sql`, `rpcs/get_historial_canalizaciones.md`, `rpcs/cambiar_estado_derivacion.md`, `api/derivaciones.md`
- Hecho cuando: cada cambio deja evento; concluir sin nota da `23514`; Psicología solo ve el historial de sus canalizaciones.

**4. [Supabase] Crear RPC actualizar_persona y actualizar_ficha con bloqueo optimista** (carril A)
- Incluye: `actualizar_persona` (sin cambiar CURP, sexo, fecha ni entidad de nacimiento) y `actualizar_ficha` (incluye servicios solicitados; sin cambiar folio, persona ni estado); expediente archivado da `23514`; `p_actualizado_en` viejo da `23505`; `null` = no cambiar. Trigger de bitácora propio para `ficha_servicio_solicitado`, que también cubre el `delete` de `crear_ficha_completa`.
- Migración: `_35_rpc_editar_persona_y_ficha.sql` · Permiso: `expediente.escribir`
- Archivos: migración, `tests/35_editar_persona_ficha.test.sql`, `rpcs/actualizar_persona.md`, `rpcs/actualizar_ficha.md`, `api/expedientes.md`
- Hecho cuando: Psicología da `42501`; archivado `23514`; edición con fecha vieja `23505`; la CURP no cambia; quitar un servicio deja bitácora.

**5. [Supabase] Crear RPC guardar_agresor y desactivar_agresor** (carril A)
- Incluye: `guardar_agresor` crea (id nulo) o edita con bloqueo optimista, con las validaciones de parentesco "otro", consumo y expediente activo; `desactivar_agresor(p_agresor_id, p_motivo)` no deja desactivar si hay orden de protección vigente.
- Migración: `_36_rpc_guardar_agresor.sql` · Permiso: `agresor.acceder`
- Archivos: migración, `tests/36_guardar_agresor.test.sql`, `rpcs/guardar_agresor.md`, `rpcs/desactivar_agresor.md`, `api/expedientes.md`
- Hecho cuando: Recepción da `42501`; crear y editar funcionan; fecha vieja `23505`; desactivar con orden vigente `23514`.

**6. [Supabase] Crear RPC de historial clínico y registrar_estudio_socioeconomico como nueva versión** (carril A)
- Incluye: `guardar_historial_clinico` (crea o edita, mayoría de edad RN-01) y `get_historial_clinico` con `'ver'` en bitácora; `registrar_estudio_socioeconomico` crea un estudio nuevo y deja el anterior como no actual; si ya hay uno de hoy de la misma persona, lo corrige (por confirmar).
- Migración: `_37_rpc_historial_clinico_y_estudio.sql` · Permisos: `historial_clinico.acceder`, `expediente.escribir`
- Archivos: migración, `tests/37_historial_estudio.test.sql`, `rpcs/guardar_historial_clinico.md`, `rpcs/get_historial_clinico.md`, `rpcs/registrar_estudio_socioeconomico.md`, `api/expedientes.md`
- Hecho cuando: TS no accede al historial clínico (`42501`); leer deja bitácora; un estudio nuevo deja el anterior como no actual.

**7. [Supabase] Guardar motivo en archivar_ficha y crear RPC reabrir_ficha** (carril A)
- Incluye: columnas de archivo y reapertura en `ficha_registro` (motivo, fecha y quién); `archivar_ficha` guarda el motivo (obligatorio); `reabrir_ficha(p_ficha_id, p_motivo)` solo desde `archivado`, regresa a `en_seguimiento` si tiene atenciones o a `abierto` si no. `get_expediente_detalle` no se toca.
- Migración: `_38_archivar_y_reabrir.sql` · Permisos: `expediente.escribir`, `expediente.reabrir`
- Archivos: migración, `tests/38_archivar_reabrir.test.sql`, `rpcs/archivar_ficha.md`, `rpcs/reabrir_ficha.md`, `api/expedientes.md`
- Hecho cuando: archivar sin motivo da `23514`; TS no reabre (`42501`); reabrir regresa al estado correcto.

**8. [Supabase] Cerrar la edición directa del expediente en RLS y dejar solo las RPC** (carril A, va al último)
- Incluye: `insert`/`update` en `with check (false)` para `persona`, `ficha_registro`, `ficha_servicio_solicitado`, `agresor`, `historial_clinico`, `estudio_socioeconomico` y `aportante_hogar`; los `select` no cambian; `crear_ficha_completa` sigue funcionando. Depende de las tareas 4, 5 y 6.
- Migración: `_39_cierre_rls_edicion.sql`
- Archivos: migración, `tests/39_cierre_rls.test.sql`, `api/tablas-directas.md`
- Hecho cuando: el `update` directo falla en cada tabla y las RPC siguen funcionando. **Se integra a `develop` cuando front confirme** que ya no usa `.from().update()` (`SupabaseAgresorRepository`, `SupabaseFichaRepository.deactivate`).

**9. [Supabase] Exigir asistencia a una cita del día para crear el folio de seguimiento** (carril B)
- Incluye: `registrar_seguimiento` con `p_cita_id` obligatorio; la cita debe estar agendada o confirmada, ser de la persona del expediente, del área del actor y de hoy (`America/Mazatlan`); si la persona llega sin cita, se crea la cita en el momento (por confirmar).
- Migración: `_40_seguimiento_con_asistencia.sql` · Permiso: `seguimiento.registrar`
- Archivos: migración, `tests/40_seguimiento_asistencia.test.sql`, `rpcs/registrar_seguimiento.md`, `api/atencion.md`
- Hecho cuando: sin cita, con cita de ayer o de mañana, o de otra área da `23514`; la cita pasa a `asistio`.

**10. [Supabase] Generar folio único de seguimiento en servidor con formato provisional** (carril B, después de la 9)
- Incluye: columna `atencion.folio_seguimiento` única con secuencia propia; `generar_folio_seguimiento()` con formato provisional `SEG-AAAA-NNNNN` (el definitivo solo cambia esta función); folio para las filas existentes y después `not null`; `registrar_seguimiento` lo devuelve. ⏸ Formato definitivo pendiente de negocio.
- Migración: `_41_folio_seguimiento.sql`
- Archivos: migración, `tests/41_folio_seguimiento.test.sql`, `rpcs/registrar_seguimiento.md`, `api/atencion.md`
- Hecho cuando: cada folio nuevo trae número, es único y el front no lo puede mandar.

**11. [Supabase] Crear RPC get_contexto_seguimiento con datos mínimos para el formulario** (carril B)
- Incluye: `get_contexto_seguimiento(p_cita_id)` solo para citas del área del actor y de hoy, con `'ver'` en bitácora. Devuelve nombre, edad, folio del expediente, si es primera vez en el área, último folio de seguimiento del área con su próxima acción, si tiene orden vigente y, solo para Psicología, si tiene historial clínico. Nunca CURP, estudio socioeconómico, agresor ni notas de otras áreas.
- Migración: `_42_rpc_contexto_seguimiento.sql` · Permiso: `seguimiento.registrar`
- Archivos: migración, `tests/42_contexto_seguimiento.test.sql`, `rpcs/get_contexto_seguimiento.md`, `api/atencion.md`
- Hecho cuando: cita de otra área o de otro día da `23514`; la salida no trae CURP.

**12. [Supabase] Crear RPC corregir_seguimiento y dejar de copiar datos generales en cada folio** (carril B, después de la 10)
- Incluye: `corregir_seguimiento(p_atencion_id, p_actualizado_en, …)`: quien lo creó y el mismo día, o Dirección en cualquier momento (solo bitácora, sin valor anterior); `registrar_seguimiento` deja de copiar estado civil, ocupación, celular y domicilio (por confirmar); `insert`/`update` directos de `atencion` en `with check (false)`.
- Migración: `_43_corregir_seguimiento.sql` · Permiso: `seguimiento.corregir`
- Archivos: migración, `tests/43_corregir_seguimiento.test.sql`, `rpcs/corregir_seguimiento.md`, `api/atencion.md`
- Hecho cuando: otra persona del área da `42501`; al día siguiente `42501` salvo Dirección; un folio nuevo ya no trae la copia.

**13. [Supabase] Separar cuentas de empleadas y usuarias de la app con app_metadata** (carril B, antes de la 14 y la 15)
- Incluye: trigger en el alta de `auth.users` con `tipo = 'usuaria_app'` por defecto; cuentas existentes marcadas como `empleado` o `externo`; `es_usuaria_app()`; `es_empleado_activo()` además exige `tipo = 'empleado'`; seed con el tipo de cada usuario.
- Migración: `_44_tipos_de_cuenta.sql`
- Archivos: migración, `seeds/44_tipos_cuenta.sql`, `tests/44_tipos_cuenta.test.sql`, `api/app-movil.md`, `roles-y-permisos.md`
- Hecho cuando: una cuenta de la app con fila falsa en `empleado` no pasa `es_empleado_activo()`; las pruebas del Sprint 01 siguen en verde.

**14. [Supabase] Crear RPC registrar_mi_perfil, get_mi_estado_app y desactivar_mi_cuenta** (carril B)
- Incluye: `registrar_mi_perfil` solo para usuarias de la app, con aviso de privacidad obligatorio y **la liga automática por CURP como está hoy**; `get_mi_estado_app()` (tiene perfil, puede enviar alertas, alertas de la última hora; nunca si está ligada a un expediente); `desactivar_mi_cuenta()`; `pre_registro_insert` en `with check (false)`.
- Migración: `_45_rpc_perfil_usuaria_app.sql` · Permiso: `es_usuaria_app()` y propiedad por `auth.uid()`
- Archivos: migración, `tests/45_perfil_app.test.sql`, `rpcs/registrar_mi_perfil.md`, `rpcs/get_mi_estado_app.md`, `rpcs/desactivar_mi_cuenta.md`, `api/app-movil.md`
- Hecho cuando: una empleada no registra perfil (`42501`); ninguna salida trae `persona_id` ni `estado`; desactivar impide enviar alertas. Avisar al equipo móvil.

**15. [Supabase] Crear RPC enviar_alerta con límite por hora y endurecer configuración de Auth** (carril B)
- Incluye: `enviar_alerta(p_asentamiento_id)` con pre-registro activo tomado de la sesión y límite de 3 por hora (por confirmar); la usuaria ya no inserta directo en `alerta` y el personal con `alerta.atender` sí. En `config.toml`: confirmación de correo activa y contraseña mínima de 8; documentar lo mismo para el proyecto remoto.
- Migración: `_46_rpc_enviar_alerta_y_auth.sql` · Permiso: `es_usuaria_app()`
- Archivos: migración, `config.toml`, `tests/46_enviar_alerta.test.sql`, `rpcs/enviar_alerta.md`, `api/alertas.md`, `api/app-movil.md`
- Hecho cuando: la cuarta alerta en una hora da `23514`; el `insert` directo de la usuaria falla; el personal sigue registrando alertas por teléfono. Avisar al equipo móvil.

**16. [Supabase] Pasar agenda y alertas a tiene_permiso y mostrar folio y archivo en la línea de tiempo** (carril B, después de la 3)
- Incluye: `get_agenda`, `cambiar_estado_cita`, `reagendar_cita`, `get_lista_urgencias`, `get_cola_alertas`, `tomar_alerta` y `atender_alerta` cambian `e.rol in (...)` por `tiene_permiso`, sin tocar el filtro de área; `get_linea_tiempo` (2.ª parte) muestra el folio de seguimiento y los eventos de archivo y reapertura si las tareas 10 y 7 ya entraron.
- Migración: `_47_tiene_permiso_agenda_alertas.sql` · Permisos: `agenda.ver`, `agenda.gestionar`, `urgencias.ver`, `alerta.ver_cola`, `alerta.atender`
- Archivos: migración, `tests/47_tiene_permiso_agenda.test.sql`, `api/README.md`, `api/agenda.md`, `api/alertas.md`
- Hecho cuando: el resultado por rol es idéntico al Sprint 01 (correr también las pruebas `22_`, `23_` y `24_`).

---

**Fuera del sprint (no crear tarjeta):** liga automática por CURP (riesgo aceptado el 26-nov), historial de valores anteriores, aviso a Recepción de canalizaciones, corrección de CURP, borrado de cuentas de Auth y todo el trabajo de `apps/admin` y la app Kotlin.
