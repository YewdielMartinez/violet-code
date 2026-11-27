# Atención (hoja de seguimiento)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

---

## `get_contexto_seguimiento`

> Precarga los datos mínimos para abrir el formulario de seguimiento a partir de la cita del día. Registra acceso `'ver'` en `bitacora_acceso` y nunca expone CURP, estudio socioeconómico, agresor ni notas de otras áreas.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `seguimiento.registrar` + tener área | TS, Psi, Jur (solo citas de su área y de hoy) | Lectura | Sí (`'ver'` en `ficha_registro`) | `_42_rpc_contexto_seguimiento` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('get_contexto_seguimiento', { p_cita_id: citaId })
  .single();
```

**Respuesta** (1 fila)

```ts
interface ContextoSeguimientoRow {
  ficha_id: string;
  folio_expediente: string;
  nombre_persona: string;
  edad: number | null;
  es_primera_vez_area: boolean;
  ultimo_folio_seguimiento: string | null;
  ultima_proxima_accion: string | null;
  tiene_orden_vigente: boolean;
  tiene_historial_clinico: boolean | null; // solo Psicología; null en TS y Jurídico
}
```

---

## `registrar_seguimiento`

> Cierra una sesión de atención en una sola llamada: marca la asistencia a la cita, crea la hoja de seguimiento (`atencion`), pasa el expediente a `en_seguimiento` y, si se pide, agenda la próxima cita.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `seguimiento.registrar` + tener área | TS, Psi, Jur (cada quien en su área) | Escritura | Sí, por triggers (`'crear'`/`'actualizar'`) | `_41_folio_seguimiento` |

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('registrar_seguimiento', {
    p_ficha_id: fichaId,
    p_cita_id: citaId,                    // OBLIGATORIO: cita de hoy (America/Mazatlan)
    p_tipo_atencion_id: tipoAtencionId,   // de cat_tipo_atencion del área del actor
    p_acciones_realizadas: 'Entrevista inicial y plan de intervención',
    p_proxima_accion: 'Valoración psicológica',
    p_prioridad: 'alta',
    p_observaciones: null,
    p_proxima_cita_en: '2026-12-03T10:00:00-07:00',
  })
  .single();
```

**Parámetros**

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `p_ficha_id` | `string` | Sí | Expediente activo. |
| `p_cita_id` | `string` | **Sí** | Cita **de hoy (`America/Mazatlan`)**, de la misma persona y del área del actor, en `agendada` o `confirmada`. Si llega sin cita, crear primero la cita del día (`agendada`). |
| `p_tipo_atencion_id` | `number` | **Sí** (aunque la firma tenga default) | Debe ser un tipo de atención del área del actor. Cárgalo de `cat_tipo_atencion` filtrando por `area_id`. |
| `p_acciones_realizadas` | `string \| null` | No | Hasta 5000 caracteres. |
| `p_proxima_accion` | `string \| null` | No | Hasta 2000 caracteres. |
| `p_prioridad` | `'alta' \| 'media' \| 'baja' \| null` | No | `'alta'` mete al expediente en la lista de urgencias si no tiene cita próxima. |
| `p_observaciones` | `string \| null` | No | Hasta 5000 caracteres. |
| `p_proxima_cita_en` | `string \| null` | No | ISO con zona; debe ser futura. Crea la cita en la misma área. |

**Respuesta** (1 fila)

```ts
interface RegistrarSeguimientoRow {
  atencion_id: string;
  folio_seguimiento: string;        // generado en servidor (provisional: SEG-AAAA-NNNNN)
  cita_proxima_id: string | null;   // solo si mandaste p_proxima_cita_en
  es_primera_vez_area: boolean;     // RN-19: primera atención de esa ficha en esa área
  tiene_historial_clinico: boolean; // útil en Psicología para pedir el historial si aún no existe
}
```

**Comportamiento**

- El área sale siempre del actor (`auth_area_id()`); el front no la manda.
- El `folio_seguimiento` se genera siempre en servidor (`SEG-AAAA-NNNNN` provisional); el front no lo manda ni puede editarlo.
- Exige `p_cita_id` de una cita programada para **hoy** (`America/Mazatlan`) y la pasa automáticamente a `asistio`. Si la persona llega sin cita previa, el flujo crea primero una cita del día (`estado = 'agendada'`) y luego registra el seguimiento.
- Si el expediente estaba `abierto`, pasa a `en_seguimiento`.
- Psicología y Jurídico no pueden atender a menores de 18 años (RN-01): lo bloquea un trigger con `23514`.
- Todo ocurre en una transacción: si falla la próxima cita, tampoco se guarda la atención.
- Si `tiene_historial_clinico` es `false` y el actor es de Psicología, la UI debería abrir el formulario de historial clínico (ver [tablas-directas.md](./tablas-directas.md#historial_clinico)).

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Tit, Sub, Rec, UMECA, app; o actor sin área asignada | Fijo de permiso |
| `23514` | Ficha o cita faltante/inexistente; tipo de atención de otra área; cita de otra persona, de otra área o de otro día (ayer/mañana); cita que no está agendada ni confirmada; próxima cita en el pasado; menor de edad en Psi/Jur | `error.message` |
| `23505` | Esa cita ya tiene hoja de seguimiento | `error.message`. Refrescar el detalle del expediente. |

**En el front:** pendiente. Sugerido: modelo `Seguimiento.ts` · `SeguimientoRepository.registrar` · `SupabaseSeguimientoRepository` · hook `expedientes/useRegistrarSeguimiento`, que invalida `['expedientes','detail',fichaId]`, `['agenda']` y `['linea-tiempo',fichaId]`.
