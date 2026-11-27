# `verificar_curp`

- **Versión:** [`20261126000700_17`](../../migrations/20261126000700_17_rpc_busqueda_expedientes.sql)
- **Migración:** [`20261126000700_17_rpc_busqueda_expedientes.sql`](../../migrations/20261126000700_17_rpc_busqueda_expedientes.sql)
- **Permiso RBAC:** `tiene_permiso('expediente.verificar_curp')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`.

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_curp` | `text` | Sí | CURP de 18 caracteres validada contra el formato oficial (normalizada con `upper(btrim(...))`). |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `resultado` | `text` | `'expediente_existente'`, `'persona_sin_ficha'`, `'pre_registro_movil'` o `'nuevo'`. |
| `persona_id` | `uuid` | ID de `persona` si existe (`null` en `'pre_registro_movil'` y `'nuevo'`). |
| `ficha_id` | `uuid` | ID de la ficha activa (`null` para `recepcion` o si no hay ficha). |
| `folio` | `text` | Folio de la ficha activa (`null` si no hay ficha). |
| `estado` | `public.estado_ficha` | Estado de la ficha (`null` para `recepcion` o si no hay ficha). |
| `nombre_completo` | `text` | Nombre completo concatenado (`null` en `'nuevo'`). |
| `pre_registro_id` | `uuid` | ID del `pre_registro` activo cuando `resultado = 'pre_registro_movil'`. |

## 3. Reglas ABAC y efectos secundarios
- Para `recepcion`: devuelve salida reducida (`ficha_id = null`, `estado = null`) y nunca revela `'pre_registro_movil'` (responde `'nuevo'`).
- `'pre_registro_movil'` solo se devuelve a roles con `tiene_permiso('expediente.escribir')` (`titular`, `subdireccion`, `trabajo_social`).
- Cuando encuentra una fila activa en `public.persona`, inserta automáticamente `'ver'` en `public.bitacora_acceso`.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin sesión, empleado inactivo o UMECA (`tiene_permiso('expediente.verificar_curp')` falso). |
| `23514` | `p_curp` vacía o con formato inválido. |
