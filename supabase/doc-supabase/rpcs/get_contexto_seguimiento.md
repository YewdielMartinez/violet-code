# `get_contexto_seguimiento`

- **Versión:** [`20261128001400_54`](../../migrations/20261128001400_54_quitar_folio_seguimiento.sql)
- **Migración:** [`20261128001400_54_quitar_folio_seguimiento.sql`](../../migrations/20261128001400_54_quitar_folio_seguimiento.sql) *(actualiza [`20261128000300_42_rpc_contexto_seguimiento.sql`](../../migrations/20261128000300_42_rpc_contexto_seguimiento.sql))*
- **Permiso RBAC:** `tiene_permiso('seguimiento.registrar')` + `auth_area_id() is not null`
- **Actores autorizados:** `trabajo_social`, `psicologia`, `juridico` (únicamente sobre citas de su propia área programadas para el día de hoy).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_cita_id` | `uuid` | Sí | Cita activa del área del actor programada para el día de hoy (`America/Mazatlan`). |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `ficha_id` | `uuid` | ID del expediente activo asociado a la persona de la cita. |
| `folio_expediente` | `text` | Folio del expediente (`SEM-AAAA-NNNN`). |
| `nombre_persona` | `text` | Nombre completo de la persona. |
| `edad` | `integer` | Edad calculada en años (`null` si aún no tiene `fecha_nacimiento`). |
| `es_primera_vez_area` | `boolean` | `true` si no existen atenciones previas activas de esta ficha en el área del actor. |
| `ultima_proxima_accion` | `text` | `proxima_accion` del último seguimiento en **el área del actor** (`null` si no aplica). |
| `tiene_orden_vigente` | `boolean` | Indica si la persona cuenta con una orden de protección vigente. |
| `tiene_historial_clinico` | `boolean` | Solo para **Psicología** (`boolean`); devuelve `null` para Trabajo Social y Jurídico. |

## 3. Reglas de privacidad y bitácora
- Registra automáticamente un evento `'ver'` sobre `ficha_registro` en `public.bitacora_acceso`.
- **Nunca** devuelve CURP, estudio socioeconómico, datos del agresor ni notas de otras áreas.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `seguimiento.registrar` o sin área asignada (`anon`, `recepcion`, `titular`, `subdireccion`, `umeca`). |
| `23514` | `p_cita_id` nulo/inexistente, cita de otra área, cita de otro día (ayer o mañana) o persona sin expediente activo. |
