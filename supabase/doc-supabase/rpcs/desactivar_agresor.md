# RPC: `public.desactivar_agresor`

- **Migración:** `supabase/migrations/20261127000500_36_rpc_guardar_agresor.sql`
- **Cubre:** `RF-05`, `RN-15.1` (Sprint 02 · A-04)

## Actores autorizados
- Permiso `tiene_permiso('agresor.acceder')` (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`).
- `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_agresor_id: string;
  p_motivo?: string | null; // Máx. 1000 caracteres (opcional)
}
```

## Salida
```ts
[{ agresor_id: string; activo: false; actualizado_en: string }]
```

## Errores
- `42501`: sin permiso `agresor.acceder`.
- `23514`: agresor inexistente/inactivo, expediente archivado o presencia de orden de protección vigente ligada (`estado = 'vigente'` no vencida).
