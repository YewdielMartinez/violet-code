-- =====================================================================
-- 42_agenda_busqueda_umeca.sql
-- Qué contiene:
--   1. Nueva regla de creación de citas (reemplaza la de la migración 40):
--        recepcion      -> trabajo_social, psicologia, juridico
--        juridico       -> juridico
--        psicologia     -> psicologia
--        titular/subdir -> todas las áreas
--        trabajo_social -> ninguna
--      Se redefinen public.tiene_permiso() (clave `agenda.crear`; conserva
--      todas las claves vigentes) y public.puede_crear_cita_en_area().
--      La política cita_insert y las RPC reagendar_cita y
--      registrar_seguimiento (próxima cita) ya delegan en ambos, por lo que
--      heredan la regla sin cambios.
--   2. RPC public.buscar_personas_agenda(p_q, p_limite): autocompletado de
--      personas (con expediente activo y no archivado) para crear citas.
--   3. public.get_umeca_citas(): agrega area_clave y area_nombre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. tiene_permiso(): agenda.crear = dirección, recepcion, juridico,
--     psicologia (el alcance por área lo define puede_crear_cita_en_area).
-- ---------------------------------------------------------------------
create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(case p_permiso
    -- Administración y catálogos
    when 'catalogos.gestionar'        then public.es_direccion()
    when 'directorio.gestionar'       then public.es_direccion()
    when 'cuentas.gestionar'          then public.es_direccion()
    when 'bitacora.ver'               then public.es_direccion()

    -- Expedientes y atención
    when 'expediente.escribir'        then public.es_direccion() or public.auth_rol() = 'trabajo_social'
    when 'expediente.ver'             then public.es_direccion() or public.es_area_atencion()
    when 'expediente.verificar_curp'  then public.es_empleado_activo()
    when 'expediente.reabrir'         then public.es_direccion()
    when 'seguimiento.registrar'      then public.es_area_atencion()
    when 'seguimiento.corregir'       then public.es_direccion() or public.es_area_atencion()
    when 'agresor.acceder'            then public.es_direccion() or public.es_area_atencion()
    when 'historial_clinico.acceder'  then public.es_direccion() or public.auth_rol() = 'psicologia'
    when 'orden_proteccion.escribir'  then public.es_direccion() or public.auth_rol() in ('juridico', 'trabajo_social')

    -- Agenda, urgencias y derivaciones (canalizaciones)
    when 'agenda.ver'                 then public.es_empleado_activo()
    when 'agenda.gestionar'           then public.es_empleado_activo()
    when 'agenda.crear'               then public.es_direccion() or public.auth_rol() in ('recepcion', 'juridico', 'psicologia')
    when 'urgencias.ver'              then public.es_direccion() or public.auth_rol() in ('trabajo_social', 'psicologia', 'recepcion')
    when 'derivacion.gestionar'       then public.es_direccion() or public.es_area_atencion()
    when 'canalizacion.crear'         then public.auth_rol() = 'trabajo_social'

    -- Alertas 24/7
    when 'alerta.atender'             then public.es_linea_24_7()
    when 'alerta.ver_cola'            then public.es_linea_24_7() or public.auth_rol() in ('trabajo_social', 'psicologia')

    -- Actividades preventivas e informes
    when 'actividad.ver'              then public.es_empleado_activo()
    when 'actividad.registrar'        then public.es_direccion() or public.es_area_atencion()
    when 'informe.ver'                then public.es_direccion() or public.es_area_atencion()

    else false
  end, false);
$$;

revoke all on function public.tiene_permiso(text) from public, anon;
grant execute on function public.tiene_permiso(text) to authenticated;

-- ---------------------------------------------------------------------
-- 1b. Helper: ¿el actor puede crear una cita en el área indicada?
-- ---------------------------------------------------------------------
create or replace function public.puede_crear_cita_en_area(p_area_id smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.tiene_permiso('agenda.crear')
    and p_area_id is not null
    and (
      (
        public.es_direccion()
        and exists (select 1 from public.cat_area a where a.id = p_area_id)
      )
      or (
        public.auth_rol() = 'recepcion'
        and p_area_id in (
          public.area_id_por_clave('trabajo_social'),
          public.area_id_por_clave('psicologia'),
          public.area_id_por_clave('juridico')
        )
      )
      or (
        public.auth_rol() = 'juridico'
        and p_area_id = public.area_id_por_clave('juridico')
        and p_area_id = public.auth_area_id()
      )
      or (
        public.auth_rol() = 'psicologia'
        and p_area_id = public.area_id_por_clave('psicologia')
        and p_area_id = public.auth_area_id()
      )
    ),
    false
  );
$$;

