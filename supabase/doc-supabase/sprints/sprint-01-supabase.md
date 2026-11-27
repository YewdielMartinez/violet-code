# Sprint 01 · Supabase: flujo principal de atención

SEMUJERES Ahome · Violet Code · **Solo backend Supabase** (migraciones, RPC, RLS, seeds, pruebas SQL y documentación de base de datos). Este sprint no incluye trabajo de `apps/admin` ni de la app móvil.

## 0. Base del sprint

**Estándar obligatorio:** [`docs/estandar-servicios-y-rpcs.md`](../../../docs/estandar-servicios-y-rpcs.md). Todas las tareas cumplen:

- **§1 Git:** una rama por tarea desde `develop` (`feat/supabase-<slug>`), Conventional Commits (`feat(supabase): …`) y se integra a `develop` solo con el DoD en verde.
- **§2 Cuándo usar RPC:** escrituras en 2 o más tablas, listados con joins o filtros, detalle de expediente y cambios de estado.
- **§3.1 Numeración:** cada tarea ya trae su número y timestamp (tabla 3).
- **§3.2 Plantilla de RPC:** `plpgsql`, `security definer`, `set search_path = public`, alias en todas las tablas, `revoke … from public, anon` y `grant … to authenticated`, errores `42501`, `23514` y `23505` con mensajes en español. **Con el ajuste de P-01: el permiso se valida con `tiene_permiso('<clave>')`, no con `e.rol in (...)`.**
- **§3.3 Tipos:** después de cada migración, `npx supabase gen types typescript --linked > apps/admin/src/infrastructure/supabase/database.types.ts`. Es el contrato con el front; generarlo no es trabajo de front.
- **§4 Contrato de 4 puntos** (nombre, actores, entrada, salida y errores) antes de programar: cada RPC lo documenta en `supabase/doc-supabase/rpcs/<nombre_rpc>.md`.

**Anexo de contratos:** [`sprint-01-flujos-y-contratos-rpc.md`](./sprint-01-flujos-y-contratos-rpc.md). Cada tarea apunta a su subflujo (`SF-xx`), donde están los diagramas y los tipos de entrada y salida. El anexo también trae notas de front que **no** son parte de este sprint.

**Equipo:** 2 devs, sin responsable fijo. Cada quien toma la siguiente tarea libre de un carril y la pasa a **En progreso** en Notion antes de crear la rama.

---

## 1. Modelo de permisos que siguen todas las RPC (RBAC + ABAC)

| Capa | Qué decide | Dónde vive |
|---|---|---|
| **RBAC (acción)** | Si el actor puede hacer la acción: "ver agenda", "registrar seguimiento" | `tiene_permiso('<clave>')`, un `CASE` por rol de `empleado.rol`. Ya exige empleado activo y `auth.uid()` |
| **ABAC (filas)** | Sobre qué filas: `area_id = auth_area_id()`, Recepción solo TS y Psic, `activo`, `auth_user_id = auth.uid()`, `origen = 'app_movil'` | El `where` de cada RPC y las políticas RLS |
| **Actores fuera de `empleado.rol`** | UMECA (`usuario_externo`) y la usuaria de la app (`auth.users` + `pre_registro`). `tiene_permiso()` siempre devuelve `false` para ellos | UMECA: `es_umeca()`. Usuaria: propiedad por `auth.uid()` |

Claves de permiso del sprint (las agrega **P-01**; ninguna otra tarea modifica `tiene_permiso()`):

| Clave | Roles | La usa |
|---|---|---|
| `expediente.ver` (existe) | Dirección, TS, Psic, Jur | A-02, A-03, A-05, B-04 |
| `expediente.escribir` (existe) | Dirección, TS | A-03 |
| `expediente.verificar_curp` 🆕 | Dirección, TS, Psic, Jur, Recepción | A-02 |
| `seguimiento.registrar` 🆕 | TS, Psic, Jur | A-04 |
| `agenda.ver` 🆕 | Dirección, TS, Psic, Jur, Recepción | B-01 |
| `agenda.gestionar` 🆕 | Dirección, TS, Psic, Jur, Recepción (las filas por área van en el `where`) | B-01, B-02 |
| `urgencias.ver` 🆕 | Dirección, TS, Psic, Recepción | B-02 |
| `alerta.ver_cola` / `alerta.atender` (existen) | ver: Dirección, TS, Psic, Jur · atender: Dirección, Jur | B-03 |
| `derivacion.gestionar` 🆕 | Dirección, TS, Psic, Jur | B-04 |
| `actividad.ver` / `actividad.registrar` 🆕 | ver: todos los empleados · registrar: Dirección, TS, Psic, Jur | B-05 |
| `informe.ver` 🆕 | Dirección, TS, Psic, Jur (cada área solo la suya, filtrado en el `where`) | B-07 |
| `bitacora.ver` (existe) | Dirección | B-07 |

