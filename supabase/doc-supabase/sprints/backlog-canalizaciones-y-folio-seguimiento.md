# Pendientes: canalizaciones y folio de seguimiento

> Estado: **propuesta, sin implementar.** Nada de esto tiene migración todavía y no hay tarjetas en Notion.
> Fecha: 26-nov-2026 (actualizado 26-nov, tarde) · Base: reglas que dio Angel el 26-nov y revisión del repo (migraciones `_01_` a `_29_`).
> Estándar que aplica a todo: [`docs/estandar-servicios-y-rpcs.md`](../../../docs/estandar-servicios-y-rpcs.md).

---

## 0. Nombres (glosario)

En la interfaz, en los documentos y al hablar con el equipo se usan los nombres de negocio. En la base **no** se renombran tablas: cambiarlas obligaría a rehacer unas 10 funciones y vistas, entre 6 y 8 tests, de 12 a 19 archivos del front y la bitácora histórica, con ramas abiertas de dos devs.

| Nombre de negocio | Nombre en la base | Dónde se ve |
|---|---|---|
| Canalización | tabla `derivacion`, RPC `get_derivaciones`, `cambiar_estado_derivacion` | Front: `features/canalizaciones` |
| Folio de seguimiento (el documento de cada asistencia) | tabla `atencion`, RPC `registrar_seguimiento` | Front: `features/seguimiento` |
| Número de folio de seguimiento | (no existe todavía) columna nueva en `atencion` | Ver §2.4 |
| Ficha Única / expediente | `ficha_registro` + `persona` | |

**Tarea:** agregar este glosario a `supabase/doc-supabase/esquema-y-rpcs.md` y a `doc-supabase/api/README.md`, y revisar que la UI no muestre "derivación" ni "atención" como nombre del documento.

---

## 1. Canalizaciones

### Reglas de negocio (Angel, 26-nov)

1. **Solo Trabajo Social crea canalizaciones a otras áreas.**
2. **Debe existir historial de canalizaciones por expediente.** No se crean muchas, pero tienen que poder consultarse cuando se necesiten.

### Cómo está hoy

| Tema | Hoy | ¿Cumple? |
|---|---|---|
| Quién crea | RLS `derivacion_insert` con `derivacion.gestionar`: Titular, Subdirección, TS, Psicología y Jurídico. Es un `insert` directo, sin RPC. | ❌ Regla 1 |
| Área de origen | El front la manda; la base no obliga a que sea la de quien canaliza. | ❌ |
| Destinos | `trabajo_social`, `psicologia`, `juridico`, `fiscalia`, `refugio`, `capacitacion`, `otra_institucion`. Trigger valida área destino y mayoría de edad (RN-01). | ✅ RF-08 |
| Historial de canalizaciones | Cada canalización es una fila nueva y nunca se borra, y `get_derivaciones(p_ficha_id)` las lista por expediente. | ✅ en parte |
| Historial de cada canalización | El cambio de estado (`pendiente → en_proceso → concluida / cancelada`) **sobrescribe** la fila. No queda quién la movió, cuándo, ni por qué. | ❌ Regla 2 |
| Resultado o motivo al cerrar | No se guarda. | ❌ |
| Línea de tiempo | Aparece en `get_linea_tiempo` (RF-25). | ✅ |
| Recepción | No ve canalizaciones, así que no sabe que debe agendar la cita en Psicología. | ⚠️ por decidir |

### Trabajo propuesto

**C-1. RPC `crear_canalizacion` y cierre del `insert` directo**
- Nueva clave en `tiene_permiso()`: `canalizacion.crear` → solo `trabajo_social`.
- RPC `crear_canalizacion(p_ficha_id, p_destino, p_area_destino_id, p_institucion_id, p_institucion_otra, p_motivo)`:
  - `area_origen_id` sale siempre de `auth_area_id()` (no lo manda el front).
  - Valida destino, institución y mayoría de edad (reusa `validar_derivacion_area`).
  - Inserta también el primer evento del historial (C-2).
- Política `derivacion_insert` pasa a `false` para todos (solo se crea por la RPC).
- **Por confirmar:** ¿Titular y Subdirección también pueden crear? La regla dice "solamente TS"; se deja así salvo que negocio diga otra cosa.
- **Por confirmar:** RN-03 (hombre sin tema jurídico → otra institución). Propuesta: no bloquear, solo devolver un aviso que la UI muestre.

**C-2. Historial de cada canalización**
- Tabla nueva `canalizacion_evento` (append-only, sin `update` ni `delete`):
  `id`, `derivacion_id`, `estado_anterior`, `estado_nuevo`, `nota` (resultado o motivo, opcional, ≤ 1000), `creado_por`, `creado_en`.