revoke all on function public.puede_crear_cita_en_area(smallint) from public, anon;
grant execute on function public.puede_crear_cita_en_area(smallint) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC: public.buscar_personas_agenda(p_q, p_limite)
--    Autocompletado para el formulario de nueva cita.
--    - Requiere tiene_permiso('agenda.crear') (42501 en caso contrario).
--    - p_q (recortado) con menos de 3 caracteres devuelve conjunto vacío.
--    - Coincide por nombre completo (sin acentos y sin distinguir
--      mayúsculas: todos los términos separados por espacio deben estar
--      contenidos) o por prefijo de CURP (en mayúsculas).
--    - Solo personas activas con su expediente más reciente activo y no
--      archivado.
--    - curp_enmascarada = 4 primeros caracteres + '******' + 2 últimos
--      (null si la persona no tiene CURP). No devuelve la CURP completa.
--    - p_limite se acota a 1..25 (default 10).
--    - No escribe en bitacora_acceso (igual que buscar_expedientes;
--      autocompletado con datos enmascarados).
-- ---------------------------------------------------------------------
create or replace function public.buscar_personas_agenda(
  p_q      text,
  p_limite int default 10
)
returns table (
  persona_id       uuid,
  ficha_id         uuid,
  folio            text,
  nombre_completo  text,
  curp_enmascarada text,
  celular          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q      text := btrim(coalesce(p_q, ''));
  v_limite int  := least(greatest(coalesce(p_limite, 10), 1), 25);
  v_norm   text;
  v_upper  text;
  v_prefix text;
  v_tokens text[];
begin
  if not public.tiene_permiso('agenda.crear') then
    raise exception 'Sin permiso para buscar personas en la agenda' using errcode = '42501';
  end if;

  if char_length(v_q) < 3 then
    return;
  end if;

  v_norm   := extensions.unaccent(lower(v_q));
  v_upper  := upper(regexp_replace(v_q, '\s+', '', 'g'));
  -- Comodines de LIKE escapados (\, %, _) en prefijo y en cada término
  v_prefix := replace(replace(replace(v_norm, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_tokens := array(
    select '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    from unnest(regexp_split_to_array(v_norm, '\s+')) as t
    where t <> ''
  );

  return query
  select x.persona_id, x.ficha_id, x.folio, x.nombre_completo, x.curp_enmascarada, x.celular
  from (
    select
      p.id as persona_id,
      f.id as ficha_id,
      f.folio,
      concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
      case
        when p.curp is null then null
        else left(p.curp, 4) || '******' || right(p.curp, 2)
      end as curp_enmascarada,
      p.celular,
      case
        when p.curp like replace(replace(replace(v_upper, '\', '\\'), '%', '\%'), '_', '\_') || '%' then 0
        when extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))) like v_prefix then 1
        else 2
      end as rango
    from public.persona p
    join lateral (
      select f2.id, f2.folio
      from public.ficha_registro f2
      where f2.persona_id = p.id
        and f2.activo
        and f2.estado <> 'archivado'
      order by f2.registrada_en desc
      limit 1
    ) f on true
    where p.activo
      and (
        p.curp like replace(replace(replace(v_upper, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)))
           like all (v_tokens)
      )
  ) x
  order by x.rango, lower(x.nombre_completo), x.folio
  limit v_limite;
end;
$$;

revoke execute on function public.buscar_personas_agenda(text, int) from public, anon;
grant  execute on function public.buscar_personas_agenda(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. get_umeca_citas(): agrega area_clave / area_nombre (mismo acceso y
--    misma bitácora; solo citas con origen = 'umeca').
-- ---------------------------------------------------------------------
drop function if exists public.get_umeca_citas();

create or replace function public.get_umeca_citas()
returns table (
  cita_id          uuid,
  nombres          text,
  apellido_paterno text,
  apellido_materno text,
  programada_en    timestamptz,
  estado           text,
  area_clave       text,
  area_nombre      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_externo_id uuid;
begin
  select u.id into v_usuario_externo_id
  from usuario_externo u
  where u.id = auth.uid()
    and u.activo
    and u.dependencia = 'umeca';

  if v_usuario_externo_id is null then
    raise exception 'Sin permiso para consultar citas UMECA' using errcode = '42501';
  end if;

  insert into bitacora_acceso (usuario_externo_id, accion, tabla_afectada, registro_id)
  values (v_usuario_externo_id, 'ver', 'cita', null);

  return query
  select c.id as cita_id,
         p.nombres,
         p.apellido_paterno,
         p.apellido_materno,
         c.programada_en,
         case c.estado
           when 'asistio'    then 'asistio'
           when 'no_asistio' then 'no_asistio'
           when 'cancelada'  then 'cancelo'
           else 'pendiente'
         end as estado,
         a.clave  as area_clave,
         a.nombre as area_nombre
  from cita c
  join persona p on p.id = c.persona_id
  join cat_area a on a.id = c.area_id
  where c.origen = 'umeca'
    and c.activo
    and c.estado <> 'reagendada';
end;
$$;

revoke execute on function public.get_umeca_citas() from public, anon;
grant  execute on function public.get_umeca_citas() to authenticated;
