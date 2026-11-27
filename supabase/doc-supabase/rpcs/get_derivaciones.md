# RPC: `public.get_derivaciones`

- **Versión:** [`20261127000300_34`](../../migrations/20261127000300_34_historial_canalizaciones.sql)
- **Migración:** `supabase/migrations/20261126001500_25_rpc_derivaciones.sql`
- **Cubre:** `RF-08`, `RN-03`, `RN-11` (SF-04)

## Actores autorizados
- `titular`, `subdireccion`, `trabajo_social`: ven todas las derivaciones activas.
- `psicologia`, `juridico`: ven únicamente las derivaciones donde su `area_id` coincide con `area_origen_id` o `area_destino_id`.
- `recepcion`, `umeca`, `anon` o empleados inactivos: rechazados con `42501`.

## Entrada
```ts
{
  p_ficha_id?: string | null;         // Filtra por expediente específico (opcional)
  p_estado?: EstadoDerivacion | null; // 'pendiente' | 'en_proceso' | 'concluida' | 'cancelada'
  p_limite?: number;                  // 1..200 (default 200)
}
```

## Salida
Arreglo de filas ordenadas por `creado_en DESC`:
- `id`, `ficha_id`, `folio`, `usuaria_nombre`
- `area_origen_id`, `area_origen_nombre`, `area_destino_id`, `area_destino_nombre`
- `institucion_id`, `institucion_nombre`, `institucion_otra`
- `destino`, `motivo`, `fecha_derivacion`, `estado`, `creado_en`

## Errores
- `42501`: usuario no autenticado, inactivo o sin rol autorizado.
- `23514`: `p_limite` fuera del rango `1..200`.
