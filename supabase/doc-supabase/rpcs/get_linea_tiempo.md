# RPC: `public.get_linea_tiempo`

- **Versión:** [`20261128002900_70`](../../migrations/20261128002900_70_orden_proteccion_nota_seguimiento.sql)
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

### Órdenes de protección (migración 66)
- El **alta** de una orden aparece como `Orden de protección · <estado inicial>` (el estado con el que se registró, no el actual).
- Cada **cambio de estado** (`public.orden_proteccion_evento`, alimentada por triggers sobre `orden_proteccion`) aparece como `Orden de protección: <estado anterior> → <estado nuevo>` con `tipo = 'orden_proteccion'`.
- El `detalle` del cambio (`Por <empleado> — <nota>`) solo se muestra a Dirección, `juridico` y `trabajo_social`; el resto ve únicamente el título.
- Una orden archivada (`activo = false`) y sus cambios dejan de aparecer.
- La web guarda la nota opcional en la columna transitoria `orden_proteccion.nota_cambio_estado` dentro del mismo `UPDATE` que cambia el estado; el trigger la copia al evento y la limpia.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión inválida, `anon`, UMECA, empleado inactivo o rol sin `expediente.ver` (`recepcion`) |
| `23514` | `p_ficha_id` nulo o expediente inexistente/inactivo |