---

## 2. Cómo se garantiza que las tareas vayan en paralelo

| Riesgo de choque | Regla |
|---|---|
| Dos migraciones con el mismo número | `_13_` y `_14_` ya existen. Cada tarea tiene su número asignado (tabla 3). Si una se integra antes que otra de número menor: `npx supabase db push --include-all` |
| Dos tareas haciendo `create or replace` de la misma función | Cada función y cada política tiene **un solo dueño** (tabla 3, columna "Objetos que toca"). En particular, `tiene_permiso()` solo lo toca P-01 |
| `database.types.ts` (generado) | Nunca se resuelve un conflicto a mano: después de `git rebase develop`, se vuelve a generar |
| `supabase/seed.sql` | P-01 habilita `supabase/seeds/*.sql`. Cada tarea agrega sus datos sintéticos en su propio archivo `seeds/<NN>_<tema>.sql` (RNF-01: siempre los mismos) |
| `esquema-y-rpcs.md` | Nadie lo edita en el sprint. Cada RPC documenta su contrato en su propio archivo `doc-supabase/rpcs/<rpc>.md`; P-01 deja la carpeta, la plantilla y la liga |
| Pruebas | Cada tarea crea su propio archivo `supabase/tests/<NN>_<tema>.test.sql` (pgTAP, `npx supabase test db`) |

**Única dependencia del sprint:** **P-01 va primero** (es corta). Las demás usan las claves de permiso que agrega. Fuera de eso, ninguna tarea depende de otra. Las que comparten tema dentro de un carril (A-02 y A-03; B-01 y B-02) no se toman al mismo tiempo para no chocar en las pruebas y los seeds.

---

## 3. Tablero de tareas

| ID | Carril | Migración asignada | Objetos que toca (dueño exclusivo) | Anexo |
|---|---|---|---|---|
| P-01 | — (primero) | `20261126000500_15_permisos_rbac_abac.sql` | `tiene_permiso()`, `get_mapa_calor_asentamiento()`, `config.toml` (`sql_paths`), `roles-y-permisos.md`, §3.2 del estándar, `doc-supabase/rpcs/` | §1 de este plan |
| A-01 | A | `20261126000600_16_storage_y_bitacora.sql` | política `documentos_storage_delete`, `registrar_consulta()` | SF-15 |
| A-02 | A | `20261126000700_17_rpc_busqueda_expedientes.sql` | `verificar_curp()`, `buscar_expedientes()`, `buscar_pre_registro_por_curp()` | SF-01 |
| A-03 | A | `20261126000800_18_rpc_detalle_y_archivo.sql` | `get_expediente_detalle()`, `archivar_ficha()`, `crear_ficha_completa()` | SF-02, SF-08, SF-17 |
| A-04 | A | `20261126000900_19_rpc_registrar_seguimiento.sql` | `registrar_seguimiento()` | SF-09 |
| A-05 | A | `20261126001000_20_rpc_linea_tiempo.sql` | `get_linea_tiempo()` | SF-14 |
| A-06 | A | `20261126001100_21_rls_tiene_permiso.sql` | políticas de `cita`, `atencion`, `nota_area`, `historial_clinico`, `derivacion`, `ficha_registro`, `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar`, `agresor`, `orden_proteccion`, `domicilio`, `documento` | — |
| B-01 | B | `20261126001200_22_rpc_agenda.sql` | `get_agenda()`, `cambiar_estado_cita()` | SF-05, SF-06 |
| B-02 | B | `20261126001300_23_rpc_reagendar_y_urgencias.sql` | `reagendar_cita()`, `get_lista_urgencias()` | SF-07 |
| B-03 | B | `20261126001400_24_rpc_cola_alertas.sql` | `get_cola_alertas()`, `tomar_alerta()`, `atender_alerta()`, trigger nuevo en `orden_proteccion` | SF-11, SF-12, SF-13 |
| B-04 | B | `20261126001500_25_rpc_derivaciones.sql` | `get_derivaciones()`, `cambiar_estado_derivacion()`, `validar_derivacion_area()` | SF-04 |
| B-05 | B | `20261126001600_26_rpc_actividades_preventivas.sql` | `registrar_actividad_preventiva()`, `get_actividades_preventivas()` | alcance RF-16 |
| B-06 | B | `20261126001700_27_pre_registro_seguro.sql` | políticas de `pre_registro` y `alerta`, `mi_pre_registro_id()`, `get_mi_pre_registro()`, `actualizar_mi_pre_registro()` | SF-00 |
| B-07 | B | `20261126001800_28_rpc_informes_y_bitacora.sql` | `get_informe()`, `get_bitacora()` | alcance RF-13, RF-22 |
| B-08 | B | `20261126001900_29_recepcion_sin_curp.sql` | política `persona_select` | RNF-02 |

