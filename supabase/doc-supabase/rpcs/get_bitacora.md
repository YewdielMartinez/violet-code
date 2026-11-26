# RPC: `public.get_bitacora`

- **Migración:** `supabase/migrations/20261126001800_28_rpc_informes_y_bitacora.sql`
- **Permiso RBAC:** `public.tiene_permiso('bitacora.ver')`
- **Actores autorizados:** `titular`, `subdireccion` (solo Dirección)
- **Cubre:** `RF-22` (B-07 · Sprint 01)

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_desde` | `timestamptz` | No | Inicio del rango sobre `creado_en` (inclusive) |
| `p_hasta` | `timestamptz` | No | Fin del rango sobre `creado_en` (inclusive). Si ambos existen, `p_desde <= p_hasta` |
| `p_tabla` | `text` | No | Filtro exacto por `tabla_afectada` |
| `p_empleado_id` | `uuid` | No | Filtro por `empleado_id` específico |
| `p_limite` | `integer` | No | Límite de registros (`1..200`, default `100`) |

## 2. Salida (`table`)

Eventos ordenados por `creado_en DESC, id DESC`:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Identificador del evento en `bitacora_acceso` |
| `accion` | `accion_bitacora` | `'ver' \| 'crear' \| 'actualizar' \| 'desactivar'` |
| `tabla_afectada` | `text` | Nombre de la tabla auditada |
| `registro_id` | `text` | ID del registro consultado/modificado |
| `empleado_id` | `uuid` | ID del empleado (si aplica) |
| `usuario_externo_id` | `uuid` | ID de usuario UMECA (si aplica) |
| `actor_tipo` | `text` | `'empleado'`, `'usuario_externo'` o `'sistema'` |
| `actor_nombre` | `text` | Nombre del empleado, usuario UMECA o `'Sistema / App'` |
| `actor_rol` | `text` | Rol del empleado o dependencia (`'umeca'`) |
| `creado_en` | `timestamptz` | Fecha y hora del evento |

## 3. Reglas ABAC y efectos secundarios
- Solo Dirección (`public.tiene_permiso('bitacora.ver')`) puede consultar la bitácora; áreas operativas, `recepcion`, UMECA, `anon` e inactivos son rechazados con `42501`.
- Operación de solo lectura (`stable`).

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor sin permiso `bitacora.ver` o sesión inválida |
| `23514` | `p_limite` nulo o fuera de `1..200`, o `p_desde > p_hasta` |
