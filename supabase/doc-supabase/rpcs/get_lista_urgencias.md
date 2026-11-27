# RPC: `public.get_lista_urgencias`

- **Migración:** `supabase/migrations/20261126001300_23_rpc_reagendar_y_urgencias.sql`
- **Cubre:** `RF-07`, `RN-06` (SF-07)

## Actores autorizados
- `titular`, `subdireccion`, `recepcion`, `trabajo_social`, `psicologia`.
- `juridico`, `umeca`, `anon` o empleados inactivos: rechazados con `42501`.

## Entrada
```ts
{
  p_area_id?: number | null; // Filtra por el área donde se registró la última prioridad (opcional)
}
```

## Salida
Ordenada por `fecha_ultima_prioridad ASC`:
- `persona_id`, `ficha_id`, `folio`, `nombre_completo`, `celular`
- `area_ultima_prioridad`, `fecha_ultima_prioridad`
- *(No expone CURP ni notas clínicas/privadas).*

## Reglas
- Considera expedientes `abierto` o `en_seguimiento` cuya atención más reciente con `prioridad IS NOT NULL` tenga `prioridad = 'alta'`.
- Excluye personas que ya cuentan con una cita futura activa en estado `agendada` o `confirmada`.

## Errores
- `42501`: sin permiso o rol no autorizado.
