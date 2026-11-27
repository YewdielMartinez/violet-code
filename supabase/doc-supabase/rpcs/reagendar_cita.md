# RPC: `public.reagendar_cita`

- **Migración:** `supabase/migrations/20261128001100_50_prioridad_en_expediente.sql` *(actualiza `47_tiene_permiso_agenda_alertas.sql` y `23_rpc_reagendar_y_urgencias.sql`)*
- **Cubre:** `RF-06`, `RN-04`, `RN-06` (SF-07)

## Actores autorizados
- `titular`, `subdireccion`: cualquier cita activa.
- `recepcion`: únicamente citas de `trabajo_social` o `psicologia`.
- `trabajo_social`, `psicologia`, `juridico`: únicamente citas de su propia `area_id`.

## Entrada
```ts
{
  p_cita_id: string;
  p_nueva_fecha: string;                // ISO 8601 en el futuro (> now())
  p_motivo?: string | null;             // Opcional (<= 500 chars)
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
- `42501`: sin autenticación, inactivo o cita fuera del alcance del rol (ej. Recepción sobre Jurídico).
- `23505`: la cita ya fue reagendada anteriormente (`reagendada_de` es `UNIQUE`).
- `23514`: cita inexistente, fecha pasada/nula, motivo > 500 caracteres, estado no reagendable o menor de edad en Psicología/Jurídico (`RN-01`).
