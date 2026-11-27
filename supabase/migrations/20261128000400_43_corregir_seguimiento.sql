-- =====================================================================
-- 43_corregir_seguimiento.sql (Tarjeta #91)
-- 1. Cierra INSERT/UPDATE directos sobre public.atencion (with check false).
-- 2. Actualiza registrar_seguimiento() para dejar de copiar datos generales
--    (estado_civil, ocupacion_id, ocupacion_otra, celular, domicilio_id).
-- 3. Crea RPC corregir_seguimiento(p_atencion_id, p_actualizado_en, ...):
--    - Permiso seguimiento.corregir (o Dirección / área de atención).
--    - Creador el mismo día (America/Mazatlan) o Dirección en cualquier momento.
--    - Concurrencia optimista con p_actualizado_en (SQLSTATE 40001).
--    - Solo bitácora (trigger registrar_cambio, sin guardar valor anterior).
-- =====================================================================

-- 1) Bloquear INSERT y UPDATE directos sobre public.atencion
drop policy if exists atencion_insert on public.atencion;
create policy atencion_insert on public.atencion
  for insert to authenticated
  with check (false and (select public.tiene_permiso('seguimiento.registrar')));

drop policy if exists atencion_update on public.atencion;
create policy atencion_update on public.atencion
  for update to authenticated
  using (
    (select public.tiene_permiso('expediente.ver'))
    and (
      (select public.es_direccion())
      or area_id = (select public.auth_area_id())
    )
  )
  with check (false);

-- 2) Actualizar registrar_seguimiento() sin copiar datos generales de la ficha
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
  folio_seguimiento       text,
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
  v_es_primera_vez        boolean;
  v_tiene_historial       boolean;
  v_atencion_id           uuid;
  v_folio_seguimiento     text;
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

  select f.id, f.persona_id, f.estado
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

  if p_cita_id is null then
    raise exception 'La cita del día (p_cita_id) es obligatoria para registrar el seguimiento'
      using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, c.estado, c.programada_en
  into v_cita
  from public.cita c
  where c.id = p_cita_id
    and c.activo
  for update;

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

  insert into public.atencion (
    ficha_id,
    cita_id,
    area_id,
    tipo_atencion_id,
    atendida_por,
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
    nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    p_prioridad,
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_actor_id
  )
  returning id, atencion.folio_seguimiento into v_atencion_id, v_folio_seguimiento;

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

  return query select v_atencion_id, v_folio_seguimiento, v_cita_proxima_id, v_es_primera_vez, v_tiene_historial;
end;
$$;

-- 3) Crear RPC corregir_seguimiento()
create or replace function public.corregir_seguimiento(
  p_atencion_id         uuid,
  p_actualizado_en      timestamptz,
  p_tipo_atencion_id    smallint default null,
  p_acciones_realizadas text default null,
  p_proxima_accion      text default null,
  p_prioridad           public.prioridad_nivel default null,
  p_observaciones       text default null
)
returns table (
  atencion_id       uuid,
  folio_seguimiento text,
  actualizado_en    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_es_dir         boolean := public.es_direccion();
  v_hoy_mazatlan   date := (now() at time zone 'America/Mazatlan')::date;
  v_atencion       record;
  v_nuevo_act_en   timestamptz;
begin
  if not (public.tiene_permiso('seguimiento.corregir') or v_es_dir or public.es_area_atencion()) then
    raise exception 'Sin permiso para corregir seguimiento' using errcode = '42501';
  end if;

  if p_atencion_id is null then
    raise exception 'El identificador de la atención es obligatorio' using errcode = '23514';
  end if;

  if p_actualizado_en is null then
    raise exception 'La marca de tiempo p_actualizado_en es obligatoria' using errcode = '23514';
  end if;

  select a.id, a.area_id, a.tipo_atencion_id, a.atendida_por, a.atendida_en, a.creado_por, a.actualizado_en, a.folio_seguimiento
  into v_atencion
  from public.atencion a
  where a.id = p_atencion_id
    and a.activo
  for update;

  if not found then
    raise exception 'Atención no encontrada o inactiva' using errcode = '23514';
  end if;

  if not v_es_dir then
    if coalesce(v_atencion.atendida_por, v_atencion.creado_por) <> v_actor_id then
      raise exception 'Solo quien creó el seguimiento puede corregirlo' using errcode = '42501';
    end if;

    if (v_atencion.atendida_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
      raise exception 'Solo se puede corregir el seguimiento el mismo día de su registro' using errcode = '42501';
    end if;
  end if;

  if date_trunc('milliseconds', v_atencion.actualizado_en) <> date_trunc('milliseconds', p_actualizado_en) then
    raise exception 'El seguimiento fue modificado por otra persona. Recarga antes de guardar.'
      using errcode = '40001';
  end if;

  if p_tipo_atencion_id is not null and not exists (
    select 1
    from public.cat_tipo_atencion ta
    where ta.id = p_tipo_atencion_id
      and ta.area_id = v_atencion.area_id
  ) then
    raise exception 'El tipo de atención no corresponde al área del seguimiento' using errcode = '23514';
  end if;

  update public.atencion a
  set
    tipo_atencion_id    = coalesce(p_tipo_atencion_id, a.tipo_atencion_id),
    acciones_realizadas = nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    proxima_accion      = nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    prioridad           = p_prioridad,
    observaciones       = nullif(btrim(coalesce(p_observaciones, '')), '')
  where a.id = v_atencion.id
  returning a.actualizado_en into v_nuevo_act_en;

  return query select v_atencion.id, v_atencion.folio_seguimiento, v_nuevo_act_en;
end;
$$;

revoke execute on function public.corregir_seguimiento(uuid, timestamptz, smallint, text, text, public.prioridad_nivel, text) from public, anon;
grant  execute on function public.corregir_seguimiento(uuid, timestamptz, smallint, text, text, public.prioridad_nivel, text) to authenticated;
