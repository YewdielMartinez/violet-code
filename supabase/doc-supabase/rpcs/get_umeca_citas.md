# `get_umeca_citas`

- **Migración:** [`20261125000500_05_vistas.sql`](../../migrations/20261125000500_05_vistas.sql) (versión vigente con `area_clave` / `area_nombre`: [`20261127001100_42_agenda_busqueda_umeca.sql`](../../migrations/20261127001100_42_agenda_busqueda_umeca.sql))
- **Permiso RBAC:** sin `tiene_permiso`; actor externo: `usuario_externo` activo con `dependencia = 'umeca'` (`es_umeca()`).
- **Actores autorizados:** UMECA. Cualquier otro usuario recibe `42501`.

## 1. Entrada (`parámetros`)
Sin parámetros.

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `cita_id` | `uuid` | ID de la cita. |
| `nombres` | `text` | Nombres de la persona. |
| `apellido_paterno` | `text` | Apellido paterno. |
| `apellido_materno` | `text` | Apellido materno (`null` si no hay). |
| `programada_en` | `timestamptz` | Fecha y hora de la cita. |
| `estado` | `text` | `pendiente` (agendada/confirmada), `asistio`, `no_asistio` o `cancelo`. |
| `area_clave` | `text` | Clave del área de la cita (`trabajo_social`, `psicologia`, `juridico`). *Nueva en la migración 42.* |
| `area_nombre` | `text` | Nombre legible del área. *Nueva en la migración 42.* |

## 3. Reglas ABAC y efectos secundarios
- Solo citas con `origen = 'umeca'`, `activo = true` y `estado <> 'reagendada'` (sale la cita nueva).
- Registra `'ver'` sobre `cita` en `bitacora_acceso` (con `usuario_externo_id`) en cada consulta.
- La migración 42 hizo `drop function` + `create function` para ampliar las columnas; parámetros, comportamiento y grants (`authenticated`, revocado a `public` y `anon`) no cambian.

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Usuario que no es UMECA activo (empleado, app móvil, inactivo o sin sesión). |
