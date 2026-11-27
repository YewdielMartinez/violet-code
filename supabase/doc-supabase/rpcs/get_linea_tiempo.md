# RPC: `public.get_linea_tiempo`

- **Versión:** [`20261128001400_54`](../../migrations/20261128001400_54_quitar_folio_seguimiento.sql)
- **Migración:** `supabase/migrations/20261126001000_20_rpc_linea_tiempo.sql`
- **Permiso RBAC:** `public.tiene_permiso('expediente.ver')`
- **Actores autorizados:** `titular`, `subdireccion` (ven todo), `trabajo_social`, `psicologia`, `juridico` (ven título/estado de todo y detalle solo de lo propio)
- **Cubre:** `RF-25`, `RN-18` (`SF-14` · A-05 · Sprint 01)

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_ficha_id` | `uuid` | Sí | ID de un expediente activo (`public.ficha_registro.activo = true`) |

## 2. Salida (`table`)

Eventos del caso ordenados por `fecha DESC, tipo ASC, referencia_id DESC`:

| Columna | Tipo | Descripción |
|---|---|---|
| `fecha` | `timestamptz` | Fecha/hora del evento |
| `tipo` | `text` | `'registro' \| 'cita' \| 'atencion' \| 'derivacion' \| 'orden_proteccion' \| 'alerta'` |
| `area` | `text` | Nombre del área cuando aplica (o `null`) |
| `titulo` | `text` | Resumen corto del evento y su estado/tipo |
| `detalle` | `text` | Detalle operativo solo para Dirección o el área/rol dueño del evento (`null` en caso contrario) |
| `referencia_id` | `uuid` | Identificador del registro origen |

## 3. Reglas ABAC y efectos secundarios
- Dirección (`titular`, `subdireccion`) ve `detalle` de todos los eventos.
- Áreas operativas (`trabajo_social`, `psicologia`, `juridico`) ven `titulo` y `estado` de todos los eventos del caso, pero `detalle` únicamente de sus propios eventos (citas/atenciones de su `area_id`, derivaciones donde su área es origen o destino, órdenes de protección para `juridico`/`trabajo_social`, alertas para línea 24/7).
- **Nunca** incluye registros ni contenido de `nota_area` ni `historial_clinico`.
- Operación de solo lectura (`stable`).

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión inválida, `anon`, UMECA, empleado inactivo o rol sin `expediente.ver` (`recepcion`) |
| `23514` | `p_ficha_id` nulo o expediente inexistente/inactivo |
