# Actividades preventivas (RF-16)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

---

## `registrar_actividad_preventiva`

**Versión:** [`20261126001600_26`](../../migrations/20261126001600_26_rpc_actividades_preventivas.sql)

> Alta de una plática, taller o campaña, con el personal que participó. Todo en una transacción.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `actividad.registrar` | Tit, Sub, TS, Psi, Jur | Escritura | Sí, por trigger | `_26_rpc_actividades_preventivas` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('registrar_actividad_preventiva', {
    p_payload: {
      titulo: 'Plática de prevención de violencia en el noviazgo',
      tipo_actividad_id: 2,
      tipo_institucion: 'escuela',
      nivel_educativo: 'secundaria',
      sede: 'Secundaria Técnica 45',
      direccion: null,
      referencias: null,
      asentamiento_id: 1234,
      programada_en: '2026-12-05T09:00:00-07:00',
      numero_asistentes: 80,
      participantes_ids: [empleadaA, empleadaB],
    },
  })
  .single();
// data: { actividad_id, total_participantes }
```

> Ojo: a diferencia de `crear_ficha_completa`, las claves de este payload van en **snake_case**.

**`p_payload`**

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `titulo` | `string` | Sí | 1 a 200 caracteres. |
| `tipo_actividad_id` | `number` | Sí | Debe existir en `cat_tipo_actividad`. |
| `tipo_institucion` | `'escuela' \| 'empresa_privada' \| 'sector_publico' \| 'comunidad' \| 'otro'` | Sí | |
| `nivel_educativo` | `'primaria' \| 'secundaria' \| 'preparatoria' \| 'universidad' \| null` | No | Solo si `tipo_institucion = 'escuela'`. |
| `sede` | `string` | Sí | 1 a 200 caracteres. |
| `direccion` | `string \| null` | No | Hasta 250. |
| `referencias` | `string \| null` | No | Hasta 250. |
| `asentamiento_id` | `number \| null` | No | Debe existir en `cat_asentamiento`. Alimenta el mapa de calor. |
| `programada_en` | `string` | Sí | ISO con zona. |
| `numero_asistentes` | `number \| null` | No | Entero `0..10000`. |
| `participantes_ids` | `string[]` | No | Empleados activos. Se quitan duplicados. |

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Rec, UMECA, app, inactivo | Fijo de permiso |
| `23514` | Cualquier campo faltante o inválido, catálogo inexistente, participante inactivo | `error.message` (dice qué campo) |

**En el front:** pendiente. Sugerido: `ActividadRepository.registrar` · `actividades/useRegistrarActividad` (invalida `['actividades']`).

---

## `get_actividades_preventivas`

**Versión:** [`20261128002400_65`](../../migrations/20261128002400_65_editar_actividad_preventiva.sql)

> Lista de actividades con sus participantes.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `actividad.ver` | Todos los empleados | Lectura | No | `_26_rpc_actividades_preventivas` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_actividades_preventivas', {
  p_desde: '2026-12-01T00:00:00-07:00',
  p_hasta: '2026-12-31T23:59:59-07:00',
  p_limite: 100,
  p_estado: 'realizada', // opcional: 'pendiente' | 'realizada' | 'cancelada'
});
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_desde` | `string \| null` | No | Inclusivo, sobre `programada_en`. |
| `p_hasta` | `string \| null` | No | **Inclusivo**. Si vienen ambos, `p_desde <= p_hasta`. |
| `p_limite` | `number` | No | `1..200`, default 100. |
| `p_estado` | `'pendiente' \| 'realizada' \| 'cancelada' \| null` | No | Filtra por estado. Default `null` (todas). |

**Respuesta** (arreglo, más recientes primero)

```ts
interface ActividadPreventivaRow {
  id: string;
  titulo: string;
  tipo_actividad_id: number;
  tipo_actividad_clave: string;
  tipo_actividad_nombre: string;
  tipo_institucion: TipoInstitucionActividad;
  nivel_educativo: NivelEducativo | null;
  sede: string;
  direccion: string | null;
  referencias: string | null;
  asentamiento_id: number | null;
  asentamiento_nombre: string | null;
  codigo_postal: string | null;
  municipio: string | null;
  programada_en: string;
  numero_asistentes: number | null;
  creado_por: string;
  creado_por_nombre: string;
  creado_en: string;
  participantes: Array<{ empleado_id: string; nombre: string; rol: RolEmpleado }>;  // [] si no hay
  estado: EstadoActividad;            // 'pendiente' | 'realizada' | 'cancelada'
  realizada_en: string | null;
  cancelada_motivo: string | null;
  observaciones_cierre: string | null;
  actualizado_en: string;             // token de bloqueo optimista de actualizar_actividad_preventiva
}
```

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | UMECA, app, inactivo | Fijo de permiso |
| `23514` | `p_limite` fuera de rango o `p_desde > p_hasta` | `error.message` |

