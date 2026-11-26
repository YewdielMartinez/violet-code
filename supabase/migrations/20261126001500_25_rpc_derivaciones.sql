-- =====================================================================
-- 25_rpc_derivaciones.sql
-- Qué contiene:
--   1. Extiende public.validar_derivacion_area() para:
--      - Validar RN-01 al derivar a Psicología o Jurídico (>= 18 años,
--        errcode 23514).
--      - Rellenar area_origen_id con public.auth_area_id() en INSERT
--        cuando viene nulo.
--   2. RPC public.get_derivaciones(p_ficha_id, p_estado, p_limite):
--      listado con folio, nombre completo, áreas e institución, con
--      validación explícita de rol y aislamiento por área.
--   3. RPC public.cambiar_estado_derivacion(p_derivacion_id, p_estado):
--      transiciones válidas (pendiente -> en_proceso | cancelada,
--      en_proceso -> concluida | cancelada) con control de rol y área.
-- Tarjeta Kanban: #60 (RF-08, RN-01, RN-03, RN-11)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trigger validar_derivacion_area(): RN-01 + area_origen_id por defecto
-- ---------------------------------------------------------------------
create or replace function public.validar_derivacion_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave     text;
  v_fecha_nac date;
  v_fecha_hoy date;
begin
  if tg_op = 'INSERT' and new.area_origen_id is null then
    new.area_origen_id := public.auth_area_id();
  end if;

  if new.destino in ('trabajo_social', 'psicologia', 'juridico') then
    select a.clave into v_clave
    from public.cat_area a
    where a.id = new.area_destino_id;

    if v_clave is distinct from new.destino::text then
      raise exception 'area_destino_id (%) no corresponde al destino %', new.area_destino_id, new.destino
        using errcode = '23514';
    end if;

    if new.destino in ('psicologia', 'juridico') then
      select p.fecha_nacimiento into v_fecha_nac
      from public.ficha_registro f
      join public.persona p on p.id = f.persona_id
      where f.id = new.ficha_id;

      v_fecha_hoy := (now() at time zone 'America/Mazatlan')::date;

      if v_fecha_nac is not null
         and v_fecha_nac > (v_fecha_hoy - interval '18 years')::date then
        raise exception 'Psicología y Jurídico solo atienden a personas mayores de 18 años (RN-01)'
          using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. RPC: public.get_derivaciones(p_ficha_id, p_estado, p_limite)
-- ---------------------------------------------------------------------
create or replace function public.get_derivaciones(
  p_ficha_id uuid default null,
  p_estado   public.estado_derivacion default null,
  p_limite   int default 200
)
returns table (
  id                  uuid,
  ficha_id            uuid,
  folio               text,
  usuaria_nombre      text,
  area_origen_id      smallint,
  area_origen_nombre  text,
  area_destino_id     smallint,
  area_destino_nombre text,
  institucion_id      smallint,
  institucion_nombre  text,
  institucion_otra    text,
  destino             public.destino_derivacion,
  motivo              text,
  fecha_derivacion    date,
  estado              public.estado_derivacion,
  creado_en           timestamptz
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
    raise exception 'Sin permiso para consultar derivaciones' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para consultar derivaciones' using errcode = '42501';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'El límite de derivaciones debe estar entre 1 y 200' using errcode = '23514';
  end if;

  return query
  select
    d.id,
    d.ficha_id,
    f.folio,
    concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as usuaria_nombre,
    d.area_origen_id,
    ao.nombre as area_origen_nombre,
    d.area_destino_id,
    ad.nombre as area_destino_nombre,
    d.institucion_id,
    inst.nombre as institucion_nombre,
    d.institucion_otra,
    d.destino,
    d.motivo,
    d.fecha_derivacion,
    d.estado,
    d.creado_en
  from public.derivacion d
  join public.ficha_registro f on f.id = d.ficha_id
  join public.persona p on p.id = f.persona_id
  left join public.cat_area ao on ao.id = d.area_origen_id
  left join public.cat_area ad on ad.id = d.area_destino_id
  left join public.directorio_institucion inst on inst.id = d.institucion_id
  where d.activo
    and (p_ficha_id is null or d.ficha_id = p_ficha_id)
    and (p_estado is null or d.estado = p_estado)
    and (
      v_rol in ('titular', 'subdireccion', 'trabajo_social')
      or d.area_origen_id = v_area_id
      or d.area_destino_id = v_area_id
    )
  order by d.creado_en desc
  limit p_limite;
end;
$$;

revoke execute on function public.get_derivaciones(uuid, public.estado_derivacion, int) from public, anon;
grant  execute on function public.get_derivaciones(uuid, public.estado_derivacion, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC: public.cambiar_estado_derivacion(p_derivacion_id, p_estado)
-- ---------------------------------------------------------------------
create or replace function public.cambiar_estado_derivacion(
  p_derivacion_id uuid,
  p_estado        public.estado_derivacion
)
returns table (
  derivacion_id  uuid,
  estado         public.estado_derivacion,
  actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_rol            public.rol_empleado;
  v_area_id        smallint;
  v_deriv          record;
  v_actualizado_en timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para gestionar derivaciones' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para gestionar derivaciones' using errcode = '42501';
  end if;

  if p_derivacion_id is null or p_estado is null then
    raise exception 'Derivación y estado destino son obligatorios' using errcode = '23514';
  end if;

  select d.id, d.estado, d.area_origen_id, d.area_destino_id
  into v_deriv
  from public.derivacion d
  where d.id = p_derivacion_id
    and d.activo
  for update;

  if v_deriv.id is null then
    raise exception 'Derivación no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_rol in ('psicologia', 'juridico')
     and v_deriv.area_origen_id is distinct from v_area_id
     and v_deriv.area_destino_id is distinct from v_area_id then
    raise exception 'Sin permiso para modificar derivaciones de otra área' using errcode = '42501';
  end if;

  if not (
    (v_deriv.estado = 'pendiente'  and p_estado in ('en_proceso', 'cancelada'))
    or (v_deriv.estado = 'en_proceso' and p_estado in ('concluida', 'cancelada'))
  ) then
    raise exception 'Transición de estado no permitida: % -> %', v_deriv.estado, p_estado
      using errcode = '23514';
  end if;

  update public.derivacion d
  set estado = p_estado
  where d.id = p_derivacion_id
  returning d.actualizado_en into v_actualizado_en;

  return query select p_derivacion_id, p_estado, v_actualizado_en;
end;
$$;

revoke execute on function public.cambiar_estado_derivacion(uuid, public.estado_derivacion) from public, anon;
grant  execute on function public.cambiar_estado_derivacion(uuid, public.estado_derivacion) to authenticated;
