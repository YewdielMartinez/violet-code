# Informes, bitácora y mapa de calor

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Ninguna de estas RPC devuelve CURP ni nombres de usuarias.

---

## `get_informe`

**Versión:** [`20261126001800_28`](../../migrations/20261126001800_28_rpc_informes_y_bitacora.sql)

> Informe mensual o anual (RF-13): personas y atenciones por área, tipo de atención y primera vez/seguimiento.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `informe.ver` | Tit, Sub (todas las áreas); TS, Psi, Jur (solo la suya) | Lectura | No | `_28_rpc_informes_y_bitacora` |

**Llamada**

```ts
// Mensual
const { data, error } = await supabase.rpc('get_informe', { p_anio: 2026, p_mes: 11, p_area_id: null });
// Anual: omite p_mes (o mándalo null)
const anual = await supabase.rpc('get_informe', { p_anio: 2026 });
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_anio` | `number` | Sí | `2000..2100`. |
| `p_mes` | `number \| null` | No | `1..12`. `null` = informe anual. |
| `p_area_id` | `number \| null` | No | Dirección puede filtrar cualquier área. Un área que pide otra recibe `[]`. |

**Respuesta** (arreglo)

```ts
interface InformeRow {
  anio: number;
  mes: number | null;            // null en el anual
  area_id: number;
  area: string;
  tipo_atencion: string;
  primera_vez_o_seguimiento: 'primera_vez' | 'seguimiento';
  mujeres: number;               // bigint llega como number
  hombres: number;
  total_personas: number;
  total_atenciones: number;
}
```

**Comportamiento**

- Sin atenciones en el periodo devuelve `[]`; muestra "Sin atenciones en el periodo", no un error.
- Para exportar a Excel o PDF, arma la tabla en el front con estas filas.

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Rec, UMECA, app, inactivo | Vista de "sin acceso" |
| `23514` | Año fuera de `2000..2100` o mes fuera de `1..12` | `error.message` |

**En el front:** pendiente. Sugerido: `informes/useInforme` · `queryKey ['informe', anio, mes, area]`.

---

## `get_bitacora`

**Versión:** [`20261126001800_28`](../../migrations/20261126001800_28_rpc_informes_y_bitacora.sql)

> Consulta de auditoría (RF-22): quién vio, creó o cambió qué y cuándo.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `bitacora.ver` | Tit, Sub | Lectura | No | `_28_rpc_informes_y_bitacora` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_bitacora', {
  p_desde: '2026-11-01T00:00:00-07:00',
  p_hasta: null,
  p_tabla: 'ficha_registro',
  p_empleado_id: null,
  p_limite: 100,
});
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_desde` / `p_hasta` | `string \| null` | No | Ambos inclusivos. `p_desde <= p_hasta`. |
| `p_tabla` | `string \| null` | No | Nombre exacto de la tabla (`'ficha_registro'`, `'agresor'`, `'cita'`, `'alerta'`, ...). |
| `p_empleado_id` | `string \| null` | No | Filtra por empleado. |
| `p_limite` | `number` | No | `1..200`, default 100. |

**Respuesta** (arreglo, más recientes primero)

```ts
interface BitacoraRow {
  id: string;
  accion: 'ver' | 'crear' | 'actualizar' | 'desactivar';
  tabla_afectada: string;
  registro_id: string | null;
  empleado_id: string | null;
  usuario_externo_id: string | null;
  actor_tipo: 'empleado' | 'usuario_externo' | 'sistema';
  actor_nombre: string;           // 'Sistema / App' cuando no hay empleado ni UMECA
  actor_rol: string | null;       // rol del empleado o 'umeca'
  creado_en: string;
}
```

**Comportamiento:** para paginar más allá de 200, usa el `creado_en` de la última fila como nuevo `p_hasta`.

**Errores:** `42501` (cualquiera que no sea Dirección) · `23514` (límite o rango inválido).

**En el front:** pendiente. Sugerido: `auditoria/useBitacora`.

---

## `get_mapa_calor_asentamiento`

**Versión:** [`20261126000500_15`](../../migrations/20261126000500_15_permisos_rbac_abac.sql)

> Conteos por colonia para el mapa de calor: expedientes, alertas y actividades preventivas.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `expediente.ver` | Tit, Sub, TS, Psi, Jur | Lectura | No | `_05_vistas`, actualizada en `_15_` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_mapa_calor_asentamiento', { p_umbral_minimo: 3 });
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_umbral_minimo` | `number` | No | Default 3 (mínimo efectivo 1). Solo salen colonias donde expedientes + alertas sumen al menos ese número, para que no se pueda identificar a nadie. |

**Respuesta** (arreglo)

```ts
interface MapaCalorRow {
  asentamiento_id: number;
  codigo_postal: string;
  nombre: string;
  tipo_asentamiento: string;
  municipio: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  total_expedientes: number;
  total_alertas: number;
  total_actividades: number;
}
```

**Comportamiento:** cuenta expedientes por domicilio actual, alertas con colonia y actividades con colonia. Las colonias sin coordenadas llegan con `latitud`/`longitud` en `null`: no las pintes en el mapa, pero puedes listarlas.

**Errores:** `42501` (Rec, UMECA, app).

**En el front:** dashboard de Dirección.