**En el front:** pendiente. Sugerido: `actividades/useActividades` · `queryKey ['actividades', desde, hasta]`.

---

## `actualizar_estado_actividad`

**Versión:** [`20261127001000_41`](../../migrations/20261127001000_41_actividad_estado.sql)

> Marca una actividad como realizada, cancelada o la reabre (pendiente). Sirve para llevar el control de qué escuelas, instituciones o empresas ya fueron visitadas.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `actividad.registrar` | Tit, Sub, TS, Psi, Jur | Escritura | Sí (`actualizar`) | `_41_actividad_estado` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('actualizar_estado_actividad', {
    p_actividad_id: actividadId,
    p_estado: 'realizada',
    p_numero_asistentes: 80,           // opcional, 0..10000 (solo al realizar)
    p_observaciones: 'Sin incidentes', // opcional, <= 1000 (solo al realizar)
    p_motivo_cancelacion: null,        // opcional, <= 500 (solo al cancelar)
  })
  .single();
// data: { actividad_id, estado, realizada_en }
```

**Transiciones**

| Desde | Hacia | Efecto |
|---|---|---|
| `pendiente` | `realizada` | `realizada_en = now()`, guarda asistentes y observaciones |
| `pendiente` | `cancelada` | Guarda el motivo (opcional) |
| `realizada` / `cancelada` | `pendiente` | Reapertura: limpia `realizada_en`, motivo y observaciones |
| `realizada` <-> `cancelada` | — | No directo: reabrir primero (`22023`) |

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Rec, UMECA, app, inactivo | Fijo de permiso |
| `22023` | Mismo estado (`La actividad ya está en ese estado`) o transición realizada <-> cancelada | `error.message` |
| `23514` | Asistentes fuera de `0..10000`, observaciones > 1000 o motivo > 500 | `error.message` |
| `P0002` | Actividad inexistente o inactiva | `error.message` |

**En el front:** pendiente. Sugerido: `actividades/useActualizarEstadoActividad` (invalida `['actividades']`).

---

## `actualizar_actividad_preventiva`

**Versión:** [`20261128002400_65`](../../migrations/20261128002400_65_editar_actividad_preventiva.sql)

> Edita los datos de una actividad **pendiente** y reemplaza su personal participante. Lo usa el botón «Editar» del diálogo de detalle.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `actividad.registrar` | Tit, Sub, TS, Psi, Jur | Escritura | Sí (`actualizar`) | `_65_editar_actividad_preventiva` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('actualizar_actividad_preventiva', {
    p_actividad_id: actividad.id,
    p_actualizado_en: actividad.actualizado_en, // de get_actividades_preventivas
    p_payload: {
      titulo: 'Violencia en el noviazgo',
      tipo_actividad_id: 2,
      tipo_institucion: 'escuela',
      nivel_educativo: 'secundaria',
      sede: 'Secundaria Técnica 12',
      direccion: null,
      referencias: null,
      asentamiento_id: 15,
      programada_en: '2026-12-10T09:00:00-07:00',
      numero_asistentes: 80,
      participantes_ids: ['<uuid-empleado>'], // [] quita a todos; omitir conserva
    },
  })
  .single();
// data: { actividad_id, total_participantes, actualizado_en }
```

El `p_payload` usa las mismas claves y validaciones que `registrar_actividad_preventiva`. Contrato completo: [`rpcs/actualizar_actividad_preventiva.md`](../rpcs/actualizar_actividad_preventiva.md).

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Rec, UMECA, app, inactivo | Fijo de permiso |
| `22023` | Actividad no pendiente (`Solo se pueden editar actividades pendientes`) o `p_actualizado_en` / `p_actividad_id` nulos | `error.message` |
| `23505` | Otra persona la modificó (bloqueo optimista) | «Recarga los datos» |
| `23514` | Campo inválido del payload | `error.message` |
| `P0002` | Actividad inexistente o inactiva | `error.message` |

**En el front:** `useActualizarActividadPreventiva` (`features/actividades/api.ts`) · `ActividadDialog` → vista «Editar actividad».
