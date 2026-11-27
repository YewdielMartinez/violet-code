# RPC: `public.get_mi_perfil`

- **Versión:** [`20261128003100_72`](../../migrations/20261128003100_72_mi_perfil.sql)
- **Migración:** `supabase/migrations/20261128003100_72_mi_perfil.sql`
- **Permiso RBAC:** ninguno por clave; propiedad por `auth.uid()` + tipo de cuenta (`auth_tipo_cuenta()` = `empleado` o `externo`)
- **Actores autorizados:** cualquier persona del panel: `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion` y `umeca`. La usuaria móvil y la sesión anónima reciben `42501`.
- **Cubre:** pantalla «Mi perfil» (`/perfil`) del panel web.

## 1. Entrada (parámetros)

Sin parámetros: siempre devuelve el perfil de `auth.uid()`.

## 2. Salida (`table`, una fila)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | `empleado.id` / `usuario_externo.id` (= `auth.users.id`) |
| `tipo` | `text` | `empleado` o `externo` |
| `nombre` | `text` | Nombre completo |
| `correo` | `text` | Correo de acceso (`auth.users.email`); solo lectura |
| `telefono` | `text` | 10 dígitos o `null` |
| `rol` | `text` | Rol del empleado, o `umeca` para el usuario externo |
| `area_id` | `smallint` | Área del empleado (`null` si no tiene o es UMECA) |
| `area_clave` | `text` | `trabajo_social`, `psicologia`, `juridico` o `null` |
| `area_nombre` | `text` | Nombre del área o `null` |
| `dependencia` | `text` | `umeca` para externos; `null` para empleados |
| `activo` | `boolean` | Estado de la cuenta |
| `permisos` | `text[]` | Claves de `tiene_permiso()` que son `true` para quien llama, ordenadas (`[]` para UMECA) |
| `creado_en` | `timestamptz` | Alta de la cuenta |

## 3. Reglas ABAC y efectos secundarios

- Solo lectura; no escribe en `bitacora_acceso`.
- `permisos` = `permisos_catalogo()` filtrado con `tiene_permiso(<clave>)`. **Mantenimiento:** `public.permisos_catalogo()` es la lista de claves del `case` de `tiene_permiso()` (hoy la migración 71). Cuando una migración agregue o quite una clave en `tiene_permiso()` debe redefinir `permisos_catalogo()` en la misma migración; `supabase/tests/72_mi_perfil.test.sql` compara ambas listas y falla si se desincronizan.
- `anon` no tiene `EXECUTE`.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin sesión, o cuenta sin perfil de panel (p. ej. usuaria de la app móvil) |
