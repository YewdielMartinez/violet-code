# RPC: `public.cambiar_estado_cita`

- **Migración:** `supabase/migrations/20261126001200_22_rpc_agenda.sql`
- **Cubre:** `RF-06`, `RN-04`, `RN-06` (SF-06, SF-07, SF-09)

## Actores autorizados
- `titular`, `subdireccion`: cualquier cita activa.
- `recepcion`: únicamente citas de `trabajo_social` o `psicologia`.
- `trabajo_social`, `psicologia`, `juridico`: únicamente citas de su propia `area_id`.

## Entrada
```ts
{
  p_cita_id: string;
  p_estado: 'confirmada' | 'cancelada' | 'no_asistio';
  p_motivo?: string | null; // Opcional en cancelación (<= 500 chars)
}
```

## Transiciones válidas
- `agendada` → `confirmada` (asigna `confirmada_en = now()`) | `cancelada` | `no_asistio`
- `confirmada` → `cancelada` | `no_asistio`
- *Nota:* `asistio` lo asigna `registrar_seguimiento` y `reagendada` lo asigna `reagendar_cita`.

## Salida
```ts
[{ cita_id: string; estado: EstadoCita; confirmada_en: string | null }]
```

## Errores
- `42501`: sin permiso o intento de modificar cita de un área fuera de alcance (ej. Recepción sobre Jurídico).
- `23514`: cita inexistente/inactiva, estado destino inválido, motivo > 500 caracteres o transición no permitida.