A-06 **no** toca las políticas de `persona`, `pre_registro`, `alerta` ni `storage.objects`, que son de B-08, B-06 y A-01.

---

## 4. Tareas

Formato en Notion: las dos primeras líneas son las propiedades (sin responsable) y el resto es el cuerpo.

---

### P-01

```text
Tarea: [Supabase] Centralizar la validación de roles en tiene_permiso() con las claves del sprint
Status: Sin empezar
```

- **Por qué:** `roles-y-permisos.md` dice que los permisos se cambian "solo en `tiene_permiso()`", pero las RPC validan con `e.rol in (...)` escrito a mano y varias políticas usan `auth_rol()` directo. Con las 21 RPC nuevas del sprint, la lista de roles se repetiría 21 veces más.
- **Migración `_15_`:**
  - `tiene_permiso()`: agregar las claves 🆕 de la tabla del §1 de este plan.
  - `get_mapa_calor_asentamiento()`: validar con `tiene_permiso('expediente.ver')` (nadie más la toca en el sprint).
- **Documentación:**
  - `docs/estandar-servicios-y-rpcs.md` §3.2: la plantilla valida con `if not public.tiene_permiso('<clave>') then raise … '42501'`; los filtros por área van en el `where` (ABAC); UMECA usa `es_umeca()` y la usuaria, propiedad por `auth.uid()`.
  - `supabase/doc-supabase/roles-y-permisos.md`: modelo RBAC (acción con `tiene_permiso`) + ABAC (filas por `area_id`, `activo`, `auth.uid()`, `origen`); tabla de claves; **29 tablas y 7 catálogos** (la migración `11` borró 3); UMECA y usuaria fuera de `empleado.rol`; Recepción hoy lee la CURP en `persona` sin bitácora (se corrige en B-08); `crear_ficha_completa` borra fichas como definer (se corrige en A-03); el personal ve también los registros inactivos del directorio; corregir que "solo cambiando `tiene_permiso()`" alcanza (hasta A-06 no es cierto).
  - Crear `supabase/doc-supabase/rpcs/README.md` con la plantilla del contrato de 4 puntos y ligarla desde `esquema-y-rpcs.md`, actualizando de paso su tabla de migraciones con las `11` a la `14`.
- **Config:** `supabase/config.toml` → `sql_paths = ["./seed.sql", "./seeds/*.sql"]`; crear `supabase/seeds/.gitkeep`.
- **Pruebas:** `supabase/tests/15_permisos.test.sql`: cada clave nueva devuelve `true` o `false` para cada uno de los 6 roles, `false` sin sesión, `false` para un empleado inactivo y `false` para UMECA.
- **Hecho cuando:** `db push` aplicado, tipos regenerados y `supabase test db` en verde.

---

### A-01

```text
Tarea: [Supabase] Agregar política delete de Storage para documentos y errcode 42501 en registrar_consulta
Status: Sin empezar
```

