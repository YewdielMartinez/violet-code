-- =====================================================================
-- 42_rpc_contexto_seguimiento.sql (Tarjeta #90)
-- Crea RPC get_contexto_seguimiento(p_cita_id) con datos mínimos para
-- el formulario de seguimiento: solo citas del área del actor y del día
-- de hoy (America/Mazatlan), con bitácora 'ver'. Nunca expone CURP,
-- estudio socioeconómico, agresor ni notas de otras áreas.
-- =====================================================================

create or replace function public.get_contexto_seguimiento(
  p_cita_id uuid
)
returns table (
  ficha_id                 uuid,
  folio_expediente         text,
  nombre_persona           text,
  edad                     integer,
  es_primera_vez_area      boolean,
  ultimo_folio_seguimiento text,
  ultima_proxima_accion    text,
  tiene_orden_vigente      boolean,
  tiene_historial_clinico  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_area_id        smallint;
  v_area_clave     text;
  v_hoy_mazatlan   date := (now() at time zone 'America/Mazatlan')::date;
  v_cita           record;
  v_ficha          record;
  v_persona        record;
  v_ultima_at      record;
  v_es_primera     boolean;
  v_orden_vigente  boolean;
  v_hist_clinico   boolean := null;
  v_edad           integer := null;
begin
  if not public.tiene_permiso('seguimiento.registrar') then
    raise exception 'Sin permiso para consultar contexto de seguimiento' using errcode = '42501';
  end if;

  v_area_id := public.auth_area_id();
  if v_area_id is null then
    raise exception 'El actor no tiene área asignada' using errcode = '42501';
  end if;

  select ca.clave
  into v_area_clave
  from public.cat_area ca
  where ca.id = v_area_id;

  if p_cita_id is null then
    raise exception 'El identificador de la cita es obligatorio' using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, c.programada_en, c.activo
  into v_cita
  from public.cita c
  where c.id = p_cita_id
    and c.activo;

  if not found then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_cita.area_id <> v_area_id then
    raise exception 'La cita no pertenece al área del actor' using errcode = '23514';
  end if;

  if (v_cita.programada_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
    raise exception 'Solo se puede consultar contexto de citas programadas para el día de hoy'
      using errcode = '23514';
  end if;

  select f.id, f.folio
  into v_ficha
  from public.ficha_registro f
  where f.persona_id = v_cita.persona_id
    and f.activo
  order by f.creado_en desc, f.id desc
  limit 1;

  if not found then
    raise exception 'La persona no cuenta con expediente activo' using errcode = '23514';
  end if;

  select p.id, p.nombres, p.apellido_paterno, p.apellido_materno, p.fecha_nacimiento
  into v_persona
  from public.persona p
  where p.id = v_cita.persona_id
    and p.activo;

  if not found then
    raise exception 'Persona no encontrada o inactiva' using errcode = '23514';
  end if;

  -- Bitácora obligatoria de acceso ('ver')
  insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
  values (v_actor_id, 'ver', 'ficha_registro', v_ficha.id::text);

  if v_persona.fecha_nacimiento is not null then
    v_edad := extract(year from age(v_hoy_mazatlan, v_persona.fecha_nacimiento))::int;
  end if;

  v_es_primera := not exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.area_id = v_area_id
      and a.activo
  );

  select a.folio_seguimiento, a.proxima_accion
  into v_ultima_at
  from public.atencion a
  where a.ficha_id = v_ficha.id
    and a.area_id = v_area_id
    and a.activo
  order by a.creado_en desc, a.id desc
  limit 1;

  v_orden_vigente := public.tiene_orden_vigente(v_persona.id);

  if v_area_clave = 'psicologia' then
    v_hist_clinico := exists (
      select 1
      from public.historial_clinico hc
      where hc.ficha_id = v_ficha.id
        and hc.activo
    );
  end if;

  return query
  select
    v_ficha.id,
    v_ficha.folio,
    btrim(concat_ws(' ', v_persona.nombres, v_persona.apellido_paterno, v_persona.apellido_materno)),
    v_edad,
    v_es_primera,
    v_ultima_at.folio_seguimiento,
    v_ultima_at.proxima_accion,
    v_orden_vigente,
    v_hist_clinico;
end;
$$;

revoke execute on function public.get_contexto_seguimiento(uuid) from public, anon;
grant  execute on function public.get_contexto_seguimiento(uuid) to authenticated;
