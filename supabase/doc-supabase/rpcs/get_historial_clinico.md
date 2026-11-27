# RPC: `public.get_historial_clinico`

- **Migración:** `supabase/migrations/20261127000600_37_rpc_historial_clinico_y_estudio.sql`
- **Cubre:** `RF-10`, `RF-22`, `RN-09` (Sprint 02 · A-05)

## Actores autorizados
- Permiso `tiene_permiso('historial_clinico.acceder')` (`titular`, `subdireccion`, `psicologia`).
- `trabajo_social`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_ficha_id: string; // UUID del expediente activo
}
```

## Salida
0 o 1 fila activa de `public.historial_clinico` con `id`, `ficha_id`, `antecedentes_familiares`, `antecedentes_personales`, `motivo_consulta`, `observaciones_iniciales`, `tiene_atencion_psicologica_previa`, `creado_en`, `actualizado_en`.
Registra automáticamente `'ver'` en `public.bitacora_acceso` (`tabla_afectada = 'historial_clinico'`).

## Errores
- `42501`: sin permiso `historial_clinico.acceder`.
- `23514`: `p_ficha_id` nulo o expediente no encontrado/inactivo.
