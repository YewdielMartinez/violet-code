# `archivar_ficha`

- **Migración:** [`20261126000800_18_rpc_detalle_y_archivo.sql`](../../migrations/20261126000800_18_rpc_detalle_y_archivo.sql), actualizada en [`20261127000700_38_archivar_y_reabrir.sql`](../../migrations/20261127000700_38_archivar_y_reabrir.sql)
- **Permiso RBAC:** `tiene_permiso('expediente.escribir')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Identificador de la ficha activa a archivar. |
| `p_motivo` | `text` | Sí | Motivo obligatorio del archivado (1..1000 caracteres). Se guarda en `motivo_archivo`, junto con `archivada_en` y `archivada_por`. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `ficha_id` | `uuid` | ID de la ficha archivada. |
| `estado` | `public.estado_ficha` | `'archivado'`. |
| `actualizado_en` | `timestamptz` | Marca temporal de actualización. |

## 3. Reglas ABAC y efectos secundarios
- Solo archiva desde `abierto`, `en_seguimiento` o `cerrado`.
- Bloquea el archivado si existen citas futuras `agendada` o `confirmada` o alertas abiertas (`nueva` / `tomada`).
- El `UPDATE` dispara `ficha_registro_bitacora` registrando el cambio automáticamente.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor sin permiso `expediente.escribir`. |
| `23514` | `p_motivo` vacío o > 1000 caracteres, expediente inexistente/inactivo, ya archivado, con citas futuras o con alertas abiertas. |