- **Requisitos:** RF-35, RF-22. **Anexo:** SF-15.
- **Migración `_16_`:**
  - Política `documentos_storage_delete` en `storage.objects` (`bucket_id = 'documentos'` y `tiene_permiso('expediente.ver')`). Sin ella, cuando falla el insert en `documento`, el archivo subido queda huérfano.
  - `registrar_consulta()`: `using errcode = '42501'` en "Sin permiso"; validar con `es_empleado_activo() or es_umeca()`; rechazar `p_tabla` fuera de una lista permitida (`23514`).
- **Pruebas:** `tests/16_storage_bitacora.test.sql`: un rol sin permiso no borra objetos; `registrar_consulta` sin sesión da `42501`.
- **Contrato:** `doc-supabase/rpcs/registrar_consulta.md`.

---

### A-02

```text
Tarea: [Supabase] Crear RPC verificar_curp y buscar_expedientes para la búsqueda por CURP, nombre o folio
Status: Sin empezar
```

- **Requisitos:** RF-03, RF-04, RF-34, RN-02. **Anexo:** SF-01.
- **Migración `_17_`:**
  - `verificar_curp(p_curp)` con permiso `expediente.verificar_curp`. Devuelve uno de 4 resultados; para Recepción, salida reducida y nunca `pre_registro_movil`. Registra `'ver'` en la bitácora cuando encuentra una persona.
  - `buscar_expedientes(p_termino, p_limite, p_incluir_archivados)` con permiso `expediente.ver`: `pg_trgm`, `limit` máximo 100, `23514` si el término tiene menos de 3 caracteres.
  - `buscar_pre_registro_por_curp()`: validar con `tiene_permiso('expediente.escribir')`. Se conserva por compatibilidad.
- **Seed:** `seeds/17_expedientes.sql`: una persona con ficha, una sin ficha y un pre-registro de la app.
- **Pruebas:** los 4 resultados de `verificar_curp`, la salida reducida de Recepción y una búsqueda por nombre con acentos.
- **Contratos:** `rpcs/verificar_curp.md`, `rpcs/buscar_expedientes.md`.

---

### A-03

```text
Tarea: [Supabase] Crear RPC get_expediente_detalle y archivar_ficha, y quitar el borrado físico en crear_ficha_completa
Status: Sin empezar
```

- **Requisitos:** RF-01, RF-22, RF-24, RN-08. **Anexo:** SF-02, SF-08, SF-17.
- **Migración `_18_`:**
  - `get_expediente_detalle(p_ficha_id, p_incluir_agresores)` → `jsonb` con permiso `expediente.ver`. Registra `'ver'` de `ficha_registro` (y de `agresor` si se piden).
  - `archivar_ficha(p_ficha_id, p_motivo)` con permiso `expediente.escribir`: solo desde `abierto`, `en_seguimiento` o `cerrado`, y sin citas futuras ni alertas abiertas (`23514`).
  - `crear_ficha_completa()`: (1) en lugar del `delete` de la ficha vacía, la reutiliza con un `update`, para que quede en la bitácora; (2) valida con `tiene_permiso('expediente.escribir')`; (3) acepta en el payload `tieneConsumoDroga`, `drogas`, `especificacionDroga` y `tieneConsumoAlcohol`, que ya existen en `ficha_registro`.
- **Pruebas:** el detalle con y sin agresores; archivar con una cita futura da `23514`; crear dos veces con la misma CURP da `23505` sin borrar nada.
- **Contratos:** `rpcs/get_expediente_detalle.md`, `rpcs/archivar_ficha.md`, `rpcs/crear_ficha_completa.md`.

---

### A-04

```text
Tarea: [Supabase] Crear RPC registrar_seguimiento para asistencia, hoja de seguimiento y próxima cita
Status: Sin empezar
```

- **Requisitos:** RF-07, RF-09, RN-05, RN-13, RN-19. **Anexo:** SF-09.
- **Migración `_19_`:** `registrar_seguimiento(p_ficha_id, p_cita_id, p_tipo_atencion_id, p_acciones_realizadas, p_proxima_accion, p_prioridad, p_observaciones, p_proxima_cita_en)` con permiso `seguimiento.registrar`. En una transacción: la cita pasa a `asistio`, inserta `atencion` con `area_id = auth_area_id()`, la ficha pasa de `abierto` a `en_seguimiento` y, si viene fecha, crea la próxima cita. Devuelve `es_primera_vez_area` y `tiene_historial_clinico`. Errores `42501`, `23514`, `23505` (la cita ya tiene hoja).
- **Seed:** `seeds/19_seguimiento.sql`: atenciones con prioridad alta y baja (así B-02 tiene datos para la lista de urgencias).
- **Pruebas:** un tipo de atención de otra área da `23514`; una cita de otra persona da `23514`; un menor de edad en Psicología da `23514`; la misma cita dos veces da `23505`.
- **Contrato:** `rpcs/registrar_seguimiento.md`.

