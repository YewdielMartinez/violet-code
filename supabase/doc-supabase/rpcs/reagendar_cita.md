# RPC: `public.reagendar_cita`

- **Migración:** `supabase/migrations/20261128001800_60_integrar_develop_y_supabase.sql` *(versión vigente: base de `50_prioridad_en_expediente.sql`, sin `p_prioridad`, + regla de creación de `42_agenda_busqueda_umeca.sql`; origen en `23_rpc_reagendar_y_urgencias.sql`)*
- **Cubre:** `RF-06`, `RN-04`, `RN-06` (SF-07)

## Actores autorizados
Reagendar **crea una cita nueva**, por lo que sigue la regla de creación (permiso `agenda.crear`):
- `recepcion`: citas de `trabajo_social`, `psicologia` y `juridico`.
- `juridico` y `psicologia`: únicamente citas de su propia área.
- `titular` y `subdireccion`: citas de cualquier área.
- `trabajo_social`: **no puede reagendar** (`42501`), aunque sí confirmar/cancelar con `cambiar_estado_cita`.

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
- `42501`: sin autenticación, inactivo, rol sin `agenda.crear` (TS) o cita fuera del alcance (ej. Jurídico o Psicología sobre otra área).
- `23505`: la cita ya fue reagendada anteriormente (`reagendada_de` es `UNIQUE`).
- `23514`: cita inexistente, fecha pasada/nula, motivo > 500 caracteres, estado no reagendable o menor de edad en Psicología/Jurídico (`RN-01`).
