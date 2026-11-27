# RPC: `public.registrar_estudio_socioeconomico`

- **Migración:** `supabase/migrations/20261128001500_57_ficha_campos_opcionales.sql` *(actualiza `_37_`)*
- **Cubre:** `RF-01`, `RN-15.1` (Sprint 02 · A-05)

## Actores autorizados
- Permiso `tiene_permiso('expediente.escribir')` (`titular`, `subdireccion`, `trabajo_social`).
- `psicologia`, `juridico`, `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_ficha_id: string;
  p_ingreso_mensual_propio?: number | null;
  p_numero_dependientes?: number | null;
  p_tiene_apoyo?: boolean;
  p_especificacion_apoyo?: string | null;
  p_tipo_vivienda?: TipoVivienda | null;
  p_material?: MaterialVivienda | null;
  p_material_otro?: string | null;
  p_servicios?: ServicioVivienda[] | null;
  p_bienes?: BienVivienda[] | null;
  p_aportantes?: AportanteInput[]; // JSONB array (snake_case o camelCase; nombre es opcional, máx. 150)
}
```

## Salida
Fila única con `estudio_id`, `ficha_id`, `fecha_estudio`, `es_actual` (`true`), `fue_correccion` (`boolean`), `actualizado_en`.
- Si ya existe estudio actual de hoy (`America/Mazatlan`) creado por la misma persona en sesión, lo actualiza en sitio (`fue_correccion = true`), desactiva sus aportantes previos e inserta los nuevos.
- En cualquier otro caso desmarca el anterior (`es_actual = false`) y crea una nueva versión (`fue_correccion = false`).

## Errores
- `42501`: sin permiso `expediente.escribir`.
- `23514`: expediente inexistente/inactivo/archivado (`"Reabre el expediente para editarlo"`), inconsistencia de `especificacion_apoyo`/`material_otro`, montos o dependientes fuera de rango o aportante inválido.
