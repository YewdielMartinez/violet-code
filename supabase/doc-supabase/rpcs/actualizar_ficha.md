# RPC: `public.actualizar_ficha`

- **Migración:** `supabase/migrations/20261128001500_57_ficha_campos_opcionales.sql` *(actualiza `_35_`)*
- **Cubre:** `RF-01`, `RN-08`, `RN-15.1` (Sprint 02 · A-03)

## Actores autorizados
- Permiso `tiene_permiso('expediente.escribir')` (`titular`, `subdireccion`, `trabajo_social`).
- `psicologia`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_ficha_id: string;
  p_actualizado_en: string; // Bloqueo optimista contra ficha_registro.actualizado_en
  p_estado_civil?: EstadoCivil | null;
  p_ocupacion_id?: number | null;
  p_ocupacion_otra?: string | null;
  p_tiene_trabajo?: boolean | null;
  p_numero_hijas?: number | null;
  p_numero_hijos_hombres?: number | null;
  p_servicio_medico?: ServicioMedico | null;
  p_servicio_medico_otro?: string | null;
  p_tiene_embarazo?: boolean | null;
  p_tiene_denuncia?: boolean | null;
  p_es_victima_delito?: boolean | null;
  p_tiene_consumo_droga?: boolean | null;
  p_drogas?: TipoDroga[] | null;
  p_especificacion_droga?: string | null;
  p_tiene_consumo_alcohol?: boolean | null;
  p_servicios_solicitados_area_ids?: number[] | null; // null conserva; [] vacía los servicios solicitados
}
```
- `null` = conservar valor actual; `''` = limpiar textos opcionales (`ocupacion_otra`, `servicio_medico_otro`, `especificacion_droga`); `[]` en `p_servicios_solicitados_area_ids` = elimina todos los servicios solicitados del expediente.
- Nunca modifica `folio`, `persona_id`, `estado`, `aviso_privacidad_aceptado_en`, `registrada_en` ni `activo`.
- Los cambios en `ficha_servicio_solicitado` quedan auditados por el trigger `ficha_servicio_solicitado_bitacora` (`crear` / `desactivar`).

## Salida
Fila única actualizada con los campos del expediente más `servicios_solicitados_area_ids` y el nuevo `actualizado_en`.

## Errores
- `42501`: sin permiso `expediente.escribir`.
- `23514`: ficha inexistente/inactiva, expediente archivado (`"Reabre el expediente para editarlo"`), inconsistencia de `servicio_medico_otro`/`drogas`, rangos fuera de `0..30` u ocupación/área inexistente.
- `23505`: `p_actualizado_en` obsoleto (`"Este registro fue modificado por otra persona. Recarga los datos."`).
