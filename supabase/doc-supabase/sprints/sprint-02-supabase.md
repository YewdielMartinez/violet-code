# Sprint 02 · Supabase: canalizaciones, folio de seguimiento, edición del expediente y usuarias de la app

SEMUJERES Ahome · Violet Code · **Solo backend Supabase** (migraciones, RPC, RLS, seeds, pruebas SQL y documentación de base de datos). No incluye trabajo de `apps/admin` ni de la app móvil.

**Origen:** [`backlog-canalizaciones-y-folio-seguimiento.md`](./backlog-canalizaciones-y-folio-seguimiento.md) y [`backlog-edicion-expediente-y-usuarias-app.md`](./backlog-edicion-expediente-y-usuarias-app.md), con las decisiones de Angel del 26-nov:

- Solo Trabajo Social crea canalizaciones a otras áreas, y cada canalización guarda su historial.
- El folio de seguimiento se crea solo con asistencia, sin duplicar datos y exponiendo lo mínimo. Lleva folio único; **el formato queda pendiente** (se usa uno provisional).
- **No** se guarda historial de valores anteriores; se conserva la bitácora de quién y cuándo.
- La liga automática del pre-registro de la app con el expediente por CURP **se queda como está** (riesgo conocido, §7).

## 0. Base del sprint

**Estándar obligatorio:** [`docs/estandar-servicios-y-rpcs.md`](../../../docs/estandar-servicios-y-rpcs.md). Igual que el Sprint 01:

- **§1 Git:** una rama por tarea desde `develop` (`feat/supabase-<slug>`), Conventional Commits (`feat(supabase): …`) y se integra a `develop` solo con el DoD en verde.
- **§2 Cuándo usar RPC:** escrituras en 2 o más tablas, listados con joins o filtros, detalle de expediente y cambios de estado. **En este sprint también toda edición del expediente** (Parte A del backlog).
- **§3.1 Numeración:** cada tarea ya trae su número y timestamp (tabla 3). Arrancan en `_32_` (la última es `_31_hardening_rls_e_indices`).
- **§3.2 Plantilla de RPC:** `plpgsql`, `security definer`, `set search_path = public`, alias en todas las tablas, `revoke … from public, anon` y `grant … to authenticated`, `tiene_permiso('<clave>')` (nunca `e.rol in (...)`), errores `42501`, `23514` y `23505` con mensajes en español.
- **§3.3 Tipos:** después de cada migración, `npx supabase gen types typescript --linked > apps/admin/src/infrastructure/supabase/database.types.ts`.
- **§4 Contrato de 4 puntos** en `supabase/doc-supabase/rpcs/<nombre_rpc>.md`, y la entrada correspondiente en `supabase/doc-supabase/api/<modulo>.md`.

**Equipo:** 2 devs, sin responsable fijo. Cada quien toma la siguiente tarea libre de un carril y la pasa a **En progreso** en Notion antes de crear la rama.

**Carriles:**
- **A · Expediente y canalizaciones** (A-01 a A-07).
- **B · Seguimiento y usuarias de la app** (B-01 a B-08).

**Nombres (glosario, P-02):** en la base no se renombra nada. *Canalización* = `derivacion`. *Folio de seguimiento* (documento de cada asistencia) = `atencion`.

---

## 1. Permisos del sprint

| Clave | Roles | La usa |
|---|---|---|
| `canalizacion.crear` 🆕 | Solo TS | A-01 |
| `derivacion.gestionar` (existe) | Dirección, TS, Psic, Jur (filas por área en el `where`) | A-02 |
| `expediente.escribir` (existe) | Dirección, TS | A-03, A-05, A-06 |
| `expediente.reabrir` 🆕 | Titular, Subdirección (**por confirmar**, §6) | A-06 |
| `agresor.acceder` (existe) | Dirección, TS, Psic, Jur | A-04 |
| `historial_clinico.acceder` (existe) | Dirección, Psic | A-05 |
| `seguimiento.registrar` (existe) | TS, Psic, Jur | B-01, B-02, B-03 |
| `seguimiento.corregir` 🆕 | TS, Psic, Jur (lo propio, el mismo día) y Dirección (cualquiera) | B-04 |
| `agenda.ver`, `agenda.gestionar`, `urgencias.ver`, `alerta.ver_cola`, `alerta.atender` (existen) | Como en Sprint 01 | B-08 |
| Usuaria de la app | Fuera de `empleado.rol`: propiedad por `auth.uid()` y `es_usuaria_app()` (B-05) | B-06, B-07 |

Solo **P-02** modifica `tiene_permiso()`. Solo **B-05** modifica `es_empleado_activo()`.

---

## 2. Cómo se garantiza que las tareas vayan en paralelo

| Riesgo de choque | Regla |
|---|---|
| Mismo número de migración | Cada tarea tiene su número (tabla 3). Si una llega antes que otra de número menor: `npx supabase db push --include-all`. |
| Dos tareas redefinen la misma función | Cada función y política tiene un solo dueño (tabla 3). Las tres excepciones van **en orden dentro del mismo carril**: `registrar_seguimiento` (B-01 → B-02 → B-04) y `get_linea_tiempo` (A-02 → B-08). |
| `database.types.ts` | Se regenera después del `git rebase develop`; nunca se resuelve a mano. |
| Seeds | Cada tarea en su propio `supabase/seeds/<NN>_<tema>.sql`. |
| Pruebas | Cada tarea en su propio `supabase/tests/<NN>_<tema>.test.sql`. |
| Docs | Cada RPC en su propio `doc-supabase/rpcs/<rpc>.md`. La entrada en `doc-supabase/api/<modulo>.md` la agrega la tarea dueña del módulo (tabla 3). |