- `cambiar_estado_derivacion` recibe `p_nota` y escribe un evento por cada cambio. Para `concluida` y `cancelada` la nota es obligatoria.
- RPC `get_historial_canalizaciones(p_ficha_id)`: todas las canalizaciones del expediente con sus eventos (jsonb por canalización), con el mismo filtro de área que `get_derivaciones`.
- `get_linea_tiempo` muestra también los eventos.

**C-3. (Por decidir) Aviso a Recepción**
- Opción A: `get_canalizaciones_por_agendar()` para Recepción: solo canalizaciones `pendiente` a TS o Psicología, con nombre, folio y celular, sin motivo.
- Opción B: al crear una canalización interna, generar una cita "por agendar".
- Hasta que negocio decida, no se implementa.

**Pruebas (pgTAP):** solo TS crea; Psicología/Jurídico/Dirección reciben `42501`; el origen siempre es el área de TS; cada cambio de estado deja un evento; concluir o cancelar sin nota da `23514`; historial por expediente respeta el área.

---

## 2. Folio de seguimiento (hoja de cada asistencia)

### Reglas de negocio (Angel, 26-nov)

1. **Se crea cada vez que la persona asiste.** Es un registro de asistencia.
2. **Evitar duplicar datos** lo más posible.
3. **Debe existir la asistencia para crearse** y para obtener la información, así no se exponen datos sensibles de más.
4. **Antes de crearlo hay que definir con qué información se va a trabajar.**
5. **"Folio de seguimiento" es el nombre del documento, y además debe tener un folio único.** El formato existe pero no está definido: **pendiente**.

### Cómo está hoy

| Tema | Hoy | ¿Cumple? |
|---|---|---|
| Una por asistencia | `registrar_seguimiento` marca la cita como `asistio` y crea la fila en `atencion`. Una cita no puede tener dos (`cita_id` único). | ✅ Regla 1 |
| Requiere asistencia | `p_cita_id` es **opcional**: se puede crear sin cita. | ❌ Regla 3 |
| Datos duplicados | `atencion` copia estado civil, ocupación, celular y domicilio de la ficha. | ❌ Regla 2 |
| Datos al abrir el formulario | Para llenar la hoja, el front abre el expediente completo (`get_expediente_detalle`), que trae todo. | ❌ Regla 3 |
| Folio único | No existe. | ❌ Regla 5 (pendiente de formato) |
| Corrección | Solo con `update` directo, sin historial. | ⚠️ |
| Qué se registra | Acciones realizadas, próxima acción, observaciones, prioridad, tipo de atención, próxima cita. | ✅ RF-09 |
| Primera vez | `es_primera_vez_area` (RN-19), alimenta el informe. | ✅ |

### Trabajo propuesto

**S-0. Definir con negocio los campos del folio de seguimiento (bloqueante para S-2 y S-3)**

Lista inicial para validar:

| Campo | Hoy | Propuesta |
|---|---|---|
| Fecha y hora de la asistencia | ✅ `atendida_en` | Mantener |
| Área y quién atendió | ✅ `area_id`, `atendida_por` | Mantener |
| Tipo de atención | ✅ `tipo_atencion_id` | Mantener |
| Qué se hizo | ✅ `acciones_realizadas` | Mantener |
| Próxima acción | ✅ `proxima_accion` | Mantener |
| Observaciones | ✅ `observaciones` | Mantener |
| Prioridad del caso | ✅ `prioridad` | Mantener |
| Próxima cita | ✅ se crea en `cita` | Mantener |
| Estado civil, ocupación, celular, domicilio | ⚠️ copia | **Quitar la copia** y leerlos de la ficha. Por ahora no se guardará "cómo estaban ese día" (Angel, 26-nov: no hace falta historial de cambios). |
| Folio único | ❌ | Nuevo (S-3) |
| ¿Firma, acompañante, canalización generada en la sesión? | ❌ | Preguntar |

**S-1. La asistencia es obligatoria**
- `registrar_seguimiento`: `p_cita_id` pasa a obligatorio (`23514` si falta). La cita debe estar `agendada` o `confirmada`, ser de la persona del expediente y del área de quien atiende, y ser de **hoy** (`America/Mazatlan`).
- **Por confirmar:** ¿qué pasa con una persona que llega sin cita? Propuesta: Recepción o el área crea la cita en el momento y luego se registra el folio sobre ella; así siempre hay asistencia.

**S-2. Contexto mínimo para llenar el folio**
- RPC nueva `get_contexto_seguimiento(p_cita_id)`: solo funciona si la cita es del área del actor y de hoy. Devuelve lo mínimo que S-0 defina (por ejemplo: nombre, edad, folio del expediente, último folio de seguimiento de esa área, próxima acción pendiente, si tiene orden de protección vigente). **No** devuelve CURP, estudio socioeconómico ni datos del agresor.
- El formulario de seguimiento usa esta RPC en lugar del expediente completo. Registra `'ver'` en bitácora.

