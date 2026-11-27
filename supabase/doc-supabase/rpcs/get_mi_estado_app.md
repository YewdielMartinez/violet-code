# `get_mi_estado_app`

- **Versión:** [`20261128000600_45`](../../migrations/20261128000600_45_rpc_perfil_usuaria_app.sql)
- **Migración:** [`20261128000600_45_rpc_perfil_usuaria_app.sql`](../../migrations/20261128000600_45_rpc_perfil_usuaria_app.sql)
- **Permiso:** `es_usuaria_app()` + propiedad por `auth.uid()`.

## Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `tiene_perfil` | `boolean` | `true` si la cuenta tiene `pre_registro` activo. |
| `puede_enviar_alerta` | `boolean` | `true` si tiene perfil activo y no excede el límite por hora (`< 3`). |
| `alertas_ultima_hora` | `integer` | Cantidad de alertas `'app_movil'` enviadas en la última hora. |

Nunca expone `persona_id`, `estado` ni si está ligada a un expediente.
