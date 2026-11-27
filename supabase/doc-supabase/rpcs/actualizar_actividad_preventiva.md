# RPC: `public.actualizar_actividad_preventiva`

- **Versión:** [`20261128002400_65`](../../migrations/20261128002400_65_editar_actividad_preventiva.sql)
- **Migración:** `supabase/migrations/20261128002400_65_editar_actividad_preventiva.sql`
- **Permiso RBAC:** `public.tiene_permiso('actividad.registrar')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`
- **Cubre:** `RF-16` (edición de una actividad preventiva **pendiente** desde el mismo diálogo del detalle)

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_actividad_id` | `uuid` | Sí | Actividad (`actividad_preventiva.id`) activa y en estado `pendiente` |
| `p_payload` | `jsonb` | Sí | Mismas claves y reglas que `registrar_actividad_preventiva` (ver abajo) |
| `p_actualizado_en` | `timestamptz` | Sí (en la práctica) | Valor de `actualizado_en` que leyó el cliente (bloqueo optimista). Tiene `default null` por compatibilidad de firma, pero `null` lanza `22023` |

Claves de `p_payload` (reemplazo completo: los opcionales ausentes o `null` se guardan como `null`):

| Clave | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `titulo` | `string` | Sí | `trim`, 1..200 |
| `tipo_actividad_id` | `number` | Sí | Existente en `cat_tipo_actividad` |
| `tipo_institucion` | `string` | Sí | Valor del enum `tipo_institucion_actividad` |
| `nivel_educativo` | `string \| null` | No | Solo si `tipo_institucion = 'escuela'` |
| `sede` | `string` | Sí | `trim`, 1..200 |
| `direccion` | `string \| null` | No | `<= 250` (vacío = `null`) |
| `referencias` | `string \| null` | No | `<= 250` (vacío = `null`) |
| `asentamiento_id` | `number \| null` | No | Existente en `cat_asentamiento` |
| `programada_en` | `string` | Sí | Fecha/hora ISO válida |
| `numero_asistentes` | `number \| null` | No | Entero `0..10000` |
| `participantes_ids` | `string[] \| null` | No | UUID de empleados **activos**. Ausente o `null`: se conserva el personal actual. Arreglo (incluso `[]`): reemplaza el personal |

## 2. Salida (`table`, una fila)

| Columna | Tipo | Descripción |
|---|---|---|
| `actividad_id` | `uuid` | Actividad editada |
| `total_participantes` | `integer` | Personal activo tras la edición |
| `actualizado_en` | `timestamptz` | Nuevo token de bloqueo optimista |

## 3. Reglas y efectos secundarios

- Solo se editan actividades `pendiente`; `realizada` y `cancelada` se rechazan (`22023`). Para corregir una cerrada, reabrirla antes con `actualizar_estado_actividad`.
- Bloquea la fila (`FOR UPDATE`). Compara `actualizado_en` (a milisegundos) con `p_actualizado_en`; si difiere, lanza `23505`.
- Reemplazo de personal: quien sale queda `activo = false` en `actividad_empleado` (no se borra); quien entra se inserta o se reactiva (`unique (actividad_preventiva_id, empleado_id)`).
- No cambia `estado`, `realizada_en`, `cancelada_motivo`, `observaciones_cierre` ni `creado_por`.
- `actualizado_en` lo mantiene el trigger `set_actualizado_en`.
- Registra una fila `actualizar` sobre `actividad_preventiva` en `bitacora_acceso`.
- La misma migración agrega la columna `actualizado_en` a `get_actividades_preventivas` (token que la UI devuelve al editar).

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `actividad.registrar` (`recepcion`, `umeca`, `anon`, empleado inactivo): `Sin permiso para editar actividades preventivas` |
| `22023` | `p_actividad_id` o `p_actualizado_en` nulos, o la actividad no está pendiente: `Solo se pueden editar actividades pendientes` |
| `23505` | Bloqueo optimista: `Esta actividad fue modificada por otra persona. Recarga los datos.` |
| `23514` | Payload no objeto o campo inválido (título, tipo, institución, nivel educativo, sede, longitudes, asentamiento, fecha, asistentes, participantes inexistentes o inactivos) |
| `P0002` | Actividad inexistente o inactiva |
