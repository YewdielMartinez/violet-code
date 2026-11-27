# RPC: `public.get_historial_canalizaciones`

- **Versión:** [`20261127000300_34`](../../migrations/20261127000300_34_historial_canalizaciones.sql)
- **Migración:** `supabase/migrations/20261127000300_34_historial_canalizaciones.sql`
- **Cubre:** `RF-08`, `RF-25` (Sprint 02 · A-02)

## Actores autorizados
- `titular`, `subdireccion`, `trabajo_social`: ven todas las canalizaciones activas del expediente con sus eventos (`tiene_permiso('derivacion.gestionar')`).
- `psicologia`, `juridico`: ven únicamente las canalizaciones del expediente donde su `area_id` sea `area_origen_id` o `area_destino_id`.
- `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar: rechazados con `42501`.

## Entrada
```ts
{
  p_ficha_id: string; // UUID del expediente activo
}
```

## Salida
Arreglo de canalizaciones activas del expediente ordenadas por `creado_en DESC, id DESC`, cada una con:
- Datos de la canalización: `id`, `ficha_id`, `area_origen_id`, `area_origen_nombre`, `area_destino_id`, `area_destino_nombre`, `institucion_id`, `institucion_nombre`, `institucion_otra`, `destino`, `motivo`, `fecha_derivacion`, `estado`, `creado_en`, `actualizado_en`.
- `eventos`: arreglo `jsonb` ordenado cronológicamente (`creado_en ASC, id ASC`) con `{ id, estado_anterior, estado_nuevo, nota, creado_por, creado_por_nombre, creado_en }`.

## Errores
- `42501`: sin permiso (`derivacion.gestionar`).
- `23514`: `p_ficha_id` nulo o expediente no encontrado/inactivo.
