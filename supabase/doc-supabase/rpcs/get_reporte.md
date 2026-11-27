# RPC: `public.get_reporte`

- **Versión:** [`20261128003400_75`](../../migrations/20261128003400_75_reportes_por_area.sql)
- **Migración:** `supabase/migrations/20261128003400_75_reportes_por_area.sql`
- **Permiso RBAC:** `public.tiene_permiso('informe.ver')`
- **Actores autorizados:** `titular`, `subdireccion` (todas las áreas o una a elección), `trabajo_social`, `psicologia`, `juridico` (siempre su propia área)
- **Cubre:** `RF-13` (pantalla «Estadísticas» del panel: reportes por área y periodo, solo lectura)

Complementa a [`get_informe`](./get_informe.md) (migración 28), que solo entiende año / mes de atenciones. `get_informe` se conserva sin cambios.

## 1. Entrada (parámetros)

| Parámetro | Tipo | Obligatorio | Descripción / Regla |
|---|---|---|---|
| `p_tipo` | `text` | Sí | `'atenciones' \| 'citas' \| 'canalizaciones' \| 'ordenes_proteccion' \| 'actividades' \| 'alertas'` |
| `p_desde` | `date` | Sí | Inicio del rango (inclusive), en fecha local `America/Mazatlan` |
| `p_hasta` | `date` | Sí | Fin del rango (inclusive). `p_desde <= p_hasta` y el rango no puede pasar de 1830 días (5 años) |
| `p_area_id` | `smallint` | No | Solo lo respeta Dirección. Las áreas de atención se fuerzan a la suya y el parámetro se ignora |
| `p_agrupar` | `text` | No | `'mes'` (default: una fila por mes, para tendencias), `'periodo'` (todo el rango junto; `mes` sale `null`) o `'total'` (solo `atenciones`: **una** fila sin desglose con las personas distintas de todo el rango y `metrica` = atenciones de primera vez; en los demás tipos equivale a `'periodo'`) |

## 2. Salida (`table`)

Siempre las mismas 11 columnas, todas agregadas. No hay CURP, nombres, folios, teléfonos ni ids de personas, fichas o expedientes.

| Columna | Tipo | Descripción |
|---|---|---|
| `tipo` | `text` | Eco de `p_tipo` |
| `mes` | `date` | Primer día del mes (`p_agrupar = 'mes'`) o `null` |
| `area_id` | `smallint` | Área del conteo (`null` en actividades, alertas y registros sin área) |
| `area` | `text` | Nombre del área |
| `categoria` | `text` | Segunda dimensión según el tipo (ver tabla) |
| `estado` | `text` | Estado según el tipo (ver tabla) |
| `total` | `bigint` | Número de registros |
| `personas` | `bigint` | Personas distintas (solo `atenciones`; `null` en los demás) |
| `mujeres` | `bigint` | Personas distintas con sexo `'M'` (solo `atenciones`) |
| `hombres` | `bigint` | Personas distintas con sexo `'H'` (solo `atenciones`) |
| `metrica` | `numeric` | Métrica secundaria según el tipo (ver tabla) |

| `p_tipo` | Fecha que se usa | `area` | `categoria` | `estado` | `metrica` | Alcance por área |
|---|---|---|---|---|---|---|
| `atenciones` | `atencion.atendida_en` | `atencion.area_id` | tipo de atención | `primera_vez` / `seguimiento` (mismo criterio que `vista_informe_mensual`) | `null` | `atencion.area_id` |
| `citas` | `cita.programada_en` | `cita.area_id` | `null` | `agendada`, `confirmada`, `cancelada`, `reagendada`, `asistio`, `no_asistio` | `null` | `cita.area_id` |
| `canalizaciones` | `derivacion.fecha_derivacion` | área origen (`null` = sin área) | destino (`trabajo_social`, `psicologia`, `juridico`, `fiscalia`, `refugio`, `capacitacion`, `otra_institucion`) | `pendiente`, `en_proceso`, `concluida`, `cancelada` | días promedio entre la derivación y su conclusión (`canalizacion_evento`), solo en `concluida` | área origen **o** destino |
| `ordenes_proteccion` | `orden_proteccion.fecha_emision` | área de quien registró la orden (`empleado.area_id`; `null` = sin área) | `null` | `vigente`, `vencida`, `cancelada`, `en_tramite` | `null` | área de quien la registró |
| `actividades` | `actividad_preventiva.programada_en` | `null` | tipo de institución (`escuela`, `empresa_privada`, `sector_publico`, `comunidad`, `otro`) | `pendiente`, `realizada`, `cancelada` | suma de `numero_asistentes` de las realizadas | sin área: igual para todos los roles con `informe.ver` (`p_area_id` se ignora) |
| `alertas` | `alerta.creado_en` | `null` | origen (`app_movil`, `telefono`, `presencial`) | `nueva`, `tomada`, `atendida` | minutos promedio entre la alerta y su atención, solo en `atendida` | sin área: igual para todos los roles con `informe.ver` (`p_area_id` se ignora) |

Solo cuentan registros con `activo = true`.

## 3. Reglas ABAC y efectos secundarios
- Valida RBAC con `public.tiene_permiso('informe.ver')` (`recepcion`, `umeca`, `anon` e inactivos reciben `42501`).
- ABAC: Dirección (`es_direccion()`) usa `p_area_id` (o todas si es `null`); `trabajo_social`, `psicologia` y `juridico` usan `auth_area_id()`. Si una cuenta de atención no tiene área devuelve 0 filas.
- Sin datos en el rango devuelve 0 filas, sin error.
- Operación de solo lectura (`stable`); no escribe en `bitacora_acceso`.
- Primera vez vs seguimiento usa la misma ventana que las vistas de informe (primera atención de la persona en esa área, en todo el historial), y el rango solo filtra después.

## 4. Errores esperados

| Código (`SQLSTATE`) | Cuándo ocurre |
|---|---|
| `42501` | Sesión inválida, `anon`, UMECA, empleado inactivo o rol sin `informe.ver` (`recepcion`) |
| `23514` | `p_tipo` desconocido, `p_desde` / `p_hasta` nulos, `p_desde > p_hasta`, rango mayor a 5 años o `p_agrupar` distinto de `mes` / `periodo` / `total` |
