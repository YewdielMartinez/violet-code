# RPC: `public.get_agenda`

- **Migración:** `supabase/migrations/20261126001200_22_rpc_agenda.sql` (Recepción con Jurídico desde `supabase/migrations/20261127000900_40_agenda_permisos_creacion.sql`)
- **Cubre:** `RF-06`, `RN-04`, `RN-06` (SF-05, SF-06)

## Actores autorizados
- `titular`, `subdireccion`: ven citas de todas las áreas.
- `recepcion`: ve citas de `trabajo_social`, `psicologia` y `juridico`.
- `trabajo_social`: ve únicamente citas de `trabajo_social` y `psicologia`.
- `psicologia`, `juridico`: ven únicamente citas de su propia `area_id`.
- `anon` o empleados inactivos: rechazados con `42501`.

## Entrada
```ts
{
  p_desde: string;                  // ISO 8601 con zona horaria (obligatorio)
  p_hasta: string;                  // ISO 8601 exclusivo (> p_desde, máx. +31 días)
  p_area_id?: number | null;        // Filtra por área específica
  p_estados?: EstadoCita[] | null;  // Filtra por estados (ej. ['agendada'])
  p_limite?: number;                // 1..200 (default 200)
}
```

## Salida
Arreglo ordenado por `programada_en ASC`:
- `cita_id`, `programada_en`, `estado`, `prioridad`
- `area_id`, `area_clave`, `recomendada_por`, `reagendada_de`, `origen`
- `persona_id`, `nombre_completo`, `celular`

## Errores
- `42501`: sin autenticación, inactivo o rol no autorizado.
- `23514`: rango nulo/invertido (`p_hasta <= p_desde`), rango mayor a 31 días o `p_limite` fuera de `1..200`.
