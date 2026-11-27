# `actualizar_domicilio`

- **Versión:** [`20261128001000_49`](../../migrations/20261128001000_49_rpc_actualizar_domicilio.sql)
- **Migración:** [`20261128001000_49_rpc_actualizar_domicilio.sql`](../../migrations/20261128001000_49_rpc_actualizar_domicilio.sql)
- **Permiso RBAC:** `tiene_permiso('expediente.escribir')` (`titular`, `subdireccion`, `trabajo_social`).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_persona_id` | `uuid` | Sí | ID de la persona activa. |
| `p_actualizado_en` | `timestamptz` | Condicional | Obligatorio si ya existe un domicilio actual (`23505` si cambió). |
| `p_asentamiento_id` | `integer` | No | ID de `cat_asentamiento` (mutuamente excluyente con `p_codigo_postal`). |
| `p_calle` | `text` | No | Calle (`<= 150`). |
| `p_numero_exterior` | `text` | No | Número exterior (`<= 30`). |
| `p_numero_interior` | `text` | No | Número interior (`<= 30`). |
| `p_referencias` | `text` | No | Referencias (`<= 250`). |
| `p_codigo_postal` | `text` | No | 5 dígitos (`^[0-9]{5}$`), solo si `p_asentamiento_id` es nulo. |
| `p_zona` | `public.zona_geografica` | No | `'urbana'` o `'rural'`. |

## 2. Salida y comportamiento
- Devuelve `domicilio_id`, `persona_id`, `es_actual`, `actualizado_en`.
- Marca el domicilio actual anterior como `es_actual = false` e inserta el nuevo con `es_actual = true`.
- `domicilio_insert` y `domicilio_update` quedan cerrados en `with check (false)`.

## 3. Errores esperados
- `42501`: sin permiso `expediente.escribir` (`psicologia`, `juridico`, `recepcion`, `umeca`, `usuaria_app`).
- `23514`: expediente archivado, persona inexistente, asentamiento + CP juntos o CP distinto de 5 dígitos.
- `23505`: `p_actualizado_en` no coincide con el domicilio actual (concurrencia optimista).
