# Agenda

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Estados de una cita: `agendada → confirmada → asistio | no_asistio`, o `cancelada`, o `reagendada` (la cita vieja; la nueva nace `agendada`).

| Quién pone el estado | Estado |
|---|---|
| Alta de cita (`.from('cita').insert`) | `agendada` |
| `cambiar_estado_cita` | `confirmada`, `cancelada`, `no_asistio` |
| `reagendar_cita` | `reagendada` (vieja) + `agendada` (nueva) |
| `registrar_seguimiento` | `asistio` |

**Alcance por rol** (lo aplican todas las RPC de este archivo y la RLS de `cita`):

| Rol | Ve | Gestiona (confirmar / cancelar / no asistió) | Crea y reagenda |
|---|---|---|---|
| Tit, Sub | Todas las áreas | Todas las áreas | Todas las áreas |
| Recepción | Trabajo Social, Psicología y Jurídico | Trabajo Social, Psicología y Jurídico | Trabajo Social, Psicología y Jurídico |
| Trabajo Social | Trabajo Social y Psicología | Solo Trabajo Social | No |
| Psicología | Solo su área | Solo su área | Solo Psicología |
| Jurídico | Solo su área | Solo su área | Solo Jurídico |

> **Regla de creación (permiso `agenda.crear` + `puede_crear_cita_en_area`, migración `_42_agenda_busqueda_umeca`, que sustituye a la de `_40`):** Recepción crea en TS, Psicología y Jurídico; Jurídico solo en Jurídico; Psicología solo en Psicología; Titular y Subdirección en cualquier área; Trabajo Social no crea. Como reagendar genera una cita nueva, sigue la misma regla, y la próxima cita de `registrar_seguimiento` también. Las citas UMECA (`origen = 'umeca'`) se consultan con `get_umeca_citas()`.
>
> Para elegir a la persona al crear la cita, usar el autocompletado [`buscar_personas_agenda`](#buscar_personas_agenda).
>
> Crear una cita nueva no tiene RPC: es un `insert` directo sobre `cita`. Ver [tablas-directas.md](./tablas-directas.md#cita).

---

## `get_agenda`

> Citas de un rango de fechas, ya filtradas por lo que el rol puede ver.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Empleado activo (valida rol en el SQL) | Todos los empleados | Lectura | No | `_22_rpc_agenda` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_agenda', {
  p_desde: inicioDelDia.toISOString(),
  p_hasta: inicioDelDiaSiguiente.toISOString(),
  p_estados: ['agendada', 'confirmada'],
});
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_desde` | `string` | Sí | ISO con zona. Inclusivo. |
| `p_hasta` | `string` | Sí | ISO con zona. **Exclusivo**. Mayor que `p_desde` y máximo 31 días después. |
| `p_area_id` | `number \| null` | No | Filtra un área. Si pides un área fuera de tu alcance, simplemente no salen filas. |
| `p_estados` | `EstadoCita[] \| null` | No | Sin él trae **todos** los estados, incluidas canceladas y reagendadas. |
| `p_limite` | `number` | No | `1..200`, default 200. Fuera de rango da `23514`. |

**Respuesta** (arreglo, ordenado por `programada_en` ascendente)

```ts
interface AgendaRow {
  cita_id: string;
  programada_en: string;
  estado: EstadoCita;
  prioridad: 'alta' | 'media' | 'baja' | null;
  area_id: number;
  area_clave: 'trabajo_social' | 'psicologia' | 'juridico' | string;
  recomendada_por: string | null;
  reagendada_de: string | null;      // id de la cita original si es reagendada
  origen: 'regular' | 'umeca';       // umeca = asistencia obligatoria
  persona_id: string;
  nombre_completo: string;
  celular: string | null;
}
```

**Comportamiento**

- Para "citas de mañana" (confirmación por teléfono, SF-06) calcula el rango en `America/Mazatlan` y manda `p_estados: ['agendada']`.
- No expone CURP.

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Sin sesión, inactivo, UMECA, app | Fijo de permiso |
| `23514` | Rango nulo o invertido, más de 31 días, `p_limite` fuera de `1..200` | `error.message` |

**En el front:** `SupabaseCitaRepository.listarAgenda` · hook `agenda/useAgenda` · `queryKey ['agenda', desde, hasta, area]`.

---

## `cambiar_estado_cita`

> Confirmar, cancelar o marcar que no asistió.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Empleado activo + alcance de área | Todos los empleados (ver tabla de alcance) | Escritura | Sí, por trigger | `_22_rpc_agenda` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('cambiar_estado_cita', { p_cita_id: citaId, p_estado: 'cancelada', p_motivo: 'La usuaria pidió cancelar' })
  .single();
// data: { cita_id, estado, confirmada_en }
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_cita_id` | `string` | Sí | Cita activa. |
| `p_estado` | `'confirmada' \| 'cancelada' \| 'no_asistio'` | Sí | Otro valor da `23514`. |
| `p_motivo` | `string \| null` | No | Se guarda solo al cancelar. Hasta 500 caracteres. |

**Transiciones válidas**

| Desde | Hacia |
|---|---|
| `agendada` | `confirmada` (pone `confirmada_en = now()`), `cancelada`, `no_asistio` |
| `confirmada` | `cancelada`, `no_asistio` |

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Sin permiso, o cita fuera del alcance del rol (por ejemplo, Psicología sobre Jurídico) | Fijo de permiso |
| `23514` | Cita inexistente, estado destino inválido, motivo largo o transición no permitida | `error.message` |

**En el front:** `SupabaseCitaRepository.cambiarEstado` · `agenda/useCambiarEstadoCita` (invalida `['agenda']` y `['agenda','urgencias']`).

---

## `reagendar_cita`

