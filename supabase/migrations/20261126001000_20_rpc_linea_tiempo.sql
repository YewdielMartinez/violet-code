-- =====================================================================
-- 20_rpc_linea_tiempo.sql (A-05 · Sprint 01 · RF-25, RN-18 · SF-14)
-- RPC para construir la línea de tiempo cronológica de un expediente
-- filtrando detalles sensibles según rol/área, sin incluir nunca notas
-- privadas (nota_area) ni historial clínico.
-- =====================================================================

create or replace function public.get_linea_tiempo(p_ficha_id uuid)
returns table (
  fecha         timestamptz,
  tipo          text,
  area          text,
  titulo        text,
  detalle       text,
  referencia_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_persona_id    uuid;
  v_es_direccion  boolean;
  v_mi_area_id    smallint;
  v_rol           public.rol_empleado;
  v_es_linea_24_7 boolean;
begin
  -- 1. Validar permiso RBAC centralizado
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para consultar la línea de tiempo del expediente'
      using errcode = '42501';
  end if;

  -- 2. Validar expediente activo
  if p_ficha_id is null then
    raise exception 'El identificador del expediente (p_ficha_id) es obligatorio'
      using errcode = '23514';
  end if;

  select f.persona_id
    into v_persona_id
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo;

  if v_persona_id is null then
    raise exception 'El expediente especificado no existe o está inactivo'
      using errcode = '23514';
  end if;

  -- 3. Contexto ABAC del actor
  v_es_direccion  := public.es_direccion();
  v_mi_area_id    := public.auth_area_id();
  v_rol           := public.auth_rol();
  v_es_linea_24_7 := public.es_linea_24_7();

  -- 4. Unión cronológica (nunca incluye nota_area ni historial_clinico)
  return query
  select lt.fecha,
         lt.tipo,
         lt.area,
         lt.titulo,
         lt.detalle,
         lt.referencia_id
  from (
    -- 4.1 Registro de ficha
    select fr.registrada_en                                           as fecha,
           'registro'::text                                           as tipo,
           null::text                                                 as area,
           ('Registro de ficha ' || fr.folio || ' · ' || fr.estado::text)::text as titulo,
           null::text                                                 as detalle,
           fr.id                                                      as referencia_id
    from public.ficha_registro fr
    where fr.id = p_ficha_id
      and fr.activo

    union all

    -- 4.2 Citas de la persona
    select c.programada_en                                            as fecha,
           'cita'::text                                               as tipo,
           ca.nombre                                                  as area,
           ('Cita ' || ca.nombre || ' · ' || c.estado::text)::text    as titulo,
           case
             when v_es_direccion or c.area_id = v_mi_area_id then
               nullif(btrim(c.motivo_cancelacion), '')
             else null
           end                                                        as detalle,
           c.id                                                       as referencia_id
    from public.cita c
    join public.cat_area ca on ca.id = c.area_id
    where c.persona_id = v_persona_id
      and c.activo

    union all

    -- 4.3 Atenciones (hojas de seguimiento)
    select a.atendida_en                                              as fecha,
           'atencion'::text                                           as tipo,
           ca.nombre                                                  as area,
           ('Atención ' || ca.nombre || ' · ' || cta.nombre)::text    as titulo,
           case
             when v_es_direccion or a.area_id = v_mi_area_id then
               coalesce(nullif(btrim(a.acciones_realizadas), ''), nullif(btrim(a.observaciones), ''))
             else null
           end                                                        as detalle,
           a.id                                                       as referencia_id
    from public.atencion a
    join public.cat_area ca          on ca.id = a.area_id
    join public.cat_tipo_atencion cta on cta.id = a.tipo_atencion_id
    where a.ficha_id = p_ficha_id
      and a.activo

    union all

    -- 4.4 Derivaciones internas y externas
    select d.creado_en                                                as fecha,
           'derivacion'::text                                         as tipo,
           cao.nombre                                                 as area,
           (
             'Derivación a '
             || coalesce(cad.nombre, di.nombre, nullif(btrim(d.institucion_otra), ''), d.destino::text)
             || ' · '
             || d.estado::text
           )::text                                                    as titulo,
           case
             when v_es_direccion
               or d.area_origen_id = v_mi_area_id
               or d.area_destino_id = v_mi_area_id
             then nullif(btrim(d.motivo), '')
             else null
           end                                                        as detalle,
           d.id                                                       as referencia_id
    from public.derivacion d
    left join public.cat_area cao               on cao.id = d.area_origen_id
    left join public.cat_area cad               on cad.id = d.area_destino_id
    left join public.directorio_institucion di  on di.id  = d.institucion_id
    where d.ficha_id = p_ficha_id
      and d.activo

    union all

    -- 4.5 Órdenes de protección
    select op.creado_en                                               as fecha,
           'orden_proteccion'::text                                   as tipo,
           null::text                                                 as area,
           ('Orden de protección · ' || op.estado::text)::text        as titulo,
           case
             when v_es_direccion or v_rol in ('juridico', 'trabajo_social') then
               nullif(btrim(concat_ws(' — ', nullif(btrim(op.numero_oficio), ''), nullif(btrim(op.autoridad_emisora), ''))), '')
             else null
           end                                                        as detalle,
           op.id                                                      as referencia_id
    from public.orden_proteccion op
    where op.ficha_id = p_ficha_id
      and op.activo

    union all

    -- 4.6 Alertas asociadas a la persona (directas o por pre-registro)
    select al.creado_en                                               as fecha,
           'alerta'::text                                             as tipo,
           null::text                                                 as area,
           ('Alerta ' || al.origen::text || ' · ' || al.prioridad::text || ' (' || al.estado::text || ')')::text as titulo,
           case
             when v_es_direccion or v_es_linea_24_7 then
               nullif(btrim(al.observaciones), '')
             else null
           end                                                        as detalle,
           al.id                                                      as referencia_id
    from public.alerta al
    left join public.pre_registro pr on pr.id = al.pre_registro_id
    where al.activo
      and (al.persona_id = v_persona_id or pr.persona_id = v_persona_id)
  ) lt
  order by lt.fecha desc, lt.tipo asc, lt.referencia_id desc;
end;
$$;

revoke execute on function public.get_linea_tiempo(uuid) from public, anon;
grant  execute on function public.get_linea_tiempo(uuid) to authenticated;
