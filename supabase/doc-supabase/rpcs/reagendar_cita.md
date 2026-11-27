# RPC: `public.reagendar_cita`

- **Migración:** `supabase/migrations/20261126001300_23_rpc_reagendar_y_urgencias.sql` (regla de creación vigente desde `supabase/migrations/20261127000800_39_agenda_permisos_creacion.sql`)
- **Cubre:** `RF-06`, `RN-04`, `RN-06` (SF-07)

## Actores autorizados
Reagendar **crea una cita nueva**, por lo que sigue la regla de creación (permiso `agenda.crear`):
- `recepcion`: citas de `trabajo_social`, `psicologia` y `juridico`.
- `juridico`: únicamente citas de su propia área (`juridico`).
- `titular`, `subdireccion`, `trabajo_social`, `psicologia`: **no pueden reagendar** (`42501`), aunque sí confirmar/cancelar con `cambiar_estado_cita`.

## Entrada
```ts
{
  p_cita_id: string;
  p_nueva_fecha: string;                // ISO 8601 en el futuro (> now())
  p_motivo?: string | null;             // Opcional (<= 500 chars)
  p_prioridad?: PrioridadNivel | null;  // Si es null, copia la de la cita original
}
```

## Salida
```ts
[{
  cita_anterior_id: string;
  cita_nueva_id: string;
  programada_en: string;
  estado: 'agendada';
}]
```

## Errores
- `42501`: sin autenticación, inactivo, rol sin `agenda.crear` (Dirección, TS, Psicología) o cita fuera del alcance (ej. Jurídico sobre Psicología).
- `23505`: la cita ya fue reagendada anteriormente (`reagendada_de` es `UNIQUE`).
- `23514`: cita inexistente, fecha pasada/nula, motivo > 500 caracteres, estado no reagendable o menor de edad en Psicología/Jurídico (`RN-01`).
