# RPC: `public.get_bitacora_filtros`

- **Versión:** [`20261128003300_74`](../../migrations/20261128003300_74_bitacora_consulta.sql)
- **Migración:** `supabase/migrations/20261128003300_74_bitacora_consulta.sql`
- **Permiso RBAC:** `public.tiene_permiso('bitacora.ver')`
- **Actores autorizados:** `titular`, `subdireccion`
- **Cubre:** `RF-22.1` (opciones de los filtros «Tabla» y «Acción» de la pantalla «Bitácora»)

## 1. Entrada (parámetros)

Sin parámetros.

## 2. Salida (`table`)

Ordenada por `tipo`, `valor`:

| Columna | Tipo | Descripción |
|---|---|---|
| `tipo` | `text` | `'tabla'` (tablas con al menos un evento) o `'accion'` (valores del enum `accion_bitacora`) |
| `valor` | `text` | Nombre de la tabla o de la acción |

## 3. Reglas ABAC y efectos secundarios
- Solo Dirección (`tiene_permiso('bitacora.ver')`). Solo lectura (`stable`); no escribe en bitácora.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Actor sin permiso `bitacora.ver` o sesión inválida |
