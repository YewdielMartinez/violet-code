-- =====================================================================
-- 22_rpc_agenda.sql
-- Qué contiene:
--   1. RPC public.get_agenda(p_desde, p_hasta, p_area_id, p_estados, p_limite):
--      agenda operativa por rango (máx. 31 días) con nombre completo y
--      celular para confirmación, repitiendo las reglas de cita_select.
--   2. RPC public.cambiar_estado_cita(p_cita_id, p_estado, p_motivo):
--      transiciones controladas a confirmada, cancelada o no_asistio,
--      llenando confirmada_en o motivo_cancelacion y respetando cita_update.
-- Tarjeta Kanban: #57 (SF-05, SF-06, RF-06, RN-04, RN-06)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RPC: public.get_agenda(...)
-- ---------------------------------------------------------------------
create or replace function public.get_agenda(
  p_desde   timestamptz,
  p_hasta   timestamptz,
  p_area_id smallint default null,
  p_estados public.estado_cita[] default null,
  p_limite  int default 200
)
returns table (
  cita_id         uuid,
  programada_en   timestamptz,
  estado          public.estado_cita,
  prioridad       public.prioridad_nivel,
  area_id         smallint,
  area_clave      text,
  recomendada_por text,
  reagendada_de   uuid,
  origen          public.origen_cita,
  persona_id      uuid,
  nombre_completo text,
  celular         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rol      public.rol_empleado;
  v_area_id  smallint;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para consultar la agenda' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para consultar la agenda' using errcode = '42501';
  end if;

  if p_desde is null or p_hasta is null or p_hasta <= p_desde then
    raise exception 'El rango de fechas de la agenda es inválido' using errcode = '23514';
  end if;

  if (p_hasta - p_desde) > interval '31 days' then
    raise exception 'El rango de consulta de agenda no puede superar 31 días' using errcode = '23514';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'El límite de citas debe estar entre 1 y 200' using errcode = '23514';
  end if;

  return query
  select
    c.id as cita_id,
    c.programada_en,
    c.estado,
    c.prioridad,
    c.area_id,
    a.clave as area_clave,
    c.recomendada_por,
    c.reagendada_de,
    c.origen,
    c.persona_id,
    concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
    p.celular
  from public.cita c
  join public.cat_area a on a.id = c.area_id
  join public.persona p on p.id = c.persona_id
  where c.activo
    and c.programada_en >= p_desde
    and c.programada_en < p_hasta
    and (p_area_id is null or c.area_id = p_area_id)
    and (p_estados is null or c.estado = any(p_estados))
    and (
      v_rol in ('titular', 'subdireccion')
      or (v_rol in ('recepcion', 'trabajo_social') and a.clave in ('trabajo_social', 'psicologia'))
      or (v_rol in ('psicologia', 'juridico') and c.area_id = v_area_id)
    )
  order by c.programada_en asc
  limit p_limite;
end;
$$;

revoke execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) from public, anon;
grant  execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC: public.cambiar_estado_cita(p_cita_id, p_estado, p_motivo)
-- ---------------------------------------------------------------------
create or replace function public.cambiar_estado_cita(
  p_cita_id uuid,
  p_estado  public.estado_cita,
  p_motivo  text default null
)
returns table (
  cita_id       uuid,
  estado        public.estado_cita,
  confirmada_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id      uuid := auth.uid();
  v_rol           public.rol_empleado;
  v_area_id       smallint;
  v_cita          record;
  v_confirmada_en timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para gestionar citas' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para gestionar citas' using errcode = '42501';
  end if;

  if p_cita_id is null or p_estado is null
     or p_estado not in ('confirmada', 'cancelada', 'no_asistio') then
    raise exception 'Cita y estado destino válido (confirmada, cancelada, no_asistio) son obligatorios'
      using errcode = '23514';
  end if;

  if p_motivo is not null and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo de cancelación no puede exceder 500 caracteres' using errcode = '23514';
  end if;

  select c.id, c.estado, c.area_id, a.clave as area_clave, c.confirmada_en
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
    raise exception 'Recepción solo puede gestionar citas de Trabajo Social o Psicología'
      using errcode = '42501';
  elsif v_rol in ('trabajo_social', 'psicologia', 'juridico')
        and v_cita.area_id is distinct from v_area_id then
    raise exception 'Sin permiso para modificar citas de otra área' using errcode = '42501';
  end if;

  if not (
    (v_cita.estado = 'agendada' and p_estado in ('confirmada', 'cancelada', 'no_asistio'))
    or (v_cita.estado = 'confirmada' and p_estado in ('cancelada', 'no_asistio'))
  ) then
    raise exception 'Transición de estado de cita no permitida: % -> %', v_cita.estado, p_estado
      using errcode = '23514';
  end if;

  update public.cita c
  set estado = p_estado,
      confirmada_en = case
        when p_estado = 'confirmada' then now()
        else c.confirmada_en
      end,
      motivo_cancelacion = case
        when p_estado = 'cancelada' then nullif(btrim(coalesce(p_motivo, '')), '')
        else c.motivo_cancelacion
      end
  where c.id = p_cita_id
  returning c.confirmada_en into v_confirmada_en;

  return query select p_cita_id, p_estado, v_confirmada_en;
end;
$$;

revoke execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) from public, anon;
grant  execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) to authenticated;
