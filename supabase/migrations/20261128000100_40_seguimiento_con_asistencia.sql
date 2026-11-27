-- =====================================================================
-- 40_seguimiento_con_asistencia.sql (Tarjeta #88)
-- Exige p_cita_id obligatorio y perteneciente al día de hoy
-- (America/Mazatlan) para crear el folio de seguimiento en
-- public.registrar_seguimiento(), marcando la cita como 'asistio'.
-- =====================================================================

create or replace function public.registrar_seguimiento(
  p_ficha_id            uuid,
  p_cita_id             uuid default null,
  p_tipo_atencion_id    smallint default null,
  p_acciones_realizadas text default null,
  p_proxima_accion      text default null,
  p_prioridad           public.prioridad_nivel default null,
  p_observaciones       text default null,
  p_proxima_cita_en     timestamptz default null
)
returns table (
  atencion_id             uuid,
  cita_proxima_id         uuid,
  es_primera_vez_area     boolean,
  tiene_historial_clinico boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id              uuid := auth.uid();
  v_area_id               smallint;
  v_ficha                 record;
  v_cita                  record;
  v_celular               text;
  v_domicilio_id          uuid;
  v_es_primera_vez        boolean;
  v_tiene_historial       boolean;
  v_atencion_id           uuid;
  v_cita_proxima_id       uuid;
  v_hoy_mazatlan          date := (now() at time zone 'America/Mazatlan')::date;
begin
  if not public.tiene_permiso('seguimiento.registrar') then
    raise exception 'Sin permiso para registrar seguimiento' using errcode = '42501';
  end if;

  v_area_id := public.auth_area_id();
  if v_area_id is null then
    raise exception 'El actor no tiene área asignada' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  select f.id, f.persona_id, f.estado, f.estado_civil, f.ocupacion_id, f.ocupacion_otra
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if p_tipo_atencion_id is null or not exists (
    select 1
    from public.cat_tipo_atencion ta
    where ta.id = p_tipo_atencion_id
      and ta.area_id = v_area_id
  ) then
    raise exception 'El tipo de atención no corresponde al área del actor' using errcode = '23514';
  end if;

  -- Regla #88: la cita del día es obligatoria para registrar el seguimiento
  if p_cita_id is null then
    raise exception 'La cita del día (p_cita_id) es obligatoria para registrar el seguimiento'
      using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, c.estado, c.programada_en
  into v_cita
  from public.cita c
  where c.id = p_cita_id
    and c.activo;

  if not found then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.atencion a
    where a.cita_id = p_cita_id
  ) then
    raise exception 'Esta cita ya cuenta con una hoja de seguimiento registrada' using errcode = '23505';
  end if;

  if v_cita.persona_id <> v_ficha.persona_id then
    raise exception 'La cita no pertenece a la persona de este expediente' using errcode = '23514';
  end if;

  if v_cita.area_id <> v_area_id then
    raise exception 'La cita no pertenece al área del actor' using errcode = '23514';
  end if;

  if v_cita.estado not in ('agendada', 'confirmada') then
    raise exception 'Solo se puede registrar seguimiento sobre citas agendadas o confirmadas' using errcode = '23514';
  end if;

  if (v_cita.programada_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
    raise exception 'Solo se puede registrar seguimiento sobre una cita programada para el día de hoy'
      using errcode = '23514';
  end if;

  if p_proxima_cita_en is not null and p_proxima_cita_en <= now() then
    raise exception 'La fecha de la próxima cita debe ser futura' using errcode = '23514';
  end if;

  -- Evaluar antes de insertar la nueva atención (RN-19)
  v_es_primera_vez := not exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.area_id = v_area_id
      and a.activo
  );

  update public.cita c
  set estado = 'asistio'
  where c.id = p_cita_id;

  select p.celular
  into v_celular
  from public.persona p
  where p.id = v_ficha.persona_id;

  select d.id
  into v_domicilio_id
  from public.domicilio d
  where d.persona_id = v_ficha.persona_id
    and d.activo
    and d.es_actual
  limit 1;

  insert into public.atencion (
    ficha_id,
    cita_id,
    area_id,
    tipo_atencion_id,
    atendida_por,
    estado_civil,
    ocupacion_id,
    ocupacion_otra,
    celular,
    domicilio_id,
    acciones_realizadas,
    proxima_accion,
    prioridad,
    observaciones,
    creado_por
  ) values (
    v_ficha.id,
    p_cita_id,
    v_area_id,
    p_tipo_atencion_id,
    v_actor_id,
    v_ficha.estado_civil,
    v_ficha.ocupacion_id,
    v_ficha.ocupacion_otra,
    v_celular,
    v_domicilio_id,
    nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    p_prioridad,
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_actor_id
  )
  returning id into v_atencion_id;

  if v_ficha.estado = 'abierto' then
    update public.ficha_registro f
    set estado = 'en_seguimiento'
    where f.id = v_ficha.id;
  end if;

  if p_proxima_cita_en is not null then
    insert into public.cita (
      persona_id,
      area_id,
      programada_en,
      estado,
      origen,
      creado_por
    ) values (
      v_ficha.persona_id,
      v_area_id,
      p_proxima_cita_en,
      'agendada',
      'regular',
      v_actor_id
    )
    returning id into v_cita_proxima_id;
  end if;

  v_tiene_historial := exists (
    select 1
    from public.historial_clinico hc
    where hc.ficha_id = v_ficha.id
      and hc.activo
  );

  return query select v_atencion_id, v_cita_proxima_id, v_es_primera_vez, v_tiene_historial;
end;
$$;

revoke execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) from public, anon;
grant  execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) to authenticated;
