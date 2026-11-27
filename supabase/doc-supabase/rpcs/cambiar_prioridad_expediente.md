# `cambiar_prioridad_expediente`

- **Migración:** [`20261128001100_50_prioridad_en_expediente.sql`](../../migrations/20261128001100_50_prioridad_en_expediente.sql)
- **Permiso RBAC:** `tiene_permiso('expediente.ver')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico` (todos los roles operativos excepto `recepcion`, `umeca`, `app` y `anon`).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | Expediente activo y **no archivado** (`estado <> 'archivado'`). |
| `p_prioridad` | `public.prioridad_nivel` | No | `'alta'`, `'media'`, `'baja'` o `null`. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `ficha_id` | `uuid` | ID del expediente actualizado. |
| `prioridad` | `public.prioridad_nivel` | Nueva prioridad guardada en `ficha_registro`. |
| `prioridad_actualizada_en` | `timestamptz` | Marca de tiempo del servidor al actualizar la prioridad. |

## 3. Reglas ABAC y bitácora
- Registra `'actualizar'` sobre `'ficha_registro'` en `public.bitacora_acceso`.
- Rechaza expedientes archivados con `23514`.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | `recepcion`, `umeca`, `app`, inactivo o sin sesión. |
| `23514` | `p_ficha_id` nulo, expediente inexistente/inactivo o expediente en estado `'archivado'`. |
