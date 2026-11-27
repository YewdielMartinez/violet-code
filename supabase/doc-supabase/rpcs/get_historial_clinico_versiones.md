# RPC: `public.get_historial_clinico_versiones`

- **Versión:** [`20261128002600_67`](../../migrations/20261128002600_67_historial_clinico_psicologia.sql)
- **Migración:** `supabase/migrations/20261128002600_67_historial_clinico_psicologia.sql`

## Actores autorizados
- Permiso `tiene_permiso('historial_clinico.acceder')` (`titular`, `subdireccion`, `psicologia`), el mismo que [`get_historial_clinico`](./get_historial_clinico.md).
- `trabajo_social`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_ficha_id: string; // UUID del expediente activo
}
```

## Salida
Una fila por versión de `public.historial_clinico_version`, de la más reciente a la más antigua (`version` desc):
`id`, `historial_clinico_id`, `ficha_id`, `version` (1 = alta), snapshot completo (`antecedentes_familiares`, `antecedentes_personales`, `motivo_consulta`, `observaciones_iniciales`, `tiene_atencion_psicologica_previa`), `campos_modificados` (`text[]` con los nombres de columna que cambiaron respecto de la versión anterior; en la versión 1, los campos capturados), `creado_por`, `creado_por_nombre` y `creado_en`.

Para mostrar «qué cambió», compara cada versión con la inmediata anterior en `campos_modificados`.
Registra `'ver'` en `public.bitacora_acceso` (`tabla_afectada = 'historial_clinico_version'`).

## Cómo se generan las versiones
- Trigger `historial_clinico_version` (AFTER INSERT OR UPDATE sobre `historial_clinico`): crea una versión por cada guardado que cambie algún dato clínico, incluso si la escritura no pasó por el RPC. Un guardado sin cambios no crea versión.
- Tabla append-only: el cliente solo tiene `SELECT` (RLS con `historial_clinico.acceder`); sin INSERT/UPDATE/DELETE directos.
- Backfill de `_67`: cada historial existente recibió su versión 1 (snapshot del estado actual; `creado_en` = `actualizado_en` del historial, autor = `creado_por`).

## Errores
- `42501`: sin permiso `historial_clinico.acceder`.
- `23514`: `p_ficha_id` nulo o expediente no encontrado/inactivo.
