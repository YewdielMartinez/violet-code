# RPC: `public.cambiar_estado_derivacion`

- **Versión:** [`20261127000300_34`](../../migrations/20261127000300_34_historial_canalizaciones.sql)
- **Migración:** `supabase/migrations/20261126001500_25_rpc_derivaciones.sql`, actualizada en `supabase/migrations/20261127000300_34_historial_canalizaciones.sql`
- **Cubre:** `RF-08`, `RF-25` (SF-04 / Sprint 02 · A-02)

## Actores autorizados
- Permiso `tiene_permiso('derivacion.gestionar')`:
  - `titular`, `subdireccion`, `trabajo_social`: pueden gestionar cualquier derivación activa.
  - `psicologia`, `juridico`: pueden gestionar únicamente derivaciones donde su `area_id` sea `area_origen_id` o `area_destino_id`.
- Cada transición registra un evento en `public.canalizacion_evento`.

## Entrada
```ts
{
  p_derivacion_id: string;     // UUID de la derivación activa
  p_estado: EstadoDerivacion;  // Estado destino
  p_nota?: string | null;      // Máx. 1000 caracteres; obligatoria para 'concluida' y 'cancelada'
}
```

## Transiciones válidas
- `pendiente` → `en_proceso` | `cancelada`
- `en_proceso` → `concluida` | `cancelada`

## Salida
```ts
[{ derivacion_id: string; estado: EstadoDerivacion; actualizado_en: string }]
```

## Errores
- `42501`: sin permiso (`derivacion.gestionar`) o intento de modificar una derivación de otra área.
- `23514`: parámetros nulos, falta `p_nota` al concluir o cancelar, longitud excedida, derivación inexistente/inactiva o transición no permitida.