---

### A-05

```text
Tarea: [Supabase] Crear RPC get_linea_tiempo para la línea de tiempo del caso por rol
Status: Sin empezar
```

- **Requisitos:** RF-25 (MVP), RN-18. **Anexo:** SF-14.
- **Migración `_20_`:** `get_linea_tiempo(p_ficha_id)` → `table`, con permiso `expediente.ver`. Une registro, citas, atenciones, derivaciones, órdenes y alertas. Dirección ve todo; cada área ve el título y el estado de todo, pero el detalle solo de lo suyo. Nunca incluye `nota_area`.
- **Pruebas:** Psicología no ve `acciones_realizadas` de TS; Dirección sí; ninguna nota aparece.
- **Contrato:** `rpcs/get_linea_tiempo.md`.

---

### A-06

```text
Tarea: [Supabase] Reescribir políticas RLS de expediente, agenda y atención con tiene_permiso y (select …)
Status: Sin empezar
```

- **Por qué:** cumplir lo que promete `roles-y-permisos.md` (cambiar permisos solo en `tiene_permiso()`) y que las funciones de ayuda no se evalúen fila por fila. La forma `(select public.tiene_permiso('x'))` hace que Postgres la calcule una sola vez por consulta.
- **Migración `_21_`:** `drop policy` + `create policy` en las tablas de la tabla 3 (fila A-06), **sin cambiar quién puede qué**. Donde hoy dice `es_direccion() or auth_rol() = 'x'`, se pasa a una clave; los filtros por área (`area_id = auth_area_id()`) se quedan como ABAC, envueltos en `(select …)`. Si hace falta una clave nueva, se coordina con quien tenga P-01, o se agrega en esta misma migración **solo si P-01 ya se integró**.
- **No toca:** `persona`, `pre_registro`, `alerta`, `storage.objects`.
- **Pruebas:** `tests/21_rls.test.sql` con la matriz de `roles-y-permisos.md` §3 para esas tablas: mismo resultado antes y después.
- **Hecho cuando:** la matriz de pruebas pasa igual que antes del cambio.

---

### B-01

```text
Tarea: [Supabase] Crear RPC get_agenda y cambiar_estado_cita para la agenda de Recepción
Status: Sin empezar
```

- **Requisitos:** RF-06, RN-04, RN-06. **Anexo:** SF-05, SF-06.
- **Migración `_22_`:**
  - `get_agenda(p_desde, p_hasta, p_area_id, p_estados, p_limite)` con permiso `agenda.ver`. ABAC igual a `cita_select`: Recepción y TS ven TS y Psic; Psic y Jur, la suya; Dirección, todo. Incluye el celular para confirmar. Da `23514` si el rango es inválido o de más de 31 días.
  - `cambiar_estado_cita(p_cita_id, p_estado, p_motivo)` con permiso `agenda.gestionar`. ABAC igual a `cita_update`. Transiciones `agendada → confirmada | cancelada | no_asistio` y `confirmada → cancelada | no_asistio`; llena `confirmada_en`.
- **Seed:** `seeds/22_agenda.sql`: citas de hoy y de mañana en TS y Psic, más una de Jurídico.
- **Pruebas:** Recepción no ve ni cambia citas de Jurídico; transiciones válidas e inválidas.
- **Contratos:** `rpcs/get_agenda.md`, `rpcs/cambiar_estado_cita.md`.

---

### B-02

```text
Tarea: [Supabase] Crear RPC reagendar_cita y get_lista_urgencias para cancelaciones
Status: Sin empezar
```

