# RPC: `public.guardar_agresor`

- **Migración:** `supabase/migrations/20261128001600_58_consumo_como_lista.sql` *(actualiza `_36_`, `_57_`)*
- **Cubre:** `RF-05`, `RN-15.1` (Sprint 02 · A-04)

## Actores autorizados
- Permiso `tiene_permiso('agresor.acceder')` (`titular`, `subdireccion`, `trabajo_social`, `psicologia`, `juridico`).
- `recepcion`, `umeca`, usuaria de la app, empleados inactivos y sesiones sin autenticar reciben `42501`.

## Entrada
```ts
{
  p_agresor_id?: string | null;     // null = crear; UUID = editar con bloqueo optimista
  p_ficha_id?: string | null;       // Obligatorio al crear
  p_actualizado_en?: string | null; // Obligatorio al editar (bloqueo optimista)
  p_nombres?: string | null;        // Opcional al crear y editar ('' limpia a null; si hay valor, 1..100)
  p_apellido_paterno?: string | null;
  p_apellido_materno?: string | null;
  p_edad?: number | null;
  p_fecha_nacimiento?: string | null;
  p_entidad_nacimiento?: string | null;
  p_sexo?: SexoBiologico | null;
  p_estado_civil?: EstadoCivil | null;
  p_curp?: string | null;
  p_parentesco_id?: number | null;
  p_parentesco_otro?: string | null; // Solo cuando el parentesco es 'otro'
  p_asentamiento_id?: number | null; // Mutuamente excluyente con p_codigo_postal
  p_codigo_postal?: string | null;
  p_calle?: string | null;
  p_numero_exterior?: string | null;
  p_numero_interior?: string | null;
  p_referencias?: string | null;
  p_zona?: ZonaGeografica | null;
  p_ocupacion_id?: number | null;
  p_ocupacion_otra?: string | null;
  p_tipo_trabajo?: TipoTrabajo | null;
  p_drogas?: TipoDroga[] | null;       // 'no_consume' es exclusivo en la lista
  p_especificacion_droga?: string | null;
  p_consumo_alcohol?: ConsumoAlcohol | null; // 'no_consume' | 'ocasional' | 'frecuente'
  p_especificacion_arma?: string | null;
  p_observaciones?: string | null;
}
```
- Al editar: `null` conserva el valor actual y `''` borra los campos de texto opcionales.

## Salida
Fila única creada o actualizada de `public.agresor` con su nuevo `actualizado_en`.

## Errores
- `42501`: sin permiso `agresor.acceder`.
- `23514`: expediente inexistente/inactivo/archivado (`"Reabre el expediente para editarlo"`), `parentesco_otro` sin parentesco `'otro'`, `'no_consume'` con otras drogas o `especificacion_droga` sin consumo, `asentamiento_id` + `codigo_postal` juntos o catálogos/formatos inválidos.
- `23505`: `p_actualizado_en` obsoleto (`"Este registro fue modificado por otra persona. Recarga los datos."`).