**Dependencias:**
- **P-02 va primero** (corta).
- Carril A: **A-07 va al final** (cierra RLS de lo que hacen A-03, A-04 y A-05).
- Carril B: B-01 → B-02 → B-04 (misma función). **B-05 antes que B-06 y B-07.** B-08 después de que A-02 esté en `develop`.
- **Bloqueo de negocio:** B-03 y la parte "quitar copia" de B-04 necesitan la lista de campos del folio de seguimiento (§6, decisión 1). Si no llega, se implementan con la propuesta por defecto que trae cada tarea.

---

## 3. Tablero de tareas

| ID | Carril | Migración asignada | Objetos que toca (dueño exclusivo) | Doc API |
|---|---|---|---|---|
| P-02 | — (primero) | `20261127000100_32_permisos_sprint02.sql` | `tiene_permiso()` (3 claves), glosario en `esquema-y-rpcs.md` y `api/README.md` | `api/README.md` |
| A-01 | A | `20261127000200_33_rpc_crear_canalizacion.sql` | `crear_canalizacion()`, política `derivacion_insert` | `api/derivaciones.md` |
| A-02 | A | `20261127000300_34_historial_canalizaciones.sql` | tabla `canalizacion_evento`, `cambiar_estado_derivacion()`, `get_derivaciones()`, `get_historial_canalizaciones()`, `get_linea_tiempo()` (1.ª parte) | `api/derivaciones.md` |
| A-03 | A | `20261127000400_35_rpc_editar_persona_y_ficha.sql` | `actualizar_persona()`, `actualizar_ficha()`, `crear_ficha_completa()`, trigger de bitácora de `ficha_servicio_solicitado` | `api/expedientes.md` |
| A-04 | A | `20261127000500_36_rpc_guardar_agresor.sql` | `guardar_agresor()`, `desactivar_agresor()` | `api/expedientes.md` (sección agresor) |
| A-05 | A | `20261127000600_37_rpc_historial_clinico_y_estudio.sql` | `guardar_historial_clinico()`, `get_historial_clinico()`, `registrar_estudio_socioeconomico()` | `api/tablas-directas.md` → mover a `api/expedientes.md` |
| A-06 | A | `20261127000700_38_archivar_y_reabrir.sql` | columnas de archivo/reapertura en `ficha_registro`, `archivar_ficha()`, `reabrir_ficha()` | `api/expedientes.md` |
| A-07 | A (al final) | `20261127000800_39_cierre_rls_edicion.sql` | políticas `insert`/`update` de `persona`, `ficha_registro`, `ficha_servicio_solicitado`, `agresor`, `historial_clinico`, `estudio_socioeconomico`, `aportante_hogar` | `api/tablas-directas.md` |
| B-01 | B | `20261127000900_40_seguimiento_con_asistencia.sql` | `registrar_seguimiento()` (1.º) | `api/atencion.md` |
| ~~B-02~~ ❌ descartada 27-nov (ver B-09) | B | `20261127001000_41_folio_seguimiento.sql` | columna `atencion.folio_seguimiento`, secuencia y `generar_folio_seguimiento()`, `registrar_seguimiento()` (2.º) | `api/atencion.md` |
| B-03 | B | `20261127001100_42_rpc_contexto_seguimiento.sql` | `get_contexto_seguimiento()` | `api/atencion.md` |
| B-04 | B | `20261127001200_43_corregir_seguimiento.sql` | `corregir_seguimiento()`, `registrar_seguimiento()` (3.º), políticas `insert`/`update` de `atencion` | `api/atencion.md` |
| B-05 | B | `20261127001300_44_tipos_de_cuenta.sql` | trigger en `auth.users`, `es_usuaria_app()`, `es_empleado_activo()` | `api/app-movil.md` |
| B-06 | B | `20261127001400_45_rpc_perfil_usuaria_app.sql` | `registrar_mi_perfil()`, `get_mi_estado_app()`, `desactivar_mi_cuenta()`, política `pre_registro_insert` | `api/app-movil.md` |
| B-07 | B | `20261127001500_46_rpc_enviar_alerta_y_auth.sql` | `enviar_alerta()`, política `alerta_insert`, `[auth]` de `config.toml` | `api/app-movil.md`, `api/alertas.md` |
| B-08 | B (tras A-02) | `20261127001600_47_tiene_permiso_agenda_alertas.sql` | `get_agenda()`, `cambiar_estado_cita()`, `reagendar_cita()`, `get_lista_urgencias()`, `get_cola_alertas()`, `tomar_alerta()`, `atender_alerta()`, `get_linea_tiempo()` (2.ª parte) | `api/README.md` (quitar nota) |
| A-08 | A (agregada 27-nov) | `20261127001700_48_edad_en_expediente.sql` | `calcular_edad()`, `get_expediente_detalle()`, `buscar_expedientes()` | `api/expedientes.md` |
| A-09 | A (agregada 27-nov) | `20261127001800_49_rpc_actualizar_domicilio.sql` | `actualizar_domicilio()`, políticas `insert`/`update` de `domicilio` | `api/expedientes.md`, `api/tablas-directas.md` |
| A-10 | A (agregada 27-nov, tras A-08) | `20261128001000_50_prioridad_en_expediente.sql` | columnas `prioridad` y `prioridad_actualizada_en` en `ficha_registro`, `cambiar_prioridad_expediente()`, `crear_ficha_completa()`, `get_expediente_detalle()`, quitar `cita.prioridad`, `get_agenda()`, `reagendar_cita()` | `api/expedientes.md`, `api/agenda.md` |
| A-11 | A (agregada 27-nov) | `20261128001100_51_rpc_crear_cita.sql` | `crear_cita()`, política `cita_insert` | `api/agenda.md` |
| A-12 | A (agregada 27-nov, tras A-10) | `20261128001200_52_urgencias_por_expediente.sql` | `get_lista_urgencias()`, vista de urgencias de `05_vistas.sql` | `api/agenda.md` |
| A-13 | A (agregada 27-nov, después de la 47) | `20261128001300_53_folio_expediente_sem.sql` | `generar_folio_ficha()`, secuencia `ficha_folio_seq`, folios existentes, `get_agenda()`, `get_historial_clinico()`, `get_historial_canalizaciones()`, `get_linea_tiempo()` y respuestas de las RPC de acción del expediente | `api/expedientes.md`, `api/agenda.md` |
| B-09 | B (agregada 27-nov, después de la 47) | `20261128001400_54_quitar_folio_seguimiento.sql` | columna `atencion.folio_seguimiento`, `generar_folio_seguimiento()`, `registrar_seguimiento()`, `get_contexto_seguimiento()`, `get_linea_tiempo()` | `api/atencion.md` |