- **Requisitos:** RF-06, RF-07, RN-06. **Anexo:** SF-07.
- **Migración `_23_`:**
  - `reagendar_cita(p_cita_id, p_nueva_fecha, p_motivo, p_prioridad)` con permiso `agenda.gestionar` y el ABAC de `cita_update`. En una transacción, la cita vieja pasa a `reagendada` y se crea la nueva con `reagendada_de`. Errores `42501`, `23514` (fecha pasada o estado inválido) y `23505` (ya se reagendó).
  - `get_lista_urgencias(p_area_id)` con permiso `urgencias.ver`. Misma lógica que `vista_lista_urgencias`, pero Recepción sí la ve. Sin CURP ni notas.
- **Pruebas:** reagendar dos veces da `23505`; Recepción ve la lista; una persona con cita futura no aparece en la lista.
- **Contratos:** `rpcs/reagendar_cita.md`, `rpcs/get_lista_urgencias.md`.

---

### B-03

```text
Tarea: [Supabase] Crear RPC get_cola_alertas, tomar_alerta y atender_alerta, y recalcular prioridad con orden de protección
Status: Sin empezar
```

- **Requisitos:** RF-17, RF-18, RF-20, RN-16, RN-17. **Anexo:** SF-11, SF-12, SF-13.
- **Migración `_24_`:**
  - `get_cola_alertas(p_estados, p_limite)` con permiso `alerta.ver_cola`: ordenada por prioridad y fecha; resuelve la persona también vía `pre_registro`; trae `tiene_orden_vigente`; registra `'ver'` en la bitácora.
  - `tomar_alerta(p_alerta_id)` (solo desde `nueva`; si ya la tomó alguien, `23505`) y `atender_alerta(p_alerta_id, p_observaciones)` (solo desde `tomada`), con permiso `alerta.atender`.
  - Trigger `after insert or update` en `orden_proteccion` que sube a `alta` las alertas `nueva` de la persona.
- **Seed:** `seeds/24_alertas.sql`: una alerta de una persona con orden vigente y otra sin orden.
- **Pruebas:** una persona con orden vigente entra en `alta`; registrar una orden después sube la alerta abierta; dos `tomar_alerta` seguidas: la segunda da `23505`.
- **Contratos:** `rpcs/get_cola_alertas.md`, `rpcs/tomar_alerta.md`, `rpcs/atender_alerta.md`.

---

### B-04

```text
Tarea: [Supabase] Crear RPC get_derivaciones y cambiar_estado_derivacion, y validar edad y área de origen
Status: Sin empezar
```

- **Requisitos:** RF-08, RN-01, RN-03, RN-11. **Anexo:** SF-04.
- **Migración `_25_`:**
  - `get_derivaciones(p_estado, p_ficha_id, p_limite)` con permiso `expediente.ver` y el ABAC de `derivacion_select`. Trae el folio, el nombre, las áreas y la institución, en lugar del join REST actual.
  - `cambiar_estado_derivacion(p_derivacion_id, p_estado)` con permiso `derivacion.gestionar`: `pendiente → en_proceso | cancelada` y `en_proceso → concluida | cancelada`.
  - `validar_derivacion_area()`: rechaza Psicología o Jurídico para menores de 18 (`23514`) y llena `area_origen_id` con `auth_area_id()` si viene nulo.
- **Pruebas:** derivar a un menor a Psicología da `23514`; una transición inválida da `23514`; Psicología no ve derivaciones ajenas.
- **Contratos:** `rpcs/get_derivaciones.md`, `rpcs/cambiar_estado_derivacion.md`.

---

### B-05

```text
Tarea: [Supabase] Crear RPC registrar_actividad_preventiva y get_actividades_preventivas
Status: Sin empezar
```

- **Requisitos:** RF-16 (MVP según el alcance; no estaba modelado).
- **Migración `_26_`:**
  - `registrar_actividad_preventiva(p_payload jsonb)` con permiso `actividad.registrar`: inserta en `actividad_preventiva` y en `actividad_empleado` en una transacción.
  - `get_actividades_preventivas(p_desde, p_hasta, p_limite)` con permiso `actividad.ver`: con el asentamiento y los participantes.
- **Antes de programar:** escribir los contratos de 4 puntos (no están en el anexo).
- **Seed:** `seeds/26_actividades.sql`.
- **Contratos:** `rpcs/registrar_actividad_preventiva.md`, `rpcs/get_actividades_preventivas.md`.

