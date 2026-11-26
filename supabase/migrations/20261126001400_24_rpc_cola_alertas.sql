-- =====================================================================
-- 24_rpc_cola_alertas.sql
-- Qué contiene:
--   1. Trigger en public.orden_proteccion para recalcular y subir a
--      'alta' las alertas 'nueva' de esa persona cuando entra o cambia
--      una orden vigente.
--   2. RPC public.get_cola_alertas(p_estados, p_limite): cola ordenada
--      por prioridad (alta->baja) y antigüedad, con nombre completo,
--      celular, folio, asentamiento, tiene_orden_vigente y registro en
--      bitacora_acceso ('ver').
--   3. RPC public.tomar_alerta(p_alerta_id): toma atómica desde 'nueva'
--      con bloqueo de fila (23505 si ya fue tomada).
--   4. RPC public.atender_alerta(p_alerta_id, p_observaciones): concluye
--      atención desde 'tomada' registrando atendida_en y observaciones.
-- Tarjeta Kanban: #59 (SF-11, SF-12, SF-13, RF-20, RN-16, RN-17)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trigger en orden_proteccion: recalcular prioridad de alertas nuevas
-- ---------------------------------------------------------------------
create or replace function public.recalcular_prioridad_alertas_por_orden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona_id uuid;
begin
  select f.persona_id
  into v_persona_id
  from public.ficha_registro f
  where f.id = new.ficha_id;

  if v_persona_id is not null and public.tiene_orden_vigente(v_persona_id) then
    update public.alerta a
    set prioridad = 'alta'
    where a.activo
      and a.estado = 'nueva'
      and a.prioridad <> 'alta'
      and (
        a.persona_id = v_persona_id
        or exists (
          select 1
          from public.pre_registro pr
          where pr.id = a.pre_registro_id
            and pr.persona_id = v_persona_id
        )
      );
  end if;

  return new;
end;
$$;

drop trigger if exists orden_proteccion_sube_prioridad_alerta on public.orden_proteccion;
create trigger orden_proteccion_sube_prioridad_alerta
  after insert or update of estado, fecha_vigencia, activo on public.orden_proteccion
  for each row execute function public.recalcular_prioridad_alertas_por_orden();

-- ---------------------------------------------------------------------
-- 2. RPC: public.get_cola_alertas(p_estados, p_limite)
-- ---------------------------------------------------------------------
create or replace function public.get_cola_alertas(
  p_estados public.estado_alerta[] default array['nueva', 'tomada']::public.estado_alerta[],
  p_limite  int default 50
)
returns table (
  alerta_id           uuid,
  origen              public.origen_alerta,
  prioridad           public.prioridad_nivel,
  estado              public.estado_alerta,
  creado_en           timestamptz,
  tomada_en           timestamptz,
  atendida_por_nombre text,
  persona_id          uuid,
  ficha_id            uuid,
  folio               text,
  nombre_completo     text,
  celular             text,
  tiene_orden_vigente boolean,
  asentamiento_nombre text
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
    raise exception 'Sin permiso para consultar la cola de alertas' using errcode = '42501';
  end if;

  select e.rol
  into v_rol
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'juridico', 'trabajo_social', 'psicologia') then
    raise exception 'Sin permiso para consultar la cola de alertas' using errcode = '42501';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'El límite de alertas debe estar entre 1 y 200' using errcode = '23514';
  end if;

  insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
  values (v_actor_id, 'ver', 'alerta', 'cola');

  return query
  select
    a.id as alerta_id,
    a.origen,
    a.prioridad,
    a.estado,
    a.creado_en,
    a.tomada_en,
    emp.nombre as atendida_por_nombre,
    coalesce(a.persona_id, pr.persona_id) as persona_id,
    f.id as ficha_id,
    f.folio,
    nullif(
      btrim(
        concat_ws(
          ' ',
          coalesce(p.nombres, pr.nombres),
          coalesce(p.apellido_paterno, pr.apellido_paterno),
          nullif(btrim(coalesce(p.apellido_materno, pr.apellido_materno, '')), '')
        )
      ),
      ''
    ) as nombre_completo,
    coalesce(p.celular, pr.celular) as celular,
    coalesce(public.tiene_orden_vigente(coalesce(a.persona_id, pr.persona_id)), false) as tiene_orden_vigente,
    asen.nombre as asentamiento_nombre
  from public.alerta a
  left join public.pre_registro pr on pr.id = a.pre_registro_id
  left join public.persona p on p.id = coalesce(a.persona_id, pr.persona_id)
  left join public.ficha_registro f on f.persona_id = coalesce(a.persona_id, pr.persona_id) and f.activo
  left join public.empleado emp on emp.id = a.atendida_por
  left join public.cat_asentamiento asen on asen.id = a.asentamiento_id
  where a.activo
    and (p_estados is null or a.estado = any(p_estados))
  order by a.prioridad asc, a.creado_en asc
  limit p_limite;