---

## 4. Tareas

Formato en Notion: las dos primeras líneas son las propiedades (sin responsable) y el resto es el cuerpo.

---

### P-02

```text
Tarea: [Supabase] Agregar claves de permiso del Sprint 02 y glosario de nombres de negocio
Status: Sin empezar
```

- **Migración `_32_`:** `tiene_permiso()` agrega:
  - `canalizacion.crear` → `trabajo_social`.
  - `expediente.reabrir` → `titular`, `subdireccion`.
  - `seguimiento.corregir` → `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico` (la regla "lo propio y el mismo día" va en el `where` de B-04).
  - Conserva todas las claves anteriores.
- **Documentación:** glosario en `esquema-y-rpcs.md` y en `api/README.md` (canalización = `derivacion`, folio de seguimiento = `atencion`); tabla de claves en `roles-y-permisos.md`.
- **Pruebas:** `tests/32_permisos_sprint02.test.sql`: cada clave nueva para los 6 roles, sin sesión, inactivo y UMECA; las claves del Sprint 01 no cambian.

---

### A-01

```text
Tarea: [Supabase] Restringir a Trabajo Social la creación de canalizaciones con RPC crear_canalizacion
Status: Sin empezar
```

- **Requisitos:** RF-08, RN-01, RN-03, RN-11. Regla de negocio: solo TS canaliza a otras áreas.
- **Migración `_33_`:**
  - `crear_canalizacion(p_ficha_id, p_destino, p_area_destino_id, p_institucion_id, p_institucion_otra, p_motivo)` con `tiene_permiso('canalizacion.crear')`.
  - `area_origen_id` sale de `auth_area_id()`; el front no lo manda.
  - Valida expediente activo y no archivado, destino contra área o institución (reusa el trigger `validar_derivacion_area`, incluida la mayoría de edad).
  - RN-03: si la persona es hombre y el destino no es `juridico` ni externo, devuelve `aviso` en la salida (no bloquea; **por confirmar**, §6).
  - Inserta el primer evento en `canalizacion_evento` **solo si la tabla existe** (A-02 la crea); si A-02 entra después, A-02 agrega ese insert.
  - Política `derivacion_insert` → `with check (false)`: solo se crea por la RPC.
- **Salida:** `derivacion_id`, `estado`, `aviso text | null`.
- **Pruebas:** `tests/33_crear_canalizacion.test.sql`: TS crea; Dirección, Psicología y Jurídico reciben `42501`; el origen siempre es TS; destino interno sin área da `23514`; `insert` directo falla.
- **Contrato:** `rpcs/crear_canalizacion.md`.

---

### A-02

```text
Tarea: [Supabase] Guardar historial de cambios de estado de cada canalización por expediente
Status: Sin empezar
```

- **Requisitos:** RF-08, RF-25. Regla: historial de canalizaciones disponible por expediente.
- **Migración `_34_`:**
  - Tabla `canalizacion_evento` (append-only): `id`, `derivacion_id`, `estado_anterior`, `estado_nuevo`, `nota` (≤ 1000), `creado_por`, `creado_en`. RLS: `select` con la misma regla que `derivacion_select`; sin `insert`/`update`/`delete` directos.
  - Evento inicial para las canalizaciones que ya existen (`estado_anterior = null`).
  - `cambiar_estado_derivacion(p_derivacion_id, p_estado, p_nota)`: escribe un evento por cambio; `p_nota` obligatoria para `concluida` y `cancelada` (`23514`). Pasa a `tiene_permiso('derivacion.gestionar')`.
  - `get_derivaciones`: pasa a `tiene_permiso('derivacion.gestionar')` (mismo resultado por rol).
  - `get_historial_canalizaciones(p_ficha_id)`: canalizaciones del expediente con `eventos jsonb`, mismo filtro de área que `get_derivaciones`.
  - `crear_canalizacion` (A-01): si ya está en `develop`, agregar el insert del primer evento.
  - `get_linea_tiempo` (1.ª parte): agrega los eventos de canalización.
- **Pruebas:** `tests/34_historial_canalizaciones.test.sql`: cada cambio deja evento; concluir sin nota da `23514`; Psicología solo ve historial de las suyas.
- **Contrato:** `rpcs/get_historial_canalizaciones.md`; actualizar `rpcs/cambiar_estado_derivacion.md`.

---

### A-03

```text
Tarea: [Supabase] Crear RPC actualizar_persona y actualizar_ficha con bloqueo optimista
Status: Sin empezar
```

- **Requisitos:** RF-01, RN-08, RN-15.1.
- **Migración `_35_`:**
  - `actualizar_persona(p_persona_id, p_actualizado_en, …)` con `expediente.escribir`. Campos: nombres, apellidos, celular, escolaridad, discapacidad, grupo étnico, religión. **No** cambia CURP, sexo, fecha ni entidad de nacimiento, `activo`.
  - `actualizar_ficha(p_ficha_id, p_actualizado_en, …)` con `expediente.escribir`. Campos de ficha (estado civil, ocupación, hijos, embarazo, denuncia, consumo, servicio médico) y `p_servicios_solicitados_area_ids`. **No** cambia folio, persona, estado, aviso, `activo`.
  - Reglas comunes: expediente archivado → `23514` "Reabre el expediente para editarlo"; `p_actualizado_en` distinto → `23505` "Este registro fue modificado por otra persona. Recarga los datos."; `null` = no cambiar, `''` = borrar opcional.
  - Servicios solicitados: hoy la tabla no tiene `id` ni `activo`, así que `registrar_cambio()` no le sirve. Agregar trigger propio de bitácora (`insert`/`delete`, `registro_id = ficha_id || ':' || area_id`). Aplica también al `delete` que hace `crear_ficha_completa` al reutilizar una ficha incompleta.
