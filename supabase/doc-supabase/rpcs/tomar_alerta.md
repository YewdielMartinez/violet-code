# RPC: `public.tomar_alerta`

- **Versión:** [`20261128000800_47`](../../migrations/20261128000800_47_tiene_permiso_agenda_alertas.sql)
- **Migración:** `supabase/migrations/20261126001400_24_rpc_cola_alertas.sql`
- **Cubre:** `RF-20`, `RN-16` (SF-12)

## Actores autorizados
- `titular`, `subdireccion`, `juridico` (línea 24/7).

## Entrada
```ts
{ p_alerta_id: string }
```

## Salida
```ts
[{ alerta_id: string; estado: 'tomada'; tomada_en: string; atendida_en: null; atendida_por: string }]
```

## Errores
- `42501`: sin permiso o rol fuera de línea 24/7.
- `23505`: la alerta ya fue tomada por otra persona.
- `23514`: alerta inexistente o en estado distinto de `'nueva'`.
