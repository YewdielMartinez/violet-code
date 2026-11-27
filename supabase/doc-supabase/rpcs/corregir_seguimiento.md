# `corregir_seguimiento`

- **Migración:** [`20261128000400_43_corregir_seguimiento.sql`](../../migrations/20261128000400_43_corregir_seguimiento.sql)
- **Permiso RBAC:** `seguimiento.corregir` (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`).
- **Regla ABAC:**
  - Personal de área (`trabajo_social`, `psicologia`, `juridico`): solo puede corregir atenciones **creadas por él mismo** y **el mismo día** (`America/Mazatlan`).
  - Dirección (`titular`, `subdireccion`): puede corregir en cualquier momento.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_atencion_id` | `uuid` | Sí | ID de la atención activa a corregir. |
| `p_actualizado_en` | `timestamptz` | Sí | Marca de concurrencia optimista leída previamente (`40001` si cambió). |
| `p_tipo_atencion_id` | `smallint` | No | Si se envía, debe pertenecer al área de la atención. |
| `p_acciones_realizadas` | `text` | No | Texto actualizado (`<= 5000`). |
| `p_proxima_accion` | `text` | No | Próxima acción actualizada (`<= 2000`). |
| `p_prioridad` | `public.prioridad_nivel` | No | `'alta'`, `'media'`, `'baja'` o `null`. |
| `p_observaciones` | `text` | No | Observaciones actualizadas (`<= 5000`). |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `atencion_id` | `uuid` | ID de la atención corregida. |
| `folio_seguimiento` | `text` | Folio inmutable de la atención (`SEG-AAAA-NNNNN`). |
| `actualizado_en` | `timestamptz` | Nueva marca de tiempo tras la actualización. |

## 3. Bitácora y RLS
- Las escrituras directas (`INSERT`/`UPDATE`) sobre `public.atencion` quedan bloqueadas con `with check (false)`.
- El trigger `atencion_bitacora` registra `'actualizar'` sobre `'atencion'` sin almacenar valores anteriores.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso, otra persona de la misma área, o creador intentando corregir fuera del mismo día. |
| `40001` | `p_actualizado_en` no coincide con el registro actual (conflicto de concurrencia). |
| `23514` | Parámetro obligatorio nulo, atención inexistente/inactiva o `p_tipo_atencion_id` de otra área. |