- **Pruebas:** `tests/35_editar_persona_ficha.test.sql`: Psicología da `42501`; archivado `23514`; `actualizado_en` viejo `23505`; la CURP no cambia; quitar un servicio deja bitácora.
- **Contratos:** `rpcs/actualizar_persona.md`, `rpcs/actualizar_ficha.md`.

---

### A-04

```text
Tarea: [Supabase] Crear RPC guardar_agresor y desactivar_agresor
Status: Sin empezar
```

- **Requisitos:** RF-05, RN-15.1.
- **Migración `_36_`:**
  - `guardar_agresor(p_agresor_id, p_ficha_id, p_actualizado_en, …)` con `agresor.acceder`: `p_agresor_id = null` crea; si no, edita con bloqueo optimista. Valida parentesco "otro", consumo y drogas, expediente activo y no archivado.
  - `desactivar_agresor(p_agresor_id, p_motivo)`: `activo = false`; `23514` si tiene orden de protección vigente ligada.
- **Pruebas:** `tests/36_guardar_agresor.test.sql`: Recepción `42501`; crear y editar; `actualizado_en` viejo `23505`; desactivar con orden vigente `23514`.
- **Contratos:** `rpcs/guardar_agresor.md`, `rpcs/desactivar_agresor.md`.

---

### A-05

```text
Tarea: [Supabase] Crear RPC de historial clínico y registrar_estudio_socioeconomico como nueva versión
Status: Sin empezar
```

- **Requisitos:** RF-10, RN-01, RN-09.
- **Migración `_37_`:**
  - `guardar_historial_clinico(p_ficha_id, p_actualizado_en, …)` con `historial_clinico.acceder`: crea si no existe, edita si existe; mayoría de edad (RN-01).
  - `get_historial_clinico(p_ficha_id)`: lectura con `'ver'` en bitácora.
  - `registrar_estudio_socioeconomico(p_ficha_id, …, p_aportantes jsonb)` con `expediente.escribir`: crea un estudio nuevo con `fecha_estudio = hoy`, marca el anterior `es_actual = false`. Si existe uno de hoy creado por la misma persona, lo corrige en lugar de crear otro (**por confirmar**, §6).
- **Pruebas:** `tests/37_historial_estudio.test.sql`: TS no accede al historial (`42501`); leer deja bitácora; un estudio nuevo deja el anterior como no actual.
- **Contratos:** `rpcs/guardar_historial_clinico.md`, `rpcs/get_historial_clinico.md`, `rpcs/registrar_estudio_socioeconomico.md`.

---

### A-06

```text
Tarea: [Supabase] Guardar motivo en archivar_ficha y crear RPC reabrir_ficha
Status: Sin empezar
```

- **Requisitos:** RN-15, RN-15.1.
- **Migración `_38_`:**
  - Columnas en `ficha_registro`: `motivo_archivo`, `archivada_en`, `archivada_por`, `motivo_reapertura`, `reabierta_en`, `reabierta_por`.
  - `archivar_ficha`: guarda motivo (obligatorio, `23514` si vacío), fecha y quién.
  - `reabrir_ficha(p_ficha_id, p_motivo)` con `expediente.reabrir`: solo desde `archivado`; pasa a `en_seguimiento` si tiene atenciones, si no a `abierto`.
  - `get_expediente_detalle` **no** se toca; los campos nuevos los muestra `get_linea_tiempo` en B-08.
- **Pruebas:** `tests/38_archivar_reabrir.test.sql`: archivar sin motivo `23514`; TS no reabre (`42501`); reabrir regresa al estado correcto.
- **Contratos:** actualizar `rpcs/archivar_ficha.md`; nuevo `rpcs/reabrir_ficha.md`.

---

### A-07

```text
Tarea: [Supabase] Cerrar la edición directa del expediente en RLS y dejar solo las RPC
Status: Sin empezar
```

- **Depende de:** A-03, A-04 y A-05 en `develop`.
- **Migración `_39_`:** políticas `insert`/`update` en `with check (false)` para `persona`, `ficha_registro`, `ficha_servicio_solicitado`, `agresor`, `historial_clinico`, `estudio_socioeconomico` y `aportante_hogar`. Los `select` no cambian. `crear_ficha_completa` sigue funcionando (es `security definer`).
- ⚠️ **Romperá el front** donde todavía edite con `.from().update()` (hoy `SupabaseAgresorRepository` y `SupabaseFichaRepository.deactivate`). Se programa y prueba en paralelo, pero se integra a `develop` cuando front confirme.
- **Pruebas:** `tests/39_cierre_rls.test.sql`: `update` directo falla para cada tabla con un rol que antes podía; las RPC siguen funcionando.
- **Docs:** `api/tablas-directas.md`: quitar esas tablas de "escritura directa".

---

### B-01

```text
Tarea: [Supabase] Exigir asistencia a una cita del día para crear el folio de seguimiento
Status: Sin empezar
```

- **Requisitos:** RF-09, RN-13. Regla: el folio de seguimiento es un registro de asistencia.
- **Migración `_40_`:** `registrar_seguimiento`:
  - `p_cita_id` obligatorio (`23514`).
  - La cita debe estar `agendada` o `confirmada`, ser de la persona del expediente y del área del actor, y ser de **hoy** en `America/Mazatlan` (`23514`).
  - Persona que llega sin cita: se crea la cita en el momento (con `insert` en `cita`) y luego se registra (**por confirmar**, §6).
