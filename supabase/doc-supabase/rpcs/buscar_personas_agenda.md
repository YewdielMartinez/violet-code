# `buscar_personas_agenda`

- **Migración:** [`20261127001100_42_agenda_busqueda_umeca.sql`](../../migrations/20261127001100_42_agenda_busqueda_umeca.sql)
- **Permiso RBAC:** `tiene_permiso('agenda.crear')`
- **Actores autorizados:** `recepcion`, `juridico`, `psicologia`, `titular`, `subdireccion` (`trabajo_social` y `umeca` denegados).
- **Uso:** autocompletado de la persona en el formulario de nueva cita. La cita se crea después con la RPC [`crear_cita`](./crear_cita.md) (el `insert` directo sobre `cita` está cerrado).

## 1. Entrada (`parámetros`)
| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_q` | `text` | Sí | Texto a buscar (nombre y apellidos, o prefijo de CURP). Tras `btrim`, si tiene menos de `3` caracteres devuelve **conjunto vacío** (no error). |
| `p_limite` | `int` | No | Default `10`; acotado entre `1` y `25`. |

## 2. Salida
| Columna | Tipo | Descripción |
|---|---|---|
| `persona_id` | `uuid` | ID de la persona (el `persona_id` que va en `cita`). |
| `ficha_id` | `uuid` | Expediente activo y no archivado más reciente de la persona. |
| `folio` | `text` | Folio del expediente. |
| `nombre_completo` | `text` | Nombres + apellido paterno + apellido materno (si existe). |
| `curp_enmascarada` | `text` | 4 primeros caracteres + `******` + 2 últimos (ej. `PEPZ******01`). `null` si la persona no tiene CURP. Nunca se devuelve la CURP completa. |
| `celular` | `text` | Celular de contacto (`null` si no hay). |

## 3. Reglas ABAC y efectos secundarios
- Coincidencia por nombre completo **sin acentos y sin distinguir mayúsculas** (`extensions.unaccent` + `lower`): el texto se separa por espacios y **todos** los términos deben aparecer en el nombre (`zuleima rios` encuentra `Zuleima Peñaloza Ríos`). También coincide por **prefijo de CURP** (el texto se compara en mayúsculas).
- Los comodines de `LIKE` (`%`, `_`, `\`) se escapan: `%%%` no devuelve todo.
- Solo personas con `persona.activo = true` y con al menos un expediente `ficha_registro.activo = true` y `estado <> 'archivado'`. Personas sin expediente quedan fuera.
- Orden: primero CURP por prefijo, luego nombre que **empieza** con el texto, luego el resto; dentro de cada grupo por nombre y folio.
- No escribe en `bitacora_acceso` (igual que `buscar_expedientes`; los datos devueltos van enmascarados y es un autocompletado).
- `STABLE`, `SECURITY DEFINER`, `search_path = public`. `EXECUTE` solo a `authenticated` (revocado a `public` y `anon`).

## 4. Errores esperados
| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `agenda.crear` (`trabajo_social`, `umeca`, inactivo o sin sesión). |
