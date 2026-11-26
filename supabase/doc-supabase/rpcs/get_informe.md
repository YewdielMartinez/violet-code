# RPC: `public.get_informe`

- **Migración:** `supabase/migrations/20261126001800_28_rpc_informes_y_bitacora.sql`
- **Permiso RBAC:** `public.tiene_permiso('informe.ver')`
- **Actores autorizados:** `titular`, `subdireccion` (ven todas las áreas), `trabajo_social`, `psicologia`, `juridico` (cada área ve solo la suya)
- **Cubre:** `RF-13`, `RNF-02` (B-07 · Sprint 01)

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_anio` | `integer` | Sí | Año del informe (`2000..2100`) |
| `p_mes` | `integer` | No | Mes (`1..12`). Si es `null`, devuelve el informe anual desde `vista_informe_anual` |
| `p_area_id` | `smallint` | No | Filtro opcional de área. Para roles de área, si piden un `area_id` distinto al suyo devuelve 0 filas |

## 2. Salida (`table`)

Resumen agregado sin CURP ni nombres de usuarias:

| Columna | Tipo | Descripción |
|---|---|---|
| `anio` | `integer` | Año reportado |
| `mes` | `integer` | Mes reportado (`1..12`), o `null` cuando es informe anual |
| `area_id` | `smallint` | Identificador del área (`cat_area.id`) |
| `area` | `text` | Nombre del área |
| `tipo_atencion` | `text` | Nombre del tipo de atención |
| `primera_vez_o_seguimiento` | `text` | `'primera_vez'` o `'seguimiento'` |
| `mujeres` | `bigint` | Personas distintas con sexo `'M'` |
| `hombres` | `bigint` | Personas distintas con sexo `'H'` |
| `total_personas` | `bigint` | Personas distintas atendidas |
| `total_atenciones` | `bigint` | Total de atenciones registradas |

## 3. Reglas ABAC y efectos secundarios
- Valida RBAC con `public.tiene_permiso('informe.ver')` (`recepcion`, `umeca`, `anon` e inactivos reciben `42501`).
- ABAC: Dirección (`titular`, `subdireccion`) consulta todas las áreas; cada área operativa (`trabajo_social`, `psicologia`, `juridico`) solo consulta filas donde `ca.id = public.auth_area_id()`.
- Cuando no hay atenciones en el periodo devuelve `0` filas sin error.
- Operación de solo lectura (`stable`).

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión inválida, `anon`, UMECA, empleado inactivo o rol sin `informe.ver` (`recepcion`) |
| `23514` | `p_anio` nulo o fuera de `2000..2100`, o `p_mes` fuera de `1..12` |
