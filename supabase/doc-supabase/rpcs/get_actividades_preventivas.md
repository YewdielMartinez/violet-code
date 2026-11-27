# RPC: `public.get_actividades_preventivas`

- **Versión:** [`20261128002800_69`](../../migrations/20261128002800_69_editar_actividad_preventiva.sql)
- **Migración:** `supabase/migrations/20261126001600_26_rpc_actividades_preventivas.sql`
- **Permiso RBAC:** `public.tiene_permiso('actividad.ver')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`, `recepcion`
- **Cubre:** `RF-16` (B-05 · Sprint 01); estado de actividad en `20261127001000_41_actividad_estado.sql`

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_desde` | `timestamptz` | No | Inicio del rango sobre `programada_en` (inclusive). Default `null` |
| `p_hasta` | `timestamptz` | No | Fin del rango sobre `programada_en` (inclusive). Default `null`. Si ambos vienen definidos, `p_desde <= p_hasta` |
| `p_limite` | `integer` | No | Máximo de filas a devolver, rango `1..200`. Default `100` |
| `p_estado` | `public.estado_actividad` | No | Filtra por estado (`pendiente`, `realizada`, `cancelada`). Default `null` (todas) |

## 2. Salida (`table`)

Arreglo de actividades activas ordenadas por `programada_en DESC, creado_en DESC`:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Identificador de `actividad_preventiva` |
| `titulo` | `text` | Título de la actividad |
| `tipo_actividad_id` | `smallint` | FK al catálogo `cat_tipo_actividad` |
| `tipo_actividad_clave` | `text` | Clave del tipo de actividad |
| `tipo_actividad_nombre` | `text` | Nombre del tipo de actividad |
| `tipo_institucion` | `tipo_institucion_actividad` | Tipo de institución sede |
| `nivel_educativo` | `nivel_educativo` | Nivel educativo (si aplica) |
| `sede` | `text` | Nombre del plantel, empresa o recinto |
| `direccion` | `text` | Dirección opcional |
| `referencias` | `text` | Referencias opcionales |
| `asentamiento_id` | `integer` | FK opcional a `cat_asentamiento` |
| `asentamiento_nombre` | `text` | Nombre de la colonia/asentamiento |
| `codigo_postal` | `text` | Código postal del asentamiento |
| `municipio` | `text` | Municipio del asentamiento |
| `programada_en` | `timestamptz` | Fecha y hora programada |
| `numero_asistentes` | `smallint` | Número de asistentes registrados |
| `creado_por` | `uuid` | UUID del empleado que registró |
| `creado_por_nombre` | `text` | Nombre del empleado que registró |
| `creado_en` | `timestamptz` | Fecha de creación del registro |
| `participantes` | `jsonb` | Arreglo JSON de `{ empleado_id, nombre, rol }` ordenado por `nombre` (`[]` si no hay) |
| `estado` | `estado_actividad` | `pendiente`, `realizada` o `cancelada` |
| `realizada_en` | `timestamptz` | Momento en que se marcó realizada (`null` si no lo está) |
| `cancelada_motivo` | `text` | Motivo de cancelación (opcional) |
| `observaciones_cierre` | `text` | Observaciones al marcarla realizada (opcional) |
| `actualizado_en` | `timestamptz` | Última modificación; token de bloqueo optimista para `actualizar_actividad_preventiva` |

## 3. Reglas ABAC y efectos secundarios
- Valida `public.tiene_permiso('actividad.ver')` (permite a todo empleado activo incluyendo `recepcion`; rechaza `anon`, UMECA y empleados inactivos).
- Filtra únicamente actividades con `activo = true` y asignaciones de participantes con `activo = true`.
- Operación de solo lectura (`stable`); no escribe en `bitacora_acceso`.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión inválida, `anon`, UMECA o empleado inactivo |
| `23514` | `p_limite` nulo o fuera de `1..200`, o `p_desde > p_hasta` |
