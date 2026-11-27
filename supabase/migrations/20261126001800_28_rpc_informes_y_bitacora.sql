-- =====================================================================
-- 28_rpc_informes_y_bitacora.sql (B-07 · Sprint 01 · RF-13, RF-22, RNF-02)
-- RPCs para consulta agregada de informes por área (sin CURP/nombres)
-- y consulta paginada de bitácora de auditoría para Dirección.
-- =====================================================================

-- ---------------------------------------------------------------------
-- public.get_informe(p_anio, p_mes, p_area_id)
-- Lee de vista_informe_mensual (si p_mes viene definido) o
-- vista_informe_anual (si p_mes es null). Dirección ve todas las áreas;
-- cada área operativa solo ve la suya.
-- ---------------------------------------------------------------------
create or replace function public.get_informe(
  p_anio    integer,
  p_mes     integer  default null,
  p_area_id smallint default null
)
returns table (
  anio                      integer,
  mes                       integer,
  area_id                   smallint,
  area                      text,
  tipo_atencion             text,
  primera_vez_o_seguimiento text,
  mujeres                   bigint,
  hombres                   bigint,
  total_personas            bigint,
  total_atenciones          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_es_direccion boolean;
  v_mi_area_id   smallint;
begin
  -- 1. Validar permiso RBAC centralizado
  if not public.tiene_permiso('informe.ver') then
    raise exception 'Sin permiso para consultar informes'
      using errcode = '42501';
  end if;

  -- 2. Validar parámetros
  if p_anio is null or p_anio < 2000 or p_anio > 2100 then
    raise exception 'p_anio es obligatorio y debe estar entre 2000 y 2100'
      using errcode = '23514';
  end if;

  if p_mes is not null and (p_mes < 1 or p_mes > 12) then
    raise exception 'p_mes debe estar entre 1 y 12'
      using errcode = '23514';
  end if;

  -- 3. Regla ABAC por área
  v_es_direccion := public.es_direccion();
  v_mi_area_id   := public.auth_area_id();

  if p_mes is not null then
    return query
    select vim.anio                      as anio,
           vim.mes                       as mes,
           ca.id                         as area_id,
           vim.area                      as area,
           vim.tipo_atencion             as tipo_atencion,
           vim.primera_vez_o_seguimiento as primera_vez_o_seguimiento,
           vim.mujeres                   as mujeres,
           vim.hombres                   as hombres,
           vim.total_personas            as total_personas,
           vim.total_atenciones          as total_atenciones
    from public.vista_informe_mensual vim
    join public.cat_area ca on ca.nombre = vim.area
    where vim.anio = p_anio
      and vim.mes = p_mes
      and (v_es_direccion or ca.id = v_mi_area_id)
      and (p_area_id is null or ca.id = p_area_id)
    order by ca.id, vim.tipo_atencion, vim.primera_vez_o_seguimiento;
  else
    return query
    select via.anio                      as anio,
           null::integer                 as mes,
           ca.id                         as area_id,
           via.area                      as area,
           via.tipo_atencion             as tipo_atencion,
           via.primera_vez_o_seguimiento as primera_vez_o_seguimiento,
           via.mujeres                   as mujeres,
           via.hombres                   as hombres,
           via.total_personas            as total_personas,
           via.total_atenciones          as total_atenciones
    from public.vista_informe_anual via
    join public.cat_area ca on ca.nombre = via.area
    where via.anio = p_anio
      and (v_es_direccion or ca.id = v_mi_area_id)
      and (p_area_id is null or ca.id = p_area_id)
    order by ca.id, via.tipo_atencion, via.primera_vez_o_seguimiento;
  end if;
end;
$$;

revoke execute on function public.get_informe(integer, integer, smallint) from public, anon;
grant  execute on function public.get_informe(integer, integer, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- public.get_bitacora(p_desde, p_hasta, p_tabla, p_empleado_id, p_limite)
-- Consulta de auditoría con nombre y rol/dependencia del actor.
-- Exclusiva para Dirección ('bitacora.ver').
-- ---------------------------------------------------------------------
create or replace function public.get_bitacora(
  p_desde       timestamptz default null,
  p_hasta       timestamptz default null,
  p_tabla       text        default null,
  p_empleado_id uuid        default null,
  p_limite      integer     default 100
)
returns table (
  id                 uuid,
  accion             public.accion_bitacora,
  tabla_afectada     text,
  registro_id        text,
  empleado_id        uuid,
  usuario_externo_id uuid,
  actor_tipo         text,
  actor_nombre       text,
  actor_rol          text,
  creado_en          timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tabla text := nullif(btrim(p_tabla), '');
begin
  -- 1. Validar permiso RBAC centralizado
  if not public.tiene_permiso('bitacora.ver') then
    raise exception 'Sin permiso para consultar la bitácora de accesos'
      using errcode = '42501';
  end if;

  -- 2. Validar parámetros de filtro y paginación
  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'p_limite debe estar entre 1 y 200'
      using errcode = '23514';
  end if;

  if p_desde is not null and p_hasta is not null and p_desde > p_hasta then
    raise exception 'El rango de fechas es inválido: p_desde no puede ser mayor que p_hasta'
      using errcode = '23514';
  end if;

  -- 3. Consulta con alias explícitos
  return query
  select b.id                                                 as id,
         b.accion                                             as accion,
         b.tabla_afectada                                     as tabla_afectada,
         b.registro_id                                        as registro_id,
         b.empleado_id                                        as empleado_id,
         b.usuario_externo_id                                 as usuario_externo_id,
         case
           when b.empleado_id is not null        then 'empleado'
           when b.usuario_externo_id is not null then 'usuario_externo'
           else 'sistema'
         end                                                  as actor_tipo,
         coalesce(e.nombre, u.nombre, 'Sistema / App')        as actor_nombre,
         coalesce(e.rol::text, u.dependencia)                 as actor_rol,
         b.creado_en                                          as creado_en
  from public.bitacora_acceso b
  left join public.empleado e        on e.id = b.empleado_id
  left join public.usuario_externo u on u.id = b.usuario_externo_id
  where (p_desde is null or b.creado_en >= p_desde)
    and (p_hasta is null or b.creado_en <= p_hasta)
    and (v_tabla is null or b.tabla_afectada = v_tabla)
    and (p_empleado_id is null or b.empleado_id = p_empleado_id)
  order by b.creado_en desc, b.id desc
  limit p_limite;
end;
$$;

revoke execute on function public.get_bitacora(timestamptz, timestamptz, text, uuid, integer) from public, anon;
grant  execute on function public.get_bitacora(timestamptz, timestamptz, text, uuid, integer) to authenticated;
