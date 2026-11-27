# `desactivar_mi_cuenta`

- **Migración:** [`20261127001300_45_rpc_perfil_usuaria_app.sql`](../../migrations/20261127001300_45_rpc_perfil_usuaria_app.sql)
- **Permiso:** `es_usuaria_app()` + propiedad por `auth.uid()`.

## Comportamiento
- Marca `pre_registro.activo = false` para la cuenta autenticada (impide enviar nuevas alertas).
- Bloquea la cuenta en `auth.users` (`banned_until = '2099-12-31T23:59:59Z'`).
- Devuelve `true` (`boolean`).
