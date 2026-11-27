# RPC: `public.consultar_bitacora`

- **Versión:** [`20261128003300_74`](../../migrations/20261128003300_74_bitacora_consulta.sql)
- **Migración:** `supabase/migrations/20261128003300_74_bitacora_consulta.sql`
- **Permiso RBAC:** `public.tiene_permiso('bitacora.ver')`
- **Actores autorizados:** `titular`, `subdireccion` (solo Dirección)
- **Cubre:** `RF-22`, `RF-22.1` (pantalla «Bitácora» del panel, solo lectura)

Complementa a [`get_bitacora`](./get_bitacora.md) (migración 28), que no filtra por acción, no pagina y no devuelve el total. `get_bitacora` se conserva sin cambios.

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_tabla` | `text` | No | Filtro exacto por `tabla_afectada` (se recortan espacios; vacío = sin filtro) |
| `p_accion` | `text` | No | `'ver' \| 'crear' \| 'actualizar' \| 'desactivar'` (vacío = sin filtro) |
| `p_desde` | `timestamptz` | No | Inicio del rango sobre `creado_en` (inclusive) |
| `p_hasta` | `timestamptz` | No | Fin del rango sobre `creado_en` (inclusive). Si ambos existen, `p_desde <= p_hasta` |
| `p_limite` | `integer` | No | Tamaño de página (`1..200`, default `200`) |
| `p_offset` | `integer` | No | Filas a saltar (`>= 0`, default `0`) |

## 2. Salida (`table`)

Eventos ordenados por `creado_en DESC, id DESC`:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` | Identificador del evento |
| `creado_en` | `timestamptz` | Fecha y hora del evento |
| `actor_tipo` | `text` | `'empleado'`, `'usuario_externo'` o `'sistema'` |
| `actor_nombre` | `text` | Nombre del empleado o de la cuenta UMECA; `'Sistema / App'` sin actor |
| `actor_rol` | `text` | Rol del empleado o dependencia (`'umeca'`); `null` sin actor |
| `tabla_afectada` | `text` | Nombre de la tabla auditada |
| `accion` | `accion_bitacora` | Acción registrada |
| `registro_id` | `text` | Id del registro consultado o modificado |
| `total` | `bigint` | Filas que cumplen los filtros (igual en todas las filas de la página) |

## 3. Reglas ABAC y efectos secundarios
- Solo Dirección (`tiene_permiso('bitacora.ver')`); áreas de atención, recepción, UMECA, `anon` e inactivos reciben `42501`.
- Solo lectura (`stable`). No registra su propia consulta en `bitacora_acceso`.
- **Sin contenido sensible:** `bitacora_acceso` no guarda payload, diff ni texto de notas; solo quién, qué acción, tabla y `registro_id`. La RPC no devuelve más que eso y el nombre/rol de quien actuó.
- Si `offset` supera el total, devuelve cero filas (sin `total`): la pantalla debe regresar a la página 1.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor sin permiso `bitacora.ver` o sesión inválida |
| `23514` | `p_limite` fuera de `1..200`, `p_offset < 0`, `p_accion` fuera del enum o `p_desde > p_hasta` |
