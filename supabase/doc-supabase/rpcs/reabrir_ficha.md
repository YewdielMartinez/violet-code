# `reabrir_ficha`

- **Migración:** [`20261127000700_38_archivar_y_reabrir.sql`](../../migrations/20261127000700_38_archivar_y_reabrir.sql)
- **Permiso RBAC:** `tiene_permiso('expediente.reabrir')`
- **Actores autorizados:** `titular`, `subdireccion`.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Identificador del expediente archivado a reabrir. |
| `p_motivo` | `text` | Sí | Motivo obligatorio de la reapertura (1..1000 caracteres). Se guarda en `motivo_reapertura`, junto con `reabierta_en` y `reabierta_por`. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `ficha_id` | `uuid` | ID del expediente reabierto. |
| `estado` | `public.estado_ficha` | `'en_seguimiento'` si tiene atenciones activas; `'abierto'` si no tiene. |
| `actualizado_en` | `timestamptz` | Marca temporal de actualización. |

## 3. Reglas ABAC y efectos secundarios
- Solo permite reabrir expedientes activos en estado `'archivado'`.
- Conserva `motivo_archivo`, `archivada_en` y `archivada_por` para trazabilidad en línea de tiempo.
- El `UPDATE` dispara el trigger de bitácora registrando `'actualizar'`.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor distinto de `titular` o `subdireccion` (`trabajo_social`, áreas, recepción, UMECA, app, inactivo o sin sesión). |
| `23514` | `p_motivo` vacío o > 1000 caracteres, expediente inexistente/inactivo o no está en estado `'archivado'`. |
