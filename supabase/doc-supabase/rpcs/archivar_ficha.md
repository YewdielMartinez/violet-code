# `archivar_ficha`

- **Migración:** [`20261126000800_18_rpc_detalle_y_archivo.sql`](../../migrations/20261126000800_18_rpc_detalle_y_archivo.sql)
- **Permiso RBAC:** `tiene_permiso('expediente.escribir')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Identificador de la ficha activa a archivar. |
| `p_motivo` | `text` | No | Motivo opcional del archivado. |

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
| `23514` | Expediente inexistente/inactivo, ya archivado, con citas futuras o con alertas abiertas. |
