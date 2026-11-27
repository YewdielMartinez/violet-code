# `enviar_alerta`

- **Versión:** [`20261128000700_46`](../../migrations/20261128000700_46_rpc_enviar_alerta_y_auth.sql)
- **Migración:** [`20261128000700_46_rpc_enviar_alerta_y_auth.sql`](../../migrations/20261128000700_46_rpc_enviar_alerta_y_auth.sql)
- **Permiso:** `es_usuaria_app()` + `mi_pre_registro_id()` activo.

## 1. Entrada
| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `p_asentamiento_id` | `integer` | No | ID opcional de `cat_asentamiento`. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `alerta_id` | `uuid` | ID de la alerta creada (`origen = 'app_movil'`). |
| `estado` | `public.estado_alerta` | `'nueva'`. |
| `creado_en` | `timestamptz` | Marca de tiempo de creación. |

## 3. Reglas y errores esperados
- El `pre_registro_id` se resuelve siempre desde la sesión (`mi_pre_registro_id()`).
- Límite de **3 alertas por hora** por usuaria (`SQLSTATE 23514` a partir de la cuarta).
- `42501`: cuenta distinta a `usuaria_app` o `INSERT` directo en `public.alerta` desde la app.
- `23514`: sin perfil activo, asentamiento inexistente o límite por hora excedido.
