# RPC: `public.actualizar_estado_actividad`

- **Migración:** `supabase/migrations/20261127001000_41_actividad_estado.sql`
- **Permiso RBAC:** `public.tiene_permiso('actividad.registrar')`
- **Actores autorizados:** `titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`
- **Cubre:** `RF-16` (seguimiento de actividades preventivas realizadas, canceladas o pendientes)

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_actividad_id` | `uuid` | Sí | Actividad (`actividad_preventiva.id`) activa |
| `p_estado` | `public.estado_actividad` | Sí | Estado destino: `'pendiente'`, `'realizada'` o `'cancelada'` |
| `p_numero_asistentes` | `integer` | No | Solo se usa al pasar a `'realizada'`; rango `0..10000`. Si es `null` se conserva el valor previo |
| `p_observaciones` | `text` | No | Solo al pasar a `'realizada'`; se guarda en `observaciones_cierre` (`<= 1000`, con `trim`) |
| `p_motivo_cancelacion` | `text` | No | Solo al pasar a `'cancelada'`; se guarda en `cancelada_motivo` (`<= 500`, con `trim`) |

## 2. Salida (`table`, una fila)

| Columna | Tipo | Descripción |
|---|---|---|
| `actividad_id` | `uuid` | Actividad actualizada |
| `estado` | `public.estado_actividad` | Nuevo estado |
| `realizada_en` | `timestamptz` | `now()` si pasó a `'realizada'`; `null` en otro caso |

## 3. Transiciones y efectos

| Desde | Hacia | Efecto |
|---|---|---|
| `pendiente` | `realizada` | `realizada_en = now()`, `observaciones_cierre`, `numero_asistentes` (opcional) |
| `pendiente` | `cancelada` | `cancelada_motivo` (opcional) |
| `realizada` / `cancelada` | `pendiente` | Reapertura: limpia `realizada_en`, `cancelada_motivo` y `observaciones_cierre` |
| `realizada` <-> `cancelada` | — | No permitido directamente: reabrir primero (`22023`) |
| mismo estado | — | `22023` `La actividad ya está en ese estado` |

- `actualizado_en` lo mantiene el trigger `set_actualizado_en` (la tabla no tiene `actualizado_por`).
- Registra una fila `actualizar` sobre `actividad_preventiva` en `bitacora_acceso`.
- Bloquea la fila (`FOR UPDATE`) para evitar carreras entre dos cambios de estado.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sin permiso `actividad.registrar` (`recepcion`, `umeca`, `anon`, empleado inactivo): `Sin permiso para actualizar actividades` |
| `22023` | `p_actividad_id` o `p_estado` nulos, mismo estado, o transición `realizada <-> cancelada` directa |
| `23514` | `p_numero_asistentes` fuera de `0..10000`, observaciones `> 1000` o motivo `> 500` |
| `P0002` | Actividad inexistente o inactiva |
