# RPC: `public.guardar_historial_clinico`

- **Versión:** [`20261128002600_67`](../../migrations/20261128002600_67_historial_clinico_psicologia.sql) (alta original en [`_37`](../../migrations/20261127000600_37_rpc_historial_clinico_y_estudio.sql))
- **Migración:** `supabase/migrations/20261128002600_67_historial_clinico_psicologia.sql`
- **Cubre:** `RF-10`, `RN-01`, `RN-09`, `RN-15.1` (Sprint 02 · A-05)

## Actores autorizados
- Permiso `tiene_permiso('historial_clinico.escribir')`: **solo `psicologia`** (desde `_67`; antes también escribían `titular` y `subdireccion`).
- `titular`, `subdireccion`, `trabajo_social`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_ficha_id: string;
  p_actualizado_en?: string | null; // Obligatorio si ya existe historial clínico para el expediente
  p_antecedentes_familiares?: string | null;
  p_antecedentes_personales?: string | null;
  p_motivo_consulta?: string | null;
  p_observaciones_iniciales?: string | null;
  p_tiene_atencion_psicologica_previa?: boolean | null;
}
```
- Crea la fila si no existe; si ya existe, actualiza verificando bloqueo optimista (`p_actualizado_en`).
- `null` conserva el valor actual; `''` limpia el campo de texto opcional.

## Salida
Fila única creada o actualizada con `id`, `ficha_id`, `antecedentes_familiares`, `antecedentes_personales`, `motivo_consulta`, `observaciones_iniciales`, `tiene_atencion_psicologica_previa`, `actualizado_en`.

## Errores
- `42501`: sin permiso `historial_clinico.escribir` ("Solo Psicología puede registrar o editar el historial clínico").
- `23514`: expediente inexistente/inactivo/archivado (`"Reabre el expediente para editarlo"`), persona menor de 18 años (`RN-01`) o texto > 5000 caracteres.
- `23505`: `p_actualizado_en` obsoleto (`"Este registro fue modificado por otra persona. Recarga los datos."`).

## Histórico de versiones
Cada guardado que cambie algún dato clínico crea una fila en `public.historial_clinico_version` (trigger `historial_clinico_version`): snapshot completo, `campos_modificados`, autor y fecha. Un guardado sin cambios no crea versión. Se consulta con [`get_historial_clinico_versiones`](./get_historial_clinico_versiones.md).