end;
$$;

revoke execute on function public.get_cola_alertas(public.estado_alerta[], int) from public, anon;
grant  execute on function public.get_cola_alertas(public.estado_alerta[], int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC: public.tomar_alerta(p_alerta_id)
-- ---------------------------------------------------------------------
create or replace function public.tomar_alerta(
  p_alerta_id uuid
)
returns table (
  alerta_id    uuid,
  estado       public.estado_alerta,
  tomada_en    timestamptz,
  atendida_en  timestamptz,
  atendida_por uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id    uuid := auth.uid();
  v_rol         public.rol_empleado;
  v_alerta      record;
  v_tomada_en   timestamptz;
  v_atendida_en timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para atender alertas' using errcode = '42501';
  end if;

  select e.rol
  into v_rol
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null or v_rol not in ('titular', 'subdireccion', 'juridico') then
    raise exception 'Sin permiso para tomar alertas de la línea 24/7' using errcode = '42501';
  end if;

  if p_alerta_id is null then
    raise exception 'La alerta es obligatoria' using errcode = '23514';
  end if;

  select a.id, a.estado
  into v_alerta
  from public.alerta a
  where a.id = p_alerta_id
    and a.activo
  for update;

  if v_alerta.id is null then
    raise exception 'Alerta no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_alerta.estado = 'tomada' then
    raise exception 'Esta alerta ya fue tomada por otra persona' using errcode = '23505';
  end if;

  if v_alerta.estado <> 'nueva' then
    raise exception 'Solo se pueden tomar alertas en estado nueva (estado actual: %)', v_alerta.estado
      using errcode = '23514';
  end if;

  update public.alerta a
  set estado = 'tomada',
      tomada_en = now(),
      atendida_por = v_actor_id
  where a.id = p_alerta_id
  returning a.tomada_en, a.atendida_en into v_tomada_en, v_atendida_en;

  return query select p_alerta_id, 'tomada'::public.estado_alerta, v_tomada_en, v_atendida_en, v_actor_id;
end;
$$;

revoke execute on function public.tomar_alerta(uuid) from public, anon;
grant  execute on function public.tomar_alerta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC: public.atender_alerta(p_alerta_id, p_observaciones)
-- ---------------------------------------------------------------------
create or replace function public.atender_alerta(
  p_alerta_id     uuid,
  p_observaciones text default null
)
returns table (
  alerta_id    uuid,
  estado       public.estado_alerta,
  tomada_en    timestamptz,
  atendida_en  timestamptz,
  atendida_por uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id     uuid := auth.uid();
  v_rol          public.rol_empleado;
  v_alerta       record;
  v_tomada_en    timestamptz;
  v_atendida_en  timestamptz;
  v_atendida_por uuid;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para atender alertas' using errcode = '42501';
  end if;

  select e.rol
  into v_rol
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null or v_rol not in ('titular', 'subdireccion', 'juridico') then
    raise exception 'Sin permiso para atender alertas de la línea 24/7' using errcode = '42501';
  end if;

  if p_alerta_id is null then
    raise exception 'La alerta es obligatoria' using errcode = '23514';
  end if;

  if p_observaciones is not null and char_length(btrim(p_observaciones)) > 2000 then
    raise exception 'Las observaciones no pueden exceder 2000 caracteres' using errcode = '23514';
  end if;

  select a.id, a.estado
  into v_alerta
  from public.alerta a
  where a.id = p_alerta_id
    and a.activo
  for update;

  if v_alerta.id is null then
    raise exception 'Alerta no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_alerta.estado <> 'tomada' then
    raise exception 'Solo se pueden concluir alertas en estado tomada (estado actual: %)', v_alerta.estado
      using errcode = '23514';
  end if;

  update public.alerta a
  set estado = 'atendida',
      atendida_en = now(),
      observaciones = coalesce(nullif(btrim(coalesce(p_observaciones, '')), ''), a.observaciones)
  where a.id = p_alerta_id
  returning a.tomada_en, a.atendida_en, a.atendida_por
  into v_tomada_en, v_atendida_en, v_atendida_por;

  return query select p_alerta_id, 'atendida'::public.estado_alerta, v_tomada_en, v_atendida_en, v_atendida_por;
end;
$$;

revoke execute on function public.atender_alerta(uuid, text) from public, anon;
grant  execute on function public.atender_alerta(uuid, text) to authenticated;
