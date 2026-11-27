-- =====================================================================
-- 75_reportes_por_area.sql (Violet Code · RF-13 · Estadísticas y reportes)
-- Reportes agregados por área y periodo para la pantalla «Estadísticas».
--
-- get_informe() (migración 28) solo entiende año / mes de ATENCIONES. La
-- pantalla necesita además rangos de fechas, tendencia mensual y otros
-- tipos de reporte, todos como CONTEOS (nunca filas por persona). Se agrega
-- una sola RPC de lectura sin tocar la anterior (migraciones inmutables):
--
--   public.get_reporte(p_tipo, p_desde, p_hasta, p_area_id, p_agrupar)
--
--   p_tipo       atenciones | citas | canalizaciones | ordenes_proteccion
--                | actividades | alertas
--   p_desde/p_hasta   rango inclusivo en fecha local (America/Mazatlan)
--   p_area_id    solo Dirección: acota a un área. Las áreas de atención
--                SIEMPRE se fuerzan a la suya (el parámetro se ignora).
--   p_agrupar    'mes' (una fila por mes, para tendencias), 'periodo'
--                (todo el rango junto) o 'total' (solo atenciones: UNA fila
--                con las personas distintas de todo el rango, sin desglose;
--                `metrica` = atenciones de primera vez). Para los demás
--                tipos 'total' equivale a 'periodo'.
--
-- Columnas devueltas (todas agregadas; sin CURP, nombres, folios ni ids de
-- personas, fichas o expedientes):
--   tipo, mes (primer día del mes o null), area_id, area, categoria,
--   estado, total, personas, mujeres, hombres, metrica.
-- Qué significan categoria / estado / metrica en cada tipo: ver
-- supabase/doc-supabase/rpcs/get_reporte.md.
--
-- Permiso: tiene_permiso('informe.ver') (Dirección y las 3 áreas de
-- atención). Recepción, UMECA, anon e inactivos reciben 42501.
-- Alcance por área (mismo criterio que get_informe):
--   atenciones / citas  -> cat_area de la fila (atencion.area_id / cita.area_id)
--   canalizaciones      -> área origen o destino de la derivación
--   ordenes_proteccion  -> área de quien registró la orden (empleado)
--   actividades / alertas -> no tienen área: son del programa completo y
--                          se muestran igual a todos los roles con informe.ver.
-- La RPC no escribe en bitácora (solo lectura de agregados).
-- =====================================================================

