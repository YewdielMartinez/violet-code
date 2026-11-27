# Mi perfil (panel web)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Sección **Cuenta** del diálogo de Configuración (menú **Opciones → Configuración**), disponible para todos los roles, incluido UMECA.

---

## `get_mi_perfil`

**Versión:** [`20261128003100_72`](../../migrations/20261128003100_72_mi_perfil.sql) · Contrato: [`rpcs/get_mi_perfil.md`](../rpcs/get_mi_perfil.md)

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `auth.uid()` (propio perfil) | Tit, Sub, TS, Psi, Jur, Rec, UMECA | Lectura | No | `_72_mi_perfil` |

```ts
const { data, error } = await supabase.rpc('get_mi_perfil').single();
// data: { id, tipo, nombre, correo, telefono, rol, area_id, area_clave, area_nombre,
//         dependencia, activo, permisos: string[], creado_en }
```

`permisos` son las claves de `tiene_permiso()` verdaderas para quien llama (vacío para UMECA).

## `actualizar_mi_perfil`

**Versión:** [`20261128003100_72`](../../migrations/20261128003100_72_mi_perfil.sql) · Contrato: [`rpcs/actualizar_mi_perfil.md`](../rpcs/actualizar_mi_perfil.md)

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `auth.uid()` (propio perfil, cuenta activa) | Tit, Sub, TS, Psi, Jur, Rec, UMECA | Escritura | Sí, por trigger | `_72_mi_perfil` |

```ts
const { data, error } = await supabase
  .rpc('actualizar_mi_perfil', { p_nombre: 'Elena Titular', p_telefono: '667 123 4567' })
  .single();
// data: { nombre, telefono }  (telefono normalizado a 10 dígitos, o null)
```

Solo nombre y teléfono. `p_telefono: null` borra el teléfono.

## Cambio de contraseña (Supabase Auth, sin RPC)

1. `supabase.auth.signInWithPassword({ email, password: actual })` para re-validar la contraseña actual.
2. `supabase.auth.updateUser({ password: nueva })`. Regla de la app: mínimo 8 caracteres, con letras y números.

| Código | Mensaje sugerido |
|---|---|
| `42501` | «No tienes permiso para editar este perfil.» |
| `23514` | Mostrar el mensaje de la RPC (nombre o teléfono inválido) |
