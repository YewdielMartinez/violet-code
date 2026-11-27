-- =====================================================================
-- 51_rpc_crear_cita.sql (Tarjeta #120)
-- 1. Crea RPC crear_cita(p_persona_id, p_area_id, p_programada_en,
--    p_recomendada_por, p_origen) con permiso 'agenda.gestionar' y
--    reglas de alcance por área, fecha futura, persona activa,
--    expediente no archivado y sin cita duplicada en la misma área y hora.
--    La mayoría de edad la valida el trigger cita_validar_mayoria_edad.
-- 2. Cierra inserción directa en public.cita (cita_insert -> with check (false)).
-- =====================================================================

-- 1) RPC crear_cita
create or replace function public.crear_cita(
  p_persona_id      uuid,
  p_area_id         smallint,
  p_programada_en   timestamptz,
  p_recomendada_por text default null,
  p_origen          public.origen_cita default 'regular'
)
returns table (
  cita_id       uuid,
  persona_id    uuid,
  area_id       smallint,
  programada_en timestamptz,
  estado        public.estado_cita,
  origen        public.origen_cita
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id        uuid := auth.uid();
  v_rol             public.rol_empleado;
  v_actor_area_id   smallint;
  v_area_clave      text;
  v_persona_activa  boolean;
  v_ficha_estado    public.estado_ficha;
  v_origen          public.origen_cita := coalesce(p_origen, 'regular');
  v_recomendada_por text := nullif(btrim(coalesce(p_recomendada_por, '')), '');
  v_cita_id         uuid;
begin
  if not public.tiene_permiso('agenda.gestionar') then
    raise exception 'Sin permiso para agendar citas' using errcode = '42501';
  end if;

  if p_persona_id is null or p_area_id is null or p_programada_en is null then
    raise exception 'Persona, área y fecha/hora son obligatorias para crear una cita'
      using errcode = '23514';
  end if;

  if v_recomendada_por is not null and char_length(v_recomendada_por) > 200 then
    raise exception 'El campo recomendada_por no puede exceder 200 caracteres'
      using errcode = '23514';
  end if;

  select ca.clave
  into v_area_clave
  from public.cat_area ca
  where ca.id = p_area_id;

  if not found then
    raise exception 'El área especificada no existe o está inactiva' using errcode = '23514';
  end if;

  v_rol := public.auth_rol();
  v_actor_area_id := public.auth_area_id();

  -- Alcance por rol/área
  if not public.es_direccion() then
    if v_rol = 'recepcion' then
      if v_area_clave not in ('trabajo_social', 'psicologia') then
        raise exception 'Recepción solo puede agendar citas de Trabajo Social o Psicología'
          using errcode = '42501';
      end if;
    elsif p_area_id is distinct from v_actor_area_id then
      raise exception 'Sin permiso para agendar citas en otra área' using errcode = '42501';
    end if;
  end if;

  if p_programada_en <= now() then
    raise exception 'La fecha y hora de la cita deben ser futuras' using errcode = '23514';
  end if;

  select p.activo
  into v_persona_activa
  from public.persona p
  where p.id = p_persona_id;

  if not coalesce(v_persona_activa, false) then
    raise exception 'Persona no encontrada o inactiva' using errcode = '23514';
  end if;

  -- Si la persona tiene expediente activo, rechazar si está archivado
  select f.estado
  into v_ficha_estado
  from public.ficha_registro f
  where f.persona_id = p_persona_id
    and f.activo
  order by f.creado_en desc, f.id desc
  limit 1;

  if v_ficha_estado = 'archivado' then
    raise exception 'No se puede agendar una cita para un expediente archivado'
      using errcode = '23514';
  end if;

  -- Evitar cita duplicada en la misma área y hora
  if exists (
    select 1
    from public.cita c
    where c.persona_id = p_persona_id
      and c.area_id = p_area_id
      and c.programada_en = p_programada_en
      and c.activo
      and c.estado in ('agendada', 'confirmada')
  ) then
    raise exception 'Ya existe una cita activa para esta persona en esa área y horario'
      using errcode = '23514';
  end if;

  insert into public.cita (
    persona_id,
    area_id,
    programada_en,
    estado,
    recomendada_por,
    origen,
    creado_por
  ) values (
    p_persona_id,
    p_area_id,
    p_programada_en,
    'agendada',
    v_recomendada_por,
    v_origen,
    v_actor_id
  )
  returning id into v_cita_id;

  return query
  select v_cita_id, p_persona_id, p_area_id, p_programada_en, 'agendada'::public.estado_cita, v_origen;
end;
$$;

revoke execute on function public.crear_cita(uuid, smallint, timestamptz, text, public.origen_cita) from public, anon;
grant  execute on function public.crear_cita(uuid, smallint, timestamptz, text, public.origen_cita) to authenticated;

-- 2) Cerrar inserción directa en public.cita
drop policy if exists cita_insert on public.cita;

create policy cita_insert on public.cita
  for insert to authenticated
  with check (false and (select public.tiene_permiso('agenda.gestionar')));
