# `get_mi_perfil`

- **Migración:** [`20261128002800_69_rpc_mi_perfil.sql`](../../migrations/20261128002800_69_rpc_mi_perfil.sql)
- **Permiso RBAC:** Cualquier usuario `authenticated` (filtra por `auth.uid()`; devuelve 0 filas si no tiene perfil de `empleado` ni de `usuario_externo` UMECA).
- **Actores autorizados:** Empleados internos (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`) y externos `umeca`.

## 1. Entrada (`parámetros`)
Sin parámetros (`auth.uid()`).

## 2. Salida (0 o 1 fila)
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | ID del usuario autenticado. |
| `email` | `text` | Correo electrónico de `auth.users`. |
| `nombre` | `text` | Nombre completo del perfil. |
| `tipo` | `text` | `'empleado'` o `'externo'`. |
| `rol` | `text` | Rol del empleado o `'umeca'` para externos UMECA. |
| `area_id` | `smallint` | ID del área (`null` en Dirección, Recepción y UMECA). |
| `area_clave` | `text` | Clave del área o `'umeca'` para externos UMECA (`null` si no aplica). |
| `area_nombre` | `text` | Nombre del área o `'UMECA'` para externos UMECA (`null` si no aplica). |
| `dependencia` | `text` | `'umeca'` en externos; `null` en empleados. |
| `activo` | `boolean` | Si la cuenta está activa. |
| `permisos` | `text[]` | Claves de `tiene_permiso()` que evalúan a `true` para el actor activo (`{}` si inactivo o externo). |

## 3. Reglas
- Si el usuario no existe en `empleado` ni en `usuario_externo` (`dependencia = 'umeca'`), devuelve **0 filas** sin lanzar excepción; el frontend decide el rechazo (`403` + `signOut`).
- `permisos` evalúa las 25 claves vigentes de [`tiene_permiso`](../../migrations/20261128002600_67_historial_clinico_psicologia.sql).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Rol `anon` (sin sesión). |
