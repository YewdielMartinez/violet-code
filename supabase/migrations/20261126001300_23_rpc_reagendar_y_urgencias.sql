-- =====================================================================
-- 23_rpc_reagendar_y_urgencias.sql
-- Qué contiene:
--   1. RPC public.reagendar_cita(p_cita_id, p_nueva_fecha, p_motivo, p_prioridad):
--      transacción atómica que marca la cita original como 'reagendada',
--      crea la nueva ligada mediante reagendada_de (copiando área,
--      persona, origen, recomendada_por y prioridad si viene nula) y
--      rechaza duplicados con 23505.
--   2. RPC public.get_lista_urgencias(p_area_id):
--      lista de expedientes abiertos/en_seguimiento cuya última atención
--      con prioridad es 'alta' y sin cita futura activa, accesible para
--      Recepción sin exponer CURP ni notas.
-- Tarjeta Kanban: #58 (SF-07, RF-06, RF-07, RN-06)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RPC: public.reagendar_cita(...)
-- ---------------------------------------------------------------------
create or replace function public.reagendar_cita(
  p_cita_id     uuid,
  p_nueva_fecha timestamptz,
  p_motivo      text default null,
  p_prioridad   public.prioridad_nivel default null
)
returns table (
  cita_anterior_id uuid,
  cita_nueva_id    uuid,
  programada_en    timestamptz,
  estado           public.estado_cita
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rol      public.rol_empleado;
  v_area_id  smallint;
  v_cita     record;
  v_nueva_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para reagendar citas' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para reagendar citas' using errcode = '42501';
  end if;

  if p_cita_id is null or p_nueva_fecha is null then
    raise exception 'La cita y la nueva fecha son obligatorias' using errcode = '23514';
  end if;

  if p_nueva_fecha <= now() then
    raise exception 'La nueva fecha de la cita debe estar en el futuro' using errcode = '23514';
  end if;

  if p_motivo is not null and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo no puede exceder 500 caracteres' using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, a.clave as area_clave,
         c.estado, c.prioridad, c.recomendada_por, c.origen
  into v_cita
  from public.cita c
  join public.cat_area a on a.id = c.area_id
  where c.id = p_cita_id
    and c.activo
  for update;

  if v_cita.id is null then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_rol = 'recepcion' and v_cita.area_clave not in ('trabajo_social', 'psicologia') then
    raise exception 'Recepción solo puede reagendar citas de Trabajo Social o Psicología'
      using errcode = '42501';
  elsif v_rol in ('trabajo_social', 'psicologia', 'juridico')
        and v_cita.area_id is distinct from v_area_id then
    raise exception 'Sin permiso para reagendar citas de otra área' using errcode = '42501';
  end if;

  if v_cita.estado = 'reagendada'
     or exists (select 1 from public.cita c2 where c2.reagendada_de = p_cita_id) then
    raise exception 'Esta cita ya fue reagendada anteriormente' using errcode = '23505';
  end if;

  if v_cita.estado not in ('agendada', 'confirmada') then
    raise exception 'Solo se pueden reagendar citas agendadas o confirmadas (estado actual: %)', v_cita.estado
      using errcode = '23514';
  end if;

  update public.cita c
  set estado = 'reagendada',
      motivo_cancelacion = coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), c.motivo_cancelacion)
  where c.id = p_cita_id;

  insert into public.cita (
    persona_id,
    area_id,
    programada_en,
    estado,
    prioridad,
    recomendada_por,
    origen,
    reagendada_de,
    creado_por
  ) values (
    v_cita.persona_id,
    v_cita.area_id,
    p_nueva_fecha,
    'agendada',
    coalesce(p_prioridad, v_cita.prioridad),
    v_cita.recomendada_por,
    v_cita.origen,
    p_cita_id,
    v_actor_id
  )
  returning id into v_nueva_id;

  return query select p_cita_id, v_nueva_id, p_nueva_fecha, 'agendada'::public.estado_cita;
end;
$$;

revoke execute on function public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel) from public, anon;
grant  execute on function public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC: public.get_lista_urgencias(p_area_id)
-- ---------------------------------------------------------------------
create or replace function public.get_lista_urgencias(
  p_area_id smallint default null
)
returns table (
  persona_id            uuid,
  ficha_id              uuid,
  folio                 text,
  nombre_completo       text,
  celular               text,
  area_ultima_prioridad text,
  fecha_ultima_prioridad date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rol      public.rol_empleado;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para consultar la lista de urgencias' using errcode = '42501';
  end if;

  select e.rol
  into v_rol
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia') then
    raise exception 'Sin permiso para consultar la lista de urgencias' using errcode = '42501';
  end if;

  return query
  with ultima_prioridad as (
    select distinct on (at.ficha_id)
      at.ficha_id,
      at.prioridad,
      at.area_id,
      ca.clave as area_clave,
      (at.atendida_en at time zone 'America/Mazatlan')::date as fecha_atencion
    from public.atencion at
    join public.cat_area ca on ca.id = at.area_id
    where at.activo
      and at.prioridad is not null
    order by at.ficha_id, at.atendida_en desc, at.creado_en desc
  )
  select
    p.id as persona_id,
    f.id as ficha_id,
    f.folio,
    concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
    p.celular,
    u.area_clave as area_ultima_prioridad,
    u.fecha_atencion as fecha_ultima_prioridad
  from public.ficha_registro f
  join public.persona p on p.id = f.persona_id
  join ultima_prioridad u on u.ficha_id = f.id
  where f.activo
    and p.activo
    and f.estado in ('abierto', 'en_seguimiento')
    and u.prioridad = 'alta'
    and (p_area_id is null or u.area_id = p_area_id)
    and not exists (
      select 1
      from public.cita c
      where c.persona_id = f.persona_id
        and c.activo
        and c.estado in ('agendada', 'confirmada')
        and c.programada_en > now()
    )
  order by u.fecha_atencion asc, f.creado_en asc;
end;
$$;

revoke execute on function public.get_lista_urgencias(smallint) from public, anon;
grant  execute on function public.get_lista_urgencias(smallint) to authenticated;