- **Pruebas:** `tests/40_seguimiento_asistencia.test.sql`: sin cita `23514`; cita de ayer o de mañana `23514`; cita de otra área `23514`; la cita pasa a `asistio`.
- **Contrato:** actualizar `rpcs/registrar_seguimiento.md`.

---

### B-02

> ❌ **Descartada el 27-nov por Angel:** el seguimiento no lleva folio. Ya estaba hecha en `origin/supabase` (#89, migración 41); se deshace en B-09.

```text
Tarea: [Supabase] Generar folio único de seguimiento en servidor con formato provisional
Status: Sin empezar
```

- **Depende de:** B-01 (misma función).
- **Migración `_41_`:**
  - Columna `atencion.folio_seguimiento text unique`; secuencia propia.
  - `generar_folio_seguimiento(p_ficha_id, p_area_id)`: **formato provisional** `SEG-AAAA-NNNNN`. Cambiar el formato definitivo solo toca esta función.
  - Folio para las filas existentes; después `not null`.
  - `registrar_seguimiento` lo genera y lo devuelve en la salida (`folio_seguimiento`).
- ⏸ **Pendiente de negocio:** formato definitivo (§6, decisión 2).
- **Pruebas:** `tests/41_folio_seguimiento.test.sql`: se genera, es único, el front no lo puede mandar.

---

### B-03

```text
Tarea: [Supabase] Crear RPC get_contexto_seguimiento con datos mínimos para el formulario
Status: Sin empezar
```

- **Requisitos:** RNF-02. Regla: exponer lo mínimo; obtener la información a partir de la asistencia.
- **Migración `_42_`:** `get_contexto_seguimiento(p_cita_id)` con `seguimiento.registrar`. Solo si la cita es del área del actor y de hoy. Registra `'ver'` en bitácora.
- **Salida por defecto** (hasta que negocio defina la lista, §6 decisión 1): `nombre_completo`, `edad`, `folio` del expediente, `es_primera_vez_area`, último `folio_seguimiento` del área con su `proxima_accion`, `tiene_orden_vigente`, `tiene_historial_clinico` (solo Psicología). **Nunca** CURP, estudio socioeconómico, datos del agresor ni notas de otras áreas.
- **Pruebas:** `tests/42_contexto_seguimiento.test.sql`: cita de otra área o de otro día `23514`; la salida no trae CURP.
- **Contrato:** `rpcs/get_contexto_seguimiento.md`.

---

### B-04

```text
Tarea: [Supabase] Crear RPC corregir_seguimiento y dejar de copiar datos generales en cada folio
Status: Sin empezar
```

- **Depende de:** B-02 (misma función).
- **Migración `_43_`:**
  - `corregir_seguimiento(p_atencion_id, p_actualizado_en, p_acciones_realizadas, p_proxima_accion, p_observaciones, p_prioridad)` con `seguimiento.corregir`: quien lo creó, el mismo día; Dirección, cualquiera. Sin guardar el valor anterior (solo bitácora).
  - `registrar_seguimiento` (3.º): deja de llenar `estado_civil`, `ocupacion_id`, `ocupacion_otra`, `celular` y `domicilio_id` (las columnas se quedan con lo ya guardado y se marcan obsoletas en el comentario de la tabla). **Por confirmar** con la decisión 1 de §6.
  - Políticas `insert`/`update` de `atencion` en `with check (false)`: solo por RPC.
- **Pruebas:** `tests/43_corregir_seguimiento.test.sql`: otra persona del área `42501`; al día siguiente `42501` salvo Dirección; un folio nuevo ya no trae la copia.
- **Contrato:** `rpcs/corregir_seguimiento.md`.

---

### B-05

```text
Tarea: [Supabase] Separar cuentas de empleadas y usuarias de la app con app_metadata
Status: Sin empezar
```

- **Requisitos:** RF-33, RNF-02.
- **Migración `_44_`:**
  - Trigger en `auth.users` (alta): `raw_app_meta_data.tipo = 'usuaria_app'` por defecto.
  - Las cuentas de `empleado` y `usuario_externo` existentes se marcan `tipo = 'empleado'` / `'externo'`; el alta de empleadas futuras pone `'empleado'` (lo hace quien tenga `cuentas.gestionar`).
  - `es_usuaria_app()`: lee `auth.jwt() -> 'app_metadata' ->> 'tipo'`.
  - `es_empleado_activo()`: además de la fila activa en `empleado`, exige `tipo = 'empleado'`.
  - Seeds: actualizar los usuarios de `seed.sql` con su tipo (en `seeds/44_tipos_cuenta.sql`).
- **Pruebas:** `tests/44_tipos_cuenta.test.sql`: una cuenta `usuaria_app` con fila falsa en `empleado` no pasa `es_empleado_activo()`; las empleadas del seed siguen pasando todas las pruebas del Sprint 01.
- **Docs:** `api/app-movil.md` (sesión y tipos de cuenta), `roles-y-permisos.md`.

---

### B-06

```text
Tarea: [Supabase] Crear RPC registrar_mi_perfil, get_mi_estado_app y desactivar_mi_cuenta
Status: Sin empezar
```

- **Depende de:** B-05.
- **Migración `_45_`:**
  - `registrar_mi_perfil(p_curp, p_nombres, p_apellido_paterno, p_apellido_materno, p_celular, p_acepto_aviso)`: exige `es_usuaria_app()`; `auth_user_id` sale de `auth.uid()`; aviso obligatorio (`23514`). **Mantiene la liga automática por CURP** (trigger actual), por decisión del 26-nov. Devuelve lo mismo que `get_mi_pre_registro` (sin `persona_id` ni `estado`).
  - `get_mi_estado_app()`: `tiene_perfil`, `puede_enviar_alertas`, `alertas_ultima_hora`. **No** devuelve si está ligada a un expediente.
  - `desactivar_mi_cuenta()`: `pre_registro.activo = false`. Borrar la cuenta de Auth queda fuera (requiere llave de servicio; §7).
  - Política `pre_registro_insert` → `with check (false)`: solo por RPC.
- **Pruebas:** `tests/45_perfil_app.test.sql`: una empleada no puede registrar perfil (`42501`); ninguna salida trae `persona_id` ni `estado`; desactivar impide enviar alertas.
- **Contratos:** `rpcs/registrar_mi_perfil.md`, `rpcs/get_mi_estado_app.md`, `rpcs/desactivar_mi_cuenta.md`.

---

### B-07

```text
Tarea: [Supabase] Crear RPC enviar_alerta con límite por hora y endurecer configuración de Auth
Status: Sin empezar
```

- **Depende de:** B-05.
- **Migración `_46_`:**
  - `enviar_alerta(p_asentamiento_id)`: exige `es_usuaria_app()` y pre-registro activo; toma `pre_registro_id` de la sesión; límite de **3 por hora** (`23514`, **por confirmar**, §6); devuelve `alerta_id`, `estado`, `creado_en`.
  - Política `alerta_insert`: la usuaria ya no inserta directo; el personal con `alerta.atender` sí (alertas por teléfono o presenciales).
- **`config.toml` `[auth]`:** `enable_confirmations = true`, `minimum_password_length = 8`. Documentar los mismos valores para el proyecto remoto.
- **Pruebas:** `tests/46_enviar_alerta.test.sql`: la cuarta alerta en una hora da `23514`; `insert` directo de la usuaria falla; el personal sigue pudiendo dar de alta por teléfono.
- **Contrato:** `rpcs/enviar_alerta.md`.

---

### B-08

```text
Tarea: [Supabase] Pasar agenda y alertas a tiene_permiso y mostrar folio y archivo en la línea de tiempo
Status: Sin empezar
```

- **Depende de:** A-02 en `develop` (misma función `get_linea_tiempo`). Conviene después de B-02 y A-06.
- **Migración `_47_`:**
  - Cambiar `e.rol in (...)` por `tiene_permiso('<clave>')` en `get_agenda` y `cambiar_estado_cita` (`agenda.ver`/`agenda.gestionar`), `reagendar_cita` (`agenda.gestionar`), `get_lista_urgencias` (`urgencias.ver`), `get_cola_alertas` (`alerta.ver_cola`), `tomar_alerta` y `atender_alerta` (`alerta.atender`). El filtro por área en el `where` no cambia.
  - `get_linea_tiempo` (2.ª parte): mostrar `folio_seguimiento` en eventos de atención (si B-02 ya entró) y los eventos de archivo y reapertura (si A-06 ya entró).
- **Pruebas:** `tests/47_tiene_permiso_agenda.test.sql`: el resultado por rol es idéntico al Sprint 01 (correr también `22_`, `23_` y `24_`).
- **Docs:** quitar la nota de "validan con `e.rol`" en `api/README.md`.

---

### A-08

```text
Tarea: [Supabase] Devolver la edad calculada en el detalle y en la búsqueda del expediente
Status: Sin empezar
```

- **Origen:** revisión de la Ficha Única del 27-nov ("Edad. Automático"). Hoy la edad no se guarda (correcto) y ninguna RPC la devuelve, así que cada pantalla la calcula.
- **Migración `_48_`:**
  - Función `calcular_edad(p_fecha date) returns smallint` (`stable`), con la fecha de hoy en `America/Mazatlan`, para que dé lo mismo que la regla de mayoría de edad (RN-01).
  - `get_expediente_detalle`: agregar `'edad'` dentro de `persona` (y en cada agresor que tenga `fecha_nacimiento`, si viene `p_incluir_agresores`).
  - `buscar_expedientes`: agregar la columna `edad`. Cambia el tipo de salida, así que hay que hacer `drop function` y volver a crearla con sus `grant`.
  - No se agrega columna a ninguna tabla.
- **Pruebas:** `tests/48_edad_expediente.test.sql`: cumpleaños hoy da la edad completa; un día antes da un año menos; 29 de febrero; `get_expediente_detalle` y `buscar_expedientes` traen `edad`.
- **Contratos:** actualizar `rpcs/get_expediente_detalle.md` y `rpcs/buscar_expedientes.md`. Avisar a front que ya no calcule la edad.

---

### A-09

```text
Tarea: [Supabase] Crear RPC actualizar_domicilio y cerrar la edición directa del domicilio
Status: Sin empezar
```

- **Origen:** revisión de la Ficha Única del 27-nov. Hoy el domicilio se edita directo en la tabla (`domicilio_insert`/`domicilio_update` siguen abiertos) y no hay RPC.
- **Migración `_49_`:**
  - `actualizar_domicilio(p_persona_id, p_actualizado_en, p_asentamiento_id, p_codigo_postal, p_calle, p_numero_exterior, p_numero_interior, p_referencias, p_zona)` con `expediente.escribir`.
  - Rechaza si el expediente está archivado (`23514`); bloqueo optimista contra el `actualizado_en` del domicilio actual (`23505`; `null` si todavía no tiene domicilio).
  - Valida que no vengan juntos `asentamiento_id` y `codigo_postal` (`23514`), código postal de 5 dígitos y longitudes.
  - Crea el domicilio nuevo como actual y deja el anterior con `es_actual = false` (se conserva para el mapa y los folios viejos). Aprobado por Angel el 27-nov.
  - Devuelve `domicilio_id` y `actualizado_en`. La bitácora ya la deja el trigger `domicilio_bitacora`.
  - Políticas `domicilio_insert`/`domicilio_update` en `with check (false)`.
- ⚠️ **Romperá el front** que hoy inserta domicilio directo (`SupabaseSeguimientoRepository.guardarCopiaHoja`). El cierre de RLS se integra a `develop` cuando front confirme o cuando B-04 quite la copia del domicilio.
- **Pruebas:** `tests/49_actualizar_domicilio.test.sql`: Psicología da `42501`; archivado `23514`; fecha vieja `23505`; asentamiento y CP juntos `23514`; queda un solo domicilio actual; el `insert` directo falla.
- **Contratos:** nuevo `rpcs/actualizar_domicilio.md`; entrada en `api/expedientes.md`; quitar `domicilio` de "escritura directa" en `api/tablas-directas.md`.

---

> **Orden de migraciones (27-nov):** el carril B de Iván está en `origin/supabase` con fechas `20261128…` (40 a 48). A-10, A-11, A-12, A-13 y B-09 redefinen funciones que también toca la 47, así que llevan fecha `20261128001000` en adelante para correr después.

### A-10

```text
Tarea: [Supabase] Guardar la prioridad en el expediente y quitarla de la cita
Status: Sin empezar
```

- **Origen:** revisión de Cita del 27-nov (Angel aprobó trabajar las sugerencias). La prioridad (baja, media, alta) vive en el expediente.
- **Depende de:** A-08 en `develop` (las dos tocan `get_expediente_detalle`).
- **Migración `_50_`:**
  - Columnas en `ficha_registro`: `prioridad public.prioridad_nivel` (puede ir vacía) y `prioridad_actualizada_en timestamptz`.
  - Llenado inicial: a cada expediente se le copia la prioridad de su atención más reciente que la tenga.
  - `cambiar_prioridad_expediente(p_ficha_id, p_prioridad)`: todos los roles del personal menos Recepción (Titular, Subdirección, Trabajo Social, Psicología y Jurídico; confirmado por Angel el 27-nov); rechaza expediente archivado (`23514`); guarda fecha y quién (bitácora).
  - `crear_ficha_completa` acepta `prioridad` en el payload; `get_expediente_detalle` devuelve `prioridad` y `prioridad_actualizada_en`.
  - Quitar `cita.prioridad`: `get_agenda` deja de devolverla y `reagendar_cita` pierde `p_prioridad` (las dos cambian de firma: `drop function` y volver a crear con sus `grant`).
  - `atencion.prioridad` **no** se toca aquí: depende de la decisión de la Ficha de Seguimiento.
- ⚠️ **Romperá el front** que hoy manda `prioridad` al crear cita y a `reagendar_cita` (`SupabaseCitaRepository`). Se integra a `develop` cuando front confirme.
- **Pruebas:** `tests/50_prioridad_expediente.test.sql`: el llenado inicial copia la última prioridad; Recepción da `42501`; archivado `23514`; cambiar deja fecha y bitácora; `cita` ya no tiene la columna.
- **Contratos:** nuevo `rpcs/cambiar_prioridad_expediente.md`; actualizar `rpcs/get_expediente_detalle.md`, `rpcs/crear_ficha_completa.md`, `rpcs/get_agenda.md`, `rpcs/reagendar_cita.md`.

---

### A-11

```text
Tarea: [Supabase] Crear RPC crear_cita y cerrar la inserción directa de citas
Status: Sin empezar
```

- **Origen:** revisión de Cita del 27-nov. Hoy la cita se inserta directo en la tabla.
- **Migración `_51_`:**
  - `crear_cita(p_persona_id, p_area_id, p_programada_en, p_recomendada_por, p_origen default 'regular')` con `agenda.gestionar`.
  - Reglas de área: Recepción solo Trabajo Social y Psicología; Psicología y Jurídico solo su área; Dirección todas (`42501`).
  - Valida persona activa, expediente no archivado si tiene, fecha futura y que no haya otra cita activa de la misma persona en la misma área y hora (`23514`). La mayoría de edad la sigue validando el trigger `cita_validar_mayoria_edad`.
  - Devuelve `cita_id` y `estado`.
  - `cita_insert` en `with check (false)`. `registrar_seguimiento` y `reagendar_cita` siguen creando citas (son `security definer`).
  - `origen` (regular / UMECA) **se queda como está**; el tipo de cita se descartó.
- ⚠️ **Romperá el front** que hoy hace `.from('cita').insert()` (`SupabaseCitaRepository`). El cierre de RLS se integra cuando front confirme.
- **Pruebas:** `tests/51_crear_cita.test.sql`: Recepción no agenda Jurídico (`42501`); fecha pasada `23514`; menor en Psicología `23514`; duplicada `23514`; el `insert` directo falla.
- **Contratos:** nuevo `rpcs/crear_cita.md`; entrada en `api/agenda.md`; quitar `cita` de "escritura directa" en `api/tablas-directas.md`.

---

### A-12

```text
Tarea: [Supabase] Armar la lista de urgencias con la prioridad del expediente
Status: Sin empezar
```

- **Confirmada por Angel el 27-nov.**
- **Depende de:** A-10 en `develop`.
- **Migración `_52_`:** `get_lista_urgencias` y la vista de urgencias de `05_vistas.sql` leen `ficha_registro.prioridad = 'alta'` en lugar de la última atención; se mantiene "sin cita próxima" y el filtro por área. La salida cambia `area_ultima_prioridad`/`fecha_ultima_prioridad` por `prioridad_actualizada_en` (`drop function` y volver a crear).
- **Pruebas:** `tests/52_urgencias_expediente.test.sql`: aparece con prioridad alta y sin cita futura; desaparece al agendar o al bajar la prioridad; Recepción la consulta.
- **Contratos:** actualizar `rpcs/get_lista_urgencias.md` y `api/agenda.md`. Avisar a front del cambio de columnas.

---

### A-13

```text
Tarea: [Supabase] Eliminar folios de Expediente
Status: En progreso
```

- **Origen:** decisión de Angel del 27-nov. El folio del expediente pasa a `SEM-NN`, sin año: mínimo 2 dígitos y crece sin límite (`SEM-01` … `SEM-99`, `SEM-100`). Además se corrige que hoy `lpad(…, 4)` corta el número a 4 dígitos (el folio 10000 saldría repetido).
- **Depende de:** la 47 de Iván (`get_agenda`, `get_linea_tiempo`) en `develop`.
- **Migración `_53_`:**
  - `generar_folio_ficha()`: `'SEM-' || lpad(n, 2, '0')` solo si `n < 10`; si no, el número completo, sin cortar.
  - Renumerar los folios existentes en orden de `registrada_en` y `creado_en`, y dejar `ficha_folio_seq` en el último número.
  - Devolver `folio` (del expediente) como campo en `get_agenda`, `get_historial_clinico`, `get_historial_canalizaciones` y en cada evento de `get_linea_tiempo` (cambian de firma: `drop function` y volver a crear con sus `grant`).
  - Devolver `folio` en la respuesta de `registrar_seguimiento`, `crear_canalizacion`, `archivar_ficha`, `reabrir_ficha`, `guardar_agresor`, `registrar_estudio_socioeconomico`, `cambiar_estado_cita` y `reagendar_cita`.
  - `get_umeca_citas` **no** lo devuelve (UMECA es externo).
  - Actualizar seeds (`seeds/17_expedientes.sql`) y pruebas que usan folios `SEM-AAAA-NNNN`.
- ⚠️ Avisar a front: cambia el formato y varias RPC traen un campo nuevo. Las pruebas de `apps/admin` con folios `SEM-2026-…` se tienen que actualizar.
- **Pruebas:** `tests/53_folio_expediente.test.sql`: el primer folio es `SEM-01`, el 100 es `SEM-100` y el 10000 es `SEM-10000`; los existentes quedan renumerados sin huecos; las RPC de la lista traen `folio`; `get_umeca_citas` no.
- **Contratos:** actualizar cada `rpcs/<rpc>.md` que cambia y `api/expedientes.md`.

---

### B-09

```text
Tarea: [Supabase] Quitar el folio de seguimiento
Status: Sin empezar
```

- **Origen:** decisión de Angel del 27-nov: el seguimiento no lleva folio. Deshace B-02 (#89).
- **Depende de:** la 47 en `develop`.
- **Migración `_54_`:**
  - Borrar `atencion.folio_seguimiento`, su índice único, la secuencia y `generar_folio_seguimiento()`.
  - `registrar_seguimiento` deja de devolverlo; `get_contexto_seguimiento` quita `ultimo_folio_seguimiento`; `get_linea_tiempo` deja de mostrarlo en los eventos de atención (todas cambian de firma: `drop function` y volver a crear).
- **Pruebas:** `tests/54_quitar_folio_seguimiento.test.sql`: la columna ya no existe y ninguna RPC lo devuelve; correr también `40_` a `47_` y ajustar las que esperaban el folio.
- **Contratos:** actualizar `rpcs/registrar_seguimiento.md`, `rpcs/get_contexto_seguimiento.md`, `api/atencion.md`. Avisar a front.

---

## 5. DoD común (estándar §5, versión solo Supabase)

1. `npx supabase db push` sin conflictos (con `--include-all` si llegó fuera de orden).
2. `database.types.ts` regenerado después del último rebase.
3. `npx supabase test db` en verde (archivo de pruebas propio de la tarea **y** las del Sprint 01).
4. RPC con la plantilla §3.2: `tiene_permiso`, alias, `revoke`/`grant`, errores `42501`, `23514`, `23505`.
5. Contrato de 4 puntos en `rpcs/<rpc>.md` y entrada en `api/<modulo>.md`.
6. Cero PII en mensajes de error y cero secretos en el repo.
7. Validado con `npx supabase db reset` desde cero antes de integrar a `develop`.

## 6. Decisiones de negocio pendientes

Cada tarea afectada trae una propuesta por defecto para no bloquearse; si negocio decide otra cosa, se ajusta en la misma tarea o en una posterior.

| # | Decisión | Afecta | Propuesta por defecto |
|---|---|---|---|
| 1 | Campos del folio de seguimiento y si se necesita "cómo estaban los datos ese día" | B-03, B-04 | Lista mínima de B-03; quitar la copia |
| 2 | Formato del número de folio de seguimiento | B-02 | Provisional `SEG-AAAA-NNNNN` |
| 3 | ¿Dirección también crea canalizaciones? | A-01 | Solo TS |
| 4 | ¿Cómo se entera Recepción de una canalización a Psicología? | (fuera del sprint) | Por definir |
| 5 | Persona que llega sin cita | B-01 | Se crea la cita en el momento |
| 6 | RN-03: ¿aviso o bloqueo? | A-01 | Aviso |
| 7 | ¿Quién reabre expedientes? | P-02, A-06 | Titular y Subdirección |
| 8 | ¿Corregir el estudio del mismo día o siempre uno nuevo? | A-05 | Corregir el mismo día |
| 9 | Límite de alertas por cuenta | B-07 | 3 por hora |
| 10 | ¿Quién corrige la CURP de una persona? | (fuera del sprint) | RPC aparte solo Dirección |

## 7. Riesgos conocidos y fuera de este sprint

- **Liga automática por CURP (riesgo aceptado, 26-nov).** Cualquiera que conozca la CURP de una persona puede crear una cuenta en la app y quedar ligada a su expediente; sus alertas saldrían con el nombre y folio de esa persona, y como solo hay un pre-registro activo por CURP, la persona real no podría registrarse. Se deja así por ahora; la propuesta de vinculación con código en persona está en el backlog (U-3).
- **Historial de valores anteriores:** descartado por ahora; solo bitácora de quién y cuándo.
- **Aviso a Recepción de canalizaciones** (decisión 4) y **corrección de CURP** (decisión 10).
- **Borrar cuentas de Auth** (requiere Edge Function con llave de servicio).
- Todo lo de `apps/admin` y la app Kotlin: usar las RPC nuevas, quitar los `.from().update()` (antes de integrar A-07) y mandar el token de la usuaria en la app (antes de B-06 y B-07).
