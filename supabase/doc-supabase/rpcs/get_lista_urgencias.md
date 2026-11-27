# RPC: `public.get_lista_urgencias`

- **Migración:** [`20261128001300_52_urgencias_por_expediente.sql`](../../migrations/20261128001300_52_urgencias_por_expediente.sql) *(actualiza `47_tiene_permiso_agenda_alertas.sql` y `23_rpc_reagendar_y_urgencias.sql`)*
- **Cubre:** `RF-07`, `RN-06` (SF-07)

## Actores autorizados
- `titular`, `subdireccion`, `recepcion`, `trabajo_social`, `psicologia` (permiso `urgencias.ver`).
- `juridico`, `umeca`, `anon` o empleados inactivos: rechazados con `42501`.

## Entrada
```ts
{
  p_area_id?: number | null; // Filtra por área solicitada o con atención en el expediente (opcional)
}
```

## Salida
Ordenada por `coalesce(prioridad_actualizada_en, creado_en) ASC`:
- `persona_id`, `ficha_id`, `folio`, `nombre_completo`, `celular`
- `prioridad_actualizada_en`
- *(No expone CURP ni notas clínicas/privadas).*

## Reglas
- Considera expedientes `abierto` o `en_seguimiento` cuya `ficha_registro.prioridad = 'alta'`.
- Excluye personas que ya cuentan con una cita futura activa en estado `agendada` o `confirmada`.

## Errores
- `42501`: sin permiso `urgencias.ver` o rol no autorizado.
