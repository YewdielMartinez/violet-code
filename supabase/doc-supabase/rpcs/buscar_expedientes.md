# `buscar_expedientes`

- **Migración:** [`20261128000900_48_edad_en_expediente.sql`](../../migrations/20261128000900_48_edad_en_expediente.sql) *(actualiza [`20261126000700_17_rpc_busqueda_expedientes.sql`](../../migrations/20261126000700_17_rpc_busqueda_expedientes.sql))*
- **Permiso RBAC:** `tiene_permiso('expediente.ver')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico` (`recepcion` y `umeca` denegados).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_termino` | `text` | Sí | Término de búsqueda (CURP de 18, folio `SEM-...` o nombre). Mínimo `3` caracteres tras `btrim`. |
| `p_limite` | `int` | No | Default `20`; acotado entre `1` y `100`. |
| `p_incluir_archivados` | `boolean` | No | Default `false`. Si es `false`, excluye fichas con `estado = 'archivado'`. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `ficha_id` | `uuid` | ID de la ficha activa. |
| `folio` | `text` | Folio `SEM-AAAA-NNNN`. |
| `estado` | `public.estado_ficha` | Estado del expediente. |
| `persona_id` | `uuid` | ID de la persona atendida. |
| `curp` | `text` | CURP de 18 caracteres. |
| `nombre_completo` | `text` | Nombre completo concatenado. |
| `sexo` | `text` | `'H'` o `'M'`. |
| `fecha_nacimiento` | `date` | Fecha de nacimiento calculada desde CURP. |
| `edad` | `integer` | Edad calculada en servidor (`calcular_edad()`), `null` si falta `fecha_nacimiento`. |
| `en_lista_urgencias` | `boolean` | `true` si la ficha aparece en `vista_lista_urgencias`. |
| `coincidencia` | `text` | `'curp'`, `'folio'` o `'nombre'`. |
| `similitud` | `real` | Puntuación `0..1` (`1.0` en CURP/folio; `pg_trgm` + `unaccent` en nombre). |

## 3. Reglas ABAC y efectos secundarios
- Solo incluye `ficha_registro.activo = true` y `persona.activo = true`.
- Búsqueda por nombre insensible a mayúsculas y acentos (`extensions.unaccent` + `extensions.similarity`).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso (`recepcion`, `umeca`, inactivo o sin sesión). |
| `23514` | `p_termino` vacío o con menos de `3` caracteres. |