> Mueve una cita a otra fecha conservando el historial: la vieja queda `reagendada` y se crea una nueva `agendada` que apunta a ella.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `agenda.crear` + alcance de área | Recepción (3 áreas), Jurídico y Psicología (su área), Dirección (todas). TS: `42501` | Escritura | Sí, por trigger | `_23_rpc_reagendar_y_urgencias`, `_40_agenda_permisos_creacion` y `_42_agenda_busqueda_umeca` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('reagendar_cita', {
    p_cita_id: citaId,
    p_nueva_fecha: '2026-12-02T09:30:00-07:00',
    p_motivo: 'Cambio de horario laboral',
    p_prioridad: null,   // null = conserva la prioridad de la cita original
  })
  .single();
```

**Respuesta**

```ts
interface ReagendarCitaRow {
  cita_anterior_id: string;
  cita_nueva_id: string;
  programada_en: string;
  estado: 'agendada';
}
```

**Comportamiento**

- Solo reagenda citas `agendada` o `confirmada`.
- La nueva cita copia área, persona, `recomendada_por` y `origen`.
- Una cita solo se puede reagendar una vez; para volver a moverla, reagenda la **nueva**.
- La regla de mayoría de edad (RN-01) también aplica: Psi/Jur no pueden tener citas de menores.

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Sin permiso o cita fuera del alcance | Fijo de permiso |
| `23514` | Cita inexistente, fecha nula o pasada, motivo de más de 500, estado no reagendable, menor de edad en Psi/Jur | `error.message` |
| `23505` | Esa cita ya fue reagendada | `error.message`. Refrescar la agenda. |

**En el front:** `SupabaseCitaRepository.reagendar` · `agenda/useReagendarCita` (invalida `['agenda']` y `['agenda','urgencias']`).

---

## `get_lista_urgencias`

> RF-07: expedientes cuya prioridad más reciente es alta y que todavía no tienen cita próxima. Sale primero quien lleva más tiempo esperando.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| Rol (valida en el SQL) | Tit, Sub, TS, Psi, Rec | Lectura | No | `_23_rpc_reagendar_y_urgencias` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_lista_urgencias', { p_area_id: null });
```

**Respuesta** (arreglo)

```ts
interface UrgenciaRow {
  persona_id: string;
  ficha_id: string;
  folio: string;
  nombre_completo: string;
  celular: string | null;
  area_ultima_prioridad: string;   // clave del área que marcó la prioridad
  fecha_ultima_prioridad: string;  // 'YYYY-MM-DD'
}
```

**Comportamiento**

- Toma la atención más reciente con prioridad de cada expediente `abierto` o `en_seguimiento`; si es `alta` y la persona no tiene cita futura `agendada`/`confirmada`, aparece.
- En cuanto se agenda una cita, la persona sale de la lista.
- No expone CURP ni notas.
- Reemplaza la lectura directa de `vista_lista_urgencias`, que Recepción no podía usar.

**Errores:** `42501` para Jurídico, UMECA, app o inactivos.

**En el front:** hoy `SupabaseDashboardRepository` lee `vista_lista_urgencias`; cambiar a esta RPC · `agenda/useListaUrgencias` · `queryKey ['agenda','urgencias']`.

---

## `buscar_personas_agenda`

> Autocompletado de la persona al crear una cita: nombre (sin acentos) o prefijo de CURP, solo personas con expediente activo y no archivado.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `agenda.crear` | Recepción, Jurídico, Psicología, Titular, Subdirección. TS y UMECA: `42501` | Lectura | No (datos enmascarados) | `_42_agenda_busqueda_umeca` |

**Llamada**

```ts
const { data, error } = await supabase.rpc('buscar_personas_agenda', {
  p_q: 'maria lop',   // mínimo 3 caracteres; con menos devuelve []
  p_limite: 10,       // opcional, 1..25 (default 10)
});
```

**Respuesta**

```ts
interface PersonaAgendaRow {
  persona_id: string;           // el que va en cita.persona_id
  ficha_id: string;
  folio: string;
  nombre_completo: string;
  curp_enmascarada: string | null;   // 'PEPZ******01'
  celular: string | null;
}
```

**Comportamiento:** todos los términos del texto deben aparecer en el nombre (sin acentos ni mayúsculas); también coincide por prefijo de CURP. Orden: CURP, nombre que empieza con el texto, resto; luego por nombre. Detalle: [rpcs/buscar_personas_agenda.md](../rpcs/buscar_personas_agenda.md).

**Errores:** `42501` sin `agenda.crear`.

**En el front:** `PersonaSearchField` del formulario de nueva cita · debounce ≥ 250 ms · no llamar con menos de 3 caracteres.

---

## `get_umeca_citas`

> Vista de UMECA: nombre, fecha, estado y área de las citas que UMECA canalizó.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `usuario_externo` activo con dependencia `umeca` | UMECA | Lectura | Sí: `'ver'` sobre `cita` en cada consulta | `_05_vistas` y `_42_agenda_busqueda_umeca` (área) |

**Llamada**

```ts
const { data, error } = await supabase.rpc('get_umeca_citas');
```

**Respuesta**

```ts
interface UmecaCitaRow {
  cita_id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  programada_en: string;
  estado: 'pendiente' | 'asistio' | 'no_asistio' | 'cancelo';
  area_clave: string;    // 'trabajo_social' | 'psicologia' | 'juridico'
  area_nombre: string;
}
```

**Comportamiento**

- Solo citas con `origen = 'umeca'`, activas y que no estén `reagendada` (sale la nueva).
- `agendada` y `confirmada` se muestran como `pendiente`; `cancelada` como `cancelo`.

**Errores:** `42501` para cualquier usuario que no sea UMECA activo.

**En el front:** pantalla de UMECA (consulta). No usar `vista_umeca_cita` directo.