---

### B-06

```text
Tarea: [Supabase] Ocultar persona_id y estado de pre_registro a la app móvil
Status: Sin empezar
```

- **Requisitos:** RF-33 (la app no revela si la CURP ya tenía expediente), RNF-02. **Anexo:** SF-00.
- **Migración `_27_`:**
  - Helper `mi_pre_registro_id()` (`security definer`): el `id` del pre-registro activo de `auth.uid()`.
  - `pre_registro_select` y `pre_registro_update`: la usuaria ya no lee ni edita la tabla directo; el personal (`expediente.escribir`) sí. `pre_registro_insert` se queda igual.
  - `alerta_insert` y `alerta_select`: usar `mi_pre_registro_id()` en lugar de leer `pre_registro`, porque si no, **el botón de ayuda deja de funcionar**.
  - RPC `get_mi_pre_registro()` (solo `id`, `curp`, `nombres`, `apellidos`, `celular`, `creado_en`) y `actualizar_mi_pre_registro(...)`. Las dos usan propiedad por `auth.uid()`, no `tiene_permiso()`.
- **Pruebas:** la usuaria no ve `persona_id` ni `estado`; sí crea su alerta; no ve la alerta de otra usuaria.
- **Avisar** al equipo móvil del nuevo contrato (no es trabajo de este sprint).

---

### B-07

```text
Tarea: [Supabase] Crear RPC get_informe y get_bitacora para informes por área y auditoría
Status: Sin empezar
```

- **Requisitos:** RF-13, RF-22, RNF-02 (la CURP nunca aparece en informes).
- **Migración `_28_`:**
  - `get_informe(p_anio, p_mes, p_area_id)` con permiso `informe.ver`: lee de `vista_informe_mensual` o `vista_informe_anual`; Dirección ve todas las áreas y cada área solo la suya. Si `p_mes` es nulo, devuelve el anual.
  - `get_bitacora(p_desde, p_hasta, p_tabla, p_empleado_id, p_limite)` con permiso `bitacora.ver`: el nombre del actor (empleado o UMECA), con paginación.
- **Pruebas:** TS no ve el informe de Psicología; sin datos devuelve 0 filas, no error; solo Dirección lee la bitácora.
- **Contratos:** `rpcs/get_informe.md`, `rpcs/get_bitacora.md`.

---

### B-08

```text
Tarea: [Supabase] Quitar a Recepción la lectura directa de persona para no exponer la CURP sin bitácora
Status: Sin empezar
```

- **Requisitos:** RNF-02 (la CURP solo para los roles de atención y con bitácora), RN-04.
- **Migración `_29_`:** `persona_select` solo con `expediente.ver`. Recepción obtiene nombre y celular por `get_agenda`, `get_lista_urgencias` y `verificar_curp`, que no exponen la CURP y sí dejan bitácora.
- ⚠️ **Romperá el front** si se aplica antes de que el widget de agenda del dashboard deje de hacer join con `persona` para Recepción. Se puede programar y probar en paralelo, pero se **integra a `develop` al último**, cuando front confirme.
- **Pruebas:** Recepción obtiene 0 filas de `persona`; con `get_agenda` sí ve los nombres.

---

## 5. DoD común (estándar §5, versión solo Supabase)

1. `npx supabase db push` sin conflictos (con `--include-all` si llegó fuera de orden).
2. `database.types.ts` regenerado después del último rebase.
3. `npx supabase test db` en verde (archivo de pruebas propio de la tarea).
4. RPC con la plantilla de §3.2 ajustada por P-01: `tiene_permiso`, alias, `revoke`/`grant` y errores `42501`, `23514`, `23505`.
5. Contrato de 4 puntos en `supabase/doc-supabase/rpcs/<rpc>.md`.
6. Cero PII en mensajes de error y cero secretos en el repo.

## 6. Fuera de este sprint

- Todo lo de `apps/admin`: puertos, adaptadores, hooks y la reorganización de `infrastructure/supabase/adapters` en carpetas por módulo (propuesta en el anexo).
- Cambios en la app móvil por B-06.
- Pendientes de decisión del equipo (anexo §10.1): si Recepción entra a la web y las direcciones de refugios.
