# RPC: `public.get_cola_alertas`

- **Migración:** `supabase/migrations/20261126001400_24_rpc_cola_alertas.sql`
- **Cubre:** `RF-20`, `RN-16`, `RN-17` (SF-12)

## Actores autorizados
- `titular`, `subdireccion`, `juridico`, `trabajo_social`, `psicologia`.
- `recepcion`, `umeca`, `anon` o empleados inactivos: rechazados con `42501`.

## Entrada
```ts
{
  p_estados?: EstadoAlerta[] | null; // default ['nueva', 'tomada']
  p_limite?: number;                 // 1..200 (default 50)
}
```

## Salida
Ordenada por `prioridad` (`alta` -> `media` -> `baja`) y luego `creado_en ASC`:
- `alerta_id`, `origen`, `prioridad`, `estado`, `creado_en`, `tomada_en`, `atendida_por_nombre`
- `persona_id`, `ficha_id`, `folio`, `nombre_completo`, `celular`
- `tiene_orden_vigente`, `asentamiento_nombre`
- *(Registra evento `'ver'` en `bitacora_acceso`)*.

## Errores
- `42501`: sin autenticación, inactivo o rol no autorizado.
- `23514`: `p_limite` fuera de `1..200`.