**S-3. Folio único de seguimiento (formato pendiente)**
- Columna `folio_seguimiento text unique not null` en `atencion`, generada en el servidor dentro de `registrar_seguimiento` (el front nunca la manda).
- Mientras negocio define el formato, se deja una función `generar_folio_seguimiento(p_ficha_id, p_area_id)` con un formato provisional y fácil de cambiar (por ejemplo `SEG-AAAA-NNNNN` con secuencia propia). Cambiar el formato después solo toca esa función.
- Las filas que ya existen reciben folio con el mismo generador en la migración.
- `registrar_seguimiento` lo devuelve; `get_linea_tiempo` y la UI lo muestran.
- ⏸ **Pendiente:** formato definitivo (¿incluye el folio del expediente? ¿el área? ¿consecutivo por expediente, por área o global?).

**S-4. Quitar la copia de datos generales**
- Depende de S-0. Si se confirma, la migración deja las columnas (no se borran datos ya guardados) pero `registrar_seguimiento` deja de llenarlas, y se documentan como obsoletas.

**S-5. Corrección de un folio de seguimiento**
- RPC `corregir_seguimiento(p_atencion_id, …)` solo para quien lo creó y solo el mismo día; fuera de eso, Dirección. Sin guardar el valor anterior (solo bitácora de quién y cuándo). Cerrar el `update` directo en RLS.

**Pruebas (pgTAP):** no se crea sin cita; no se crea sobre cita de otro día u otra área; el folio se genera y es único; `get_contexto_seguimiento` no devuelve CURP ni estudio; Recepción y Dirección no pueden crear.

---

## 3. Pendientes relacionados (de la revisión del 26-nov)

| Id | Qué | Por qué |
|---|---|---|
| ~~H-1~~ | ~~Historial de cambios genérico (`historial_cambio`).~~ **Descartado por ahora** (Angel, 26-nov). Se mantiene la bitácora de quién y cuándo. | Se puede retomar después sin rehacer nada. |
| H-2 | `archivar_ficha` guarda `p_motivo`. | Hoy lo recibe y no lo guarda. Pasa a E-6 en [`backlog-edicion-expediente-y-usuarias-app.md`](./backlog-edicion-expediente-y-usuarias-app.md). |
| H-3 | Trigger de bitácora en `ficha_servicio_solicitado`. | `crear_ficha_completa` borra y reinserta sus filas sin rastro. |
| R-1 | RPC de agenda, alertas y derivaciones con `tiene_permiso()`. | 9 RPC validan con `e.rol in (...)`. |

---

## 4. Orden sugerido y reparto (2 devs en paralelo)

| Orden | Dev A | Dev B |
|---|---|---|
| 1 | S-0 con negocio (sin código) · glosario | S-3 folio de seguimiento (formato provisional) |
| 2 | C-1 `crear_canalizacion` + clave `canalizacion.crear` | S-1 asistencia obligatoria |
| 3 | C-2 historial de canalizaciones | S-2 `get_contexto_seguimiento` (tras S-0) |
| 4 | H-3 | S-5 corrección de folio |
| 5 | R-1 | S-4 (tras S-0) |

Archivos que cada tarea toca en exclusiva: C-* (`derivacion`, `canalizacion_evento`, sus RPC); S-* (`atencion`, `registrar_seguimiento`, nuevas RPC de seguimiento). La única función compartida es `tiene_permiso()` (C-1 agrega `canalizacion.crear`): hacerla primero o en su propia migración.

### Redacción para tarjetas (no creadas)

```text
Tarea: [Supabase] Restringir a Trabajo Social la creación de canalizaciones con RPC crear_canalizacion
Status: Sin empezar

Tarea: [Supabase] Guardar historial de cambios de estado de cada canalización por expediente
Status: Sin empezar

Tarea: [Supabase] Exigir asistencia a una cita del día para crear el folio de seguimiento
Status: Sin empezar

Tarea: [Supabase] Crear RPC get_contexto_seguimiento con datos mínimos para el formulario
Status: Sin empezar

Tarea: [Supabase] Generar folio único de seguimiento en servidor (formato provisional)
Status: Sin empezar

Tarea: [Supabase] Agregar trigger de bitácora a ficha_servicio_solicitado
Status: Sin empezar
```

---

## 5. Decisiones que necesita negocio

1. Formato definitivo del folio de seguimiento.
2. Campos del folio de seguimiento (S-0), y si "cómo estaban los datos ese día" se necesita.
3. ¿Dirección también crea canalizaciones o solo TS?
4. ¿Cómo se entera Recepción de una canalización interna para agendar (C-3)?
5. Persona que llega sin cita: ¿se crea la cita en el momento?
6. RN-03: ¿aviso o bloqueo?
