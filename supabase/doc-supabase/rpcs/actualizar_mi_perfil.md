# RPC: `public.actualizar_mi_perfil`

- **Versión:** [`20261128003100_72`](../../migrations/20261128003100_72_mi_perfil.sql)
- **Migración:** `supabase/migrations/20261128003100_72_mi_perfil.sql`
- **Permiso RBAC:** ninguno por clave; propiedad por `auth.uid()` con `es_empleado_activo()` o `es_umeca()`
- **Actores autorizados:** personal activo (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`) y UMECA activo.
- **Cubre:** edición de datos de contacto desde «Mi perfil».

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_nombre` | `text` | Sí | Se recorta (`btrim`); 1 a 120 caracteres |
| `p_telefono` | `text` | No | Se quitan espacios, guiones, puntos y paréntesis; debe quedar de 10 dígitos. `null` o vacío **borra** el teléfono |

**No editable por aquí:** rol, área, `activo` y correo. La contraseña se cambia desde el front con `supabase.auth.updateUser({ password })` tras validar la contraseña actual con `signInWithPassword` (mínimo 8 caracteres, con letras y números, igual que `crear_cuenta_acceso`).

## 2. Salida (`table`, una fila)

| Columna | Tipo | Descripción |
|---|---|---|
| `nombre` | `text` | Nombre guardado |
| `telefono` | `text` | Teléfono normalizado o `null` |

## 3. Reglas ABAC y efectos secundarios

- Actualiza solo la fila de `auth.uid()` en `empleado` o `usuario_externo`.
- Bitácora: los triggers `empleado_bitacora` / `usuario_externo_bitacora` registran el `UPDATE` como `actualizar`.
- `anon` no tiene `EXECUTE`.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin sesión, cuenta inactiva o sin perfil de panel |
| `23514` | Nombre vacío o de más de 120 caracteres; teléfono que no tiene 10 dígitos |
