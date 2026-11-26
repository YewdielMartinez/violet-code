# RPC: `public.cambiar_estado_derivacion`

- **Migración:** `supabase/migrations/20261126001500_25_rpc_derivaciones.sql`
- **Cubre:** `RF-08` (SF-04)

## Actores autorizados
- `titular`, `subdireccion`, `trabajo_social`: pueden gestionar cualquier derivación activa.
- `psicologia`, `juridico`: pueden gestionar únicamente derivaciones donde su `area_id` sea `area_origen_id` o `area_destino_id`.

## Entrada
```ts
{
  p_derivacion_id: string;     // UUID de la derivación activa
  p_estado: EstadoDerivacion;  // Estado destino
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
- `42501`: sin permiso o intento de modificar una derivación de otra área.
- `23514`: parámetros nulos, derivación inexistente/inactiva o transición no permitida.
