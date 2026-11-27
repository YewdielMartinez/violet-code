# RPC: `public.atender_alerta`

- **Migración:** `supabase/migrations/20261126001400_24_rpc_cola_alertas.sql`
- **Cubre:** `RF-20`, `RN-16` (SF-12)

## Actores autorizados
- `titular`, `subdireccion`, `juridico` (línea 24/7).

## Entrada
```ts
{
  p_alerta_id: string;
  p_observaciones?: string | null; // <= 2000 chars
}
```

## Salida
```ts
[{ alerta_id: string; estado: 'atendida'; tomada_en: string; atendida_en: string; atendida_por: string }]
```

## Errores
- `42501`: sin permiso o rol fuera de línea 24/7.
- `23514`: alerta inexistente, observaciones > 2000 caracteres o estado distinto de `'tomada'`.
