# RPC: `public.actualizar_persona`

- **Versión:** [`20261127000400_35`](../../migrations/20261127000400_35_rpc_editar_persona_y_ficha.sql)
- **Migración:** `supabase/migrations/20261127000400_35_rpc_editar_persona_y_ficha.sql`
- **Cubre:** `RF-01`, `RN-08`, `RN-15.1` (Sprint 02 · A-03)

## Actores autorizados
- Permiso `tiene_permiso('expediente.escribir')` (`titular`, `subdireccion`, `trabajo_social`).
- `psicologia`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_persona_id: string;
  p_actualizado_en: string; // Bloqueo optimista contra persona.actualizado_en
  p_nombres?: string | null;
  p_apellido_paterno?: string | null;
  p_apellido_materno?: string | null;
  p_celular?: string | null;
  p_escolaridad?: EscolaridadNivel | null;
  p_discapacidad?: string | null;
  p_grupo_etnico?: string | null;
  p_religion?: string | null;
}
```
- `null` = conservar valor actual; `''` = limpiar campos opcionales (`apellido_materno`, `celular`, `discapacidad`, `grupo_etnico`, `religion`).
- Nunca modifica `curp`, `sexo`, `fecha_nacimiento`, `entidad_nacimiento` ni `activo`.

## Salida
Fila única actualizada con `id`, `curp`, `nombres`, `apellido_paterno`, `apellido_materno`, `sexo`, `fecha_nacimiento`, `entidad_nacimiento`, `celular`, `escolaridad`, `discapacidad`, `grupo_etnico`, `religion`, `actualizado_en`.

## Errores
- `42501`: sin permiso `expediente.escribir`.
- `23514`: persona inexistente/inactiva, expediente archivado (`"Reabre el expediente para editarlo"`) o validación de formato/longitud (celular distinto de 10 dígitos, nombres/apellido paterno vacíos o > 100).
- `23505`: `p_actualizado_en` obsoleto (`"Este registro fue modificado por otra persona. Recarga los datos."`).
