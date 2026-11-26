# Atención (hoja de seguimiento)

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

---

## `registrar_seguimiento`

> Cierra una sesión de atención en una sola llamada: marca la asistencia a la cita, crea la hoja de seguimiento (`atencion`), pasa el expediente a `en_seguimiento` y, si se pide, agenda la próxima cita.

| Permiso | Roles | Tipo | Bitácora | Migración |
|---|---|---|---|---|
| `seguimiento.registrar` + tener área | TS, Psi, Jur (cada quien en su área) | Escritura | Sí, por triggers (`'crear'`/`'actualizar'`) | `_19_rpc_registrar_seguimiento` |

> ⚠️ Esta RPC todavía no aparece en `database.types.ts`. Regenera los tipos antes de usarla, o TypeScript marcará el nombre como inválido.

**Llamada**

```ts
const { data, error } = await supabase
  .rpc('registrar_seguimiento', {
    p_ficha_id: fichaId,
    p_cita_id: citaId,                    // null si fue atención sin cita
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
| `p_cita_id` | `string \| null` | No | Cita de la misma persona y del área del actor, en `agendada` o `confirmada`. |
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
  cita_proxima_id: string | null;   // solo si mandaste p_proxima_cita_en
  es_primera_vez_area: boolean;     // RN-19: primera atención de esa ficha en esa área
  tiene_historial_clinico: boolean; // útil en Psicología para pedir el historial si aún no existe
}
```

**Comportamiento**

- El área sale siempre del actor (`auth_area_id()`); el front no la manda.
- Si hay `p_cita_id`, la cita pasa a `asistio`.
- Si el expediente estaba `abierto`, pasa a `en_seguimiento`.
- Psicología y Jurídico no pueden atender a menores de 18 años (RN-01): lo bloquea un trigger con `23514`.
- Todo ocurre en una transacción: si falla la próxima cita, tampoco se guarda la atención.
- Si `tiene_historial_clinico` es `false` y el actor es de Psicología, la UI debería abrir el formulario de historial clínico (ver [tablas-directas.md](./tablas-directas.md#historial_clinico)).

**Errores**

| Código | Cuándo | Mensaje UI |
|---|---|---|
| `42501` | Tit, Sub, Rec, UMECA, app; o actor sin área asignada | Fijo de permiso |
| `23514` | Ficha o cita inexistente; tipo de atención de otra área; cita de otra persona o área; cita que no está agendada ni confirmada; próxima cita en el pasado; menor de edad en Psi/Jur | `error.message` |
| `23505` | Esa cita ya tiene hoja de seguimiento | `error.message`. Refrescar el detalle del expediente. |

**En el front:** pendiente. Sugerido: modelo `Seguimiento.ts` · `SeguimientoRepository.registrar` · `SupabaseSeguimientoRepository` · hook `expedientes/useRegistrarSeguimiento`, que invalida `['expedientes','detail',fichaId]`, `['agenda']` y `['linea-tiempo',fichaId]`.
