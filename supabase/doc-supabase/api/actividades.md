# Actividades preventivas (RF-16)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

---

## `registrar_actividad_preventiva`

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
});
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_desde` | `string \| null` | No | Inclusivo, sobre `programada_en`. |
| `p_hasta` | `string \| null` | No | **Inclusivo**. Si vienen ambos, `p_desde <= p_hasta`. |
| `p_limite` | `number` | No | `1..200`, default 100. |

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
}
```

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | UMECA, app, inactivo | Fijo de permiso |
| `23514` | `p_limite` fuera de rango o `p_desde > p_hasta` | `error.message` |

**En el front:** pendiente. Sugerido: `actividades/useActividades` · `queryKey ['actividades', desde, hasta]`.
