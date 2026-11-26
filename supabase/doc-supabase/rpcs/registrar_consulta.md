# `registrar_consulta`

- **Migración:** [`20261126000600_16_storage_y_bitacora.sql`](../../migrations/20261126000600_16_storage_y_bitacora.sql)
- **Permiso RBAC:** `es_empleado_activo() or es_umeca()`
- **Actores autorizados:** cualquier `empleado` activo (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`) y `usuario_externo` UMECA activo.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_tabla` | `text` | Sí | Tabla consultada. Lista permitida: `ficha_registro`, `agresor`, `persona`, `documento`, `historial_clinico`, `cita`. |
| `p_registro_id` | `text` | Sí | Identificador del registro consultado (no vacío tras `btrim`). |

## 2. Salida
| Tipo | Descripción |
|---|---|
| `void` | No devuelve filas; inserta el evento `'ver'` en `public.bitacora_acceso`. |

## 3. Reglas ABAC y efectos secundarios
- Inserta una fila en `public.bitacora_acceso` con `accion = 'ver'`, asociando `empleado_id` (si es personal interno) o `usuario_externo_id` (si es UMECA).
- Complementa la política `documentos_storage_delete` de la misma migración en `storage.objects` (`bucket_id = 'documentos'`, `tiene_permiso('expediente.ver')` y `owner_id = auth.uid()::text`).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin sesión (`auth.uid()` nulo), empleado inactivo o usuario UMECA inactivo. |
| `23514` | `p_tabla` fuera de la lista permitida o `p_registro_id` vacío. |