create or replace function public.get_reporte(
  p_tipo    text,
  p_desde   date,
  p_hasta   date,
  p_area_id smallint default null,
  p_agrupar text     default 'mes'
)
returns table (
  tipo      text,
  mes       date,
  area_id   smallint,
  area      text,
  categoria text,
  estado    text,
  total     bigint,
  personas  bigint,
  mujeres   bigint,
  hombres   bigint,
  metrica   numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c_tz           constant text := 'America/Mazatlan';
  v_es_direccion boolean;
  v_area         smallint;
  v_mensual      boolean;
  v_total        boolean;
begin
  -- 1. Validar permiso RBAC centralizado
  if not public.tiene_permiso('informe.ver') then
    raise exception 'Sin permiso para consultar reportes'
      using errcode = '42501';
  end if;

  -- 2. Validar parámetros
  if p_tipo is null or p_tipo not in (
       'atenciones', 'citas', 'canalizaciones',
       'ordenes_proteccion', 'actividades', 'alertas'
     ) then
    raise exception 'p_tipo inválido'
      using errcode = '23514';
  end if;

  if p_desde is null or p_hasta is null then
    raise exception 'p_desde y p_hasta son obligatorios'
      using errcode = '23514';
  end if;

  if p_desde > p_hasta then
    raise exception 'El rango de fechas es inválido: p_desde no puede ser mayor que p_hasta'
      using errcode = '23514';
  end if;

  if p_hasta - p_desde > 1830 then
    raise exception 'El rango de fechas no puede superar 5 años'
      using errcode = '23514';
  end if;

  if p_agrupar is null or p_agrupar not in ('mes', 'periodo', 'total') then
    raise exception 'p_agrupar debe ser mes, periodo o total'
      using errcode = '23514';
  end if;

  v_mensual := p_agrupar = 'mes';
  v_total   := p_agrupar = 'total' and p_tipo = 'atenciones';

  -- 3. Regla ABAC por área: Dirección elige (o ve todas); el resto, la suya.
  v_es_direccion := public.es_direccion();
  if v_es_direccion then
    v_area := p_area_id;
  else
    v_area := public.auth_area_id();
    if v_area is null then
      return;  -- sin área asignada no hay nada que mostrar
    end if;
  end if;

  -- 4. Agregados por tipo
  if p_tipo = 'atenciones' then
    return query
    with marcada as (
      select a.area_id,
             a.tipo_atencion_id,
             (a.atendida_en at time zone c_tz)::date as fecha,
             f.persona_id,
             p.sexo,
             row_number() over (
               partition by f.persona_id, a.area_id
               order by a.atendida_en, a.creado_en
             ) = 1 as es_primera_vez
      from public.atencion a
      join public.ficha_registro f on f.id = a.ficha_id
      join public.persona p        on p.id = f.persona_id
      where a.activo
        and (v_area is null or a.area_id = v_area)
    )
    select p_tipo                                               as tipo,
           case when v_mensual then date_trunc('month', m.fecha)::date end as mes,
           case when v_total then null::smallint else ar.id end as area_id,
           case when v_total then null::text else ar.nombre end as area,
           case when v_total then null::text else t.nombre end  as categoria,
           case when v_total then null::text
                when m.es_primera_vez then 'primera_vez'
                else 'seguimiento' end                          as estado,
           count(*)::bigint                                     as total,
           count(distinct m.persona_id)::bigint                 as personas,
           (count(distinct m.persona_id) filter (where m.sexo = 'M'))::bigint as mujeres,
           (count(distinct m.persona_id) filter (where m.sexo = 'H'))::bigint as hombres,
           -- En 'total': atenciones de primera vez (seguimiento = total - metrica).
           case when v_total
                then (count(*) filter (where m.es_primera_vez))::numeric
           end                                                  as metrica
    from marcada m
    join public.cat_area ar         on ar.id = m.area_id
    join public.cat_tipo_atencion t on t.id  = m.tipo_atencion_id
    where m.fecha between p_desde and p_hasta
    group by 2, 3, 4, 5, 6
    order by 2 nulls first, 3, 5, 6;

  elsif p_tipo = 'citas' then
    return query
    select p_tipo                                               as tipo,
           case when v_mensual
                then date_trunc('month', (ci.programada_en at time zone c_tz)::date)::date
           end                                                  as mes,
           ar.id                                                as area_id,
           ar.nombre                                            as area,
           null::text                                           as categoria,
           ci.estado::text                                      as estado,
           count(*)::bigint                                     as total,
           null::bigint                                         as personas,
           null::bigint                                         as mujeres,
           null::bigint                                         as hombres,
           null::numeric                                        as metrica
    from public.cita ci
    join public.cat_area ar on ar.id = ci.area_id
    where ci.activo
      and (ci.programada_en at time zone c_tz)::date between p_desde and p_hasta
      and (v_area is null or ci.area_id = v_area)
    group by 2, 3, 4, 6
    order by 2 nulls first, 3, 6;

  elsif p_tipo = 'canalizaciones' then
    return query
    with conclusion as (
      select ce.derivacion_id,
             min(ce.creado_en) as concluida_en
      from public.canalizacion_evento ce
      where ce.estado_nuevo = 'concluida'
      group by ce.derivacion_id
    )
    select p_tipo                                               as tipo,
           case when v_mensual
                then date_trunc('month', d.fecha_derivacion)::date
           end                                                  as mes,
           ao.id                                                as area_id,
           ao.nombre                                            as area,
           d.destino::text                                      as categoria,
           d.estado::text                                       as estado,
           count(*)::bigint                                     as total,
           null::bigint                                         as personas,
           null::bigint                                         as mujeres,
           null::bigint                                         as hombres,
           -- Días promedio de la canalización al momento en que se concluyó.
           round(
             avg(greatest((co.concluida_en at time zone c_tz)::date - d.fecha_derivacion, 0))
               filter (where d.estado = 'concluida' and co.concluida_en is not null),
             1
           )::numeric                                           as metrica
    from public.derivacion d
    left join public.cat_area ao   on ao.id = d.area_origen_id
    left join conclusion co        on co.derivacion_id = d.id
    where d.activo
      and d.fecha_derivacion between p_desde and p_hasta
      and (v_area is null or d.area_origen_id = v_area or d.area_destino_id = v_area)
    group by 2, 3, 4, 5, 6
    order by 2 nulls first, 3 nulls last, 5, 6;

  elsif p_tipo = 'ordenes_proteccion' then
    return query
    select p_tipo                                               as tipo,
           case when v_mensual
                then date_trunc('month', o.fecha_emision)::date
           end                                                  as mes,
           ar.id                                                as area_id,
           ar.nombre                                            as area,
           null::text                                           as categoria,
           o.estado::text                                       as estado,
           count(*)::bigint                                     as total,
           null::bigint                                         as personas,
           null::bigint                                         as mujeres,
           null::bigint                                         as hombres,
           null::numeric                                        as metrica
    from public.orden_proteccion o
    left join public.empleado e on e.id = o.creado_por
    left join public.cat_area ar on ar.id = e.area_id
    where o.activo
      and o.fecha_emision between p_desde and p_hasta
      and (v_area is null or e.area_id = v_area)
    group by 2, 3, 4, 6
    order by 2 nulls first, 3 nulls last, 6;

  elsif p_tipo = 'actividades' then
    -- actividad_preventiva no tiene área: se ignora el filtro de área.
    return query
    select p_tipo                                               as tipo,
           case when v_mensual
                then date_trunc('month', (ap.programada_en at time zone c_tz)::date)::date
           end                                                  as mes,
           null::smallint                                       as area_id,
           null::text                                           as area,
           ap.tipo_institucion::text                            as categoria,
           ap.estado::text                                      as estado,
           count(*)::bigint                                     as total,
           null::bigint                                         as personas,
           null::bigint                                         as mujeres,
           null::bigint                                         as hombres,
           -- Asistentes registrados (solo actividades realizadas).
           coalesce(sum(ap.numero_asistentes) filter (where ap.estado = 'realizada'), 0)::numeric as metrica
    from public.actividad_preventiva ap
    where ap.activo
      and (ap.programada_en at time zone c_tz)::date between p_desde and p_hasta
    group by 2, 5, 6
    order by 2 nulls first, 5, 6;

  else
    -- alertas: no tienen área; se ignora el filtro de área.
    return query
    select p_tipo                                               as tipo,
           case when v_mensual
                then date_trunc('month', (al.creado_en at time zone c_tz)::date)::date
           end                                                  as mes,
           null::smallint                                       as area_id,
           null::text                                           as area,
           al.origen::text                                      as categoria,
           al.estado::text                                      as estado,
           count(*)::bigint                                     as total,
           null::bigint                                         as personas,
           null::bigint                                         as mujeres,
           null::bigint                                         as hombres,
           -- Minutos promedio desde que entró la alerta hasta que se atendió.
           round(
             (avg(extract(epoch from (al.atendida_en - al.creado_en)) / 60.0)
               filter (where al.estado = 'atendida' and al.atendida_en is not null))::numeric,
             1
           )                                                    as metrica
    from public.alerta al
    where al.activo
      and (al.creado_en at time zone c_tz)::date between p_desde and p_hasta
    group by 2, 5, 6
    order by 2 nulls first, 5, 6;
  end if;
end;
$$;

revoke execute on function public.get_reporte(text, date, date, smallint, text) from public, anon;
grant  execute on function public.get_reporte(text, date, date, smallint, text) to authenticated;
