-- =====================================================================
-- 65_historial_ordenes_proteccion.sql
-- Qué contiene:
--   1. Tabla append-only public.orden_proteccion_evento: cada alta y cada
--      cambio de estado de una orden de protección (RF-17).
--   2. Trigger en public.orden_proteccion que registra esos eventos.
--   3. Backfill: un evento inicial (estado_anterior = null) por orden.
--   4. get_linea_tiempo(p_ficha_id): la orden de protección ya no es una
--      sola fila con el estado actual; muestra el registro y cada cambio
--      de estado ("vigente → revocada") con la fecha en que ocurrió.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla public.orden_proteccion_evento (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.orden_proteccion_evento (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references public.orden_proteccion (id) on delete restrict,
  estado_anterior public.estado_orden_proteccion,
  estado_nuevo    public.estado_orden_proteccion not null,
  creado_por      uuid references public.empleado (id) on delete restrict,
  creado_en       timestamptz not null default now()
);

create index if not exists orden_proteccion_evento_orden_creado_idx
  on public.orden_proteccion_evento (orden_id, creado_en asc);

-- Solo lectura vía get_linea_tiempo() (security definer): sin acceso directo.
revoke all on table public.orden_proteccion_evento from public, anon, authenticated;
alter table public.orden_proteccion_evento enable row level security;

-- ---------------------------------------------------------------------
-- 2. Trigger: registra el alta y cada cambio de estado
-- ---------------------------------------------------------------------
create or replace function public.registrar_evento_orden_proteccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
begin
  select e.id into v_actor_id from public.empleado e where e.id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.orden_proteccion_evento (orden_id, estado_anterior, estado_nuevo, creado_por, creado_en)
    values (new.id, null, new.estado, v_actor_id, new.creado_en);
  elsif new.estado is distinct from old.estado then
    insert into public.orden_proteccion_evento (orden_id, estado_anterior, estado_nuevo, creado_por)
    values (new.id, old.estado, new.estado, v_actor_id);
  end if;

  return null;
end;
$$;

revoke execute on function public.registrar_evento_orden_proteccion() from public, anon, authenticated;

drop trigger if exists orden_proteccion_evento_trg on public.orden_proteccion;
create trigger orden_proteccion_evento_trg
  after insert or update of estado on public.orden_proteccion
  for each row execute function public.registrar_evento_orden_proteccion();

-- ---------------------------------------------------------------------
-- 3. Backfill: evento inicial para las órdenes ya existentes
-- ---------------------------------------------------------------------
insert into public.orden_proteccion_evento (orden_id, estado_anterior, estado_nuevo, creado_por, creado_en)
select op.id, null, op.estado, op.creado_por, op.creado_en
from public.orden_proteccion op
where not exists (
  select 1 from public.orden_proteccion_evento e where e.orden_id = op.id
);

-- ---------------------------------------------------------------------
-- 4. get_linea_tiempo(): órdenes de protección con su historial de estados
--    (resto de la función idéntica a la de 54_quitar_folio_seguimiento.sql)
-- ---------------------------------------------------------------------
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
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para consultar la línea de tiempo del expediente'
      using errcode = '42501';
  end if;

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

  v_es_direccion  := public.es_direccion();
  v_mi_area_id    := public.auth_area_id();
  v_rol           := public.auth_rol();
  v_es_linea_24_7 := public.es_linea_24_7();

  return query
  select lt.fecha,
         lt.tipo,
         lt.area,
         lt.titulo,
         lt.detalle,
         lt.referencia_id
  from (
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

    select coalesce(fr.archivada_en, fr.actualizado_en)                as fecha,
           'archivo'::text                                            as tipo,
           null::text                                                 as area,
           ('Archivo de expediente ' || fr.folio)::text               as titulo,
           nullif(btrim(fr.motivo_archivo), '')                       as detalle,
           fr.id                                                      as referencia_id
    from public.ficha_registro fr
    where fr.id = p_ficha_id
      and fr.activo
      and (fr.estado = 'archivado' or fr.archivada_en is not null)

    union all

    select fr.reabierta_en                                            as fecha,
           'reapertura'::text                                         as tipo,
           null::text                                                 as area,
           ('Reapertura de expediente ' || fr.folio)::text            as titulo,
           nullif(btrim(fr.motivo_reapertura), '')                    as detalle,
           fr.id                                                      as referencia_id
    from public.ficha_registro fr
    where fr.id = p_ficha_id
      and fr.activo
      and fr.reabierta_en is not null

    union all

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
    join public.cat_area ca           on ca.id = a.area_id
    join public.cat_tipo_atencion cta on cta.id = a.tipo_atencion_id
    where a.ficha_id = p_ficha_id
      and a.activo

    union all

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

    select ce.creado_en                                               as fecha,
           'canalizacion_evento'::text                                as tipo,
           coalesce(cao.nombre, cad.nombre)                           as area,
           (
             'Canalización a '
             || coalesce(cad.nombre, di.nombre, nullif(btrim(d.institucion_otra), ''), d.destino::text)
             || ': '
             || ce.estado_anterior::text
             || ' → '
             || ce.estado_nuevo::text
           )::text                                                    as titulo,
           case
             when v_es_direccion
               or v_rol = 'trabajo_social'
               or d.area_origen_id = v_mi_area_id
               or d.area_destino_id = v_mi_area_id
             then nullif(btrim(ce.nota), '')
             else null
           end                                                        as detalle,
           ce.id                                                      as referencia_id
    from public.canalizacion_evento ce
    join public.derivacion d                    on d.id   = ce.derivacion_id
    left join public.cat_area cao               on cao.id = d.area_origen_id
    left join public.cat_area cad               on cad.id = d.area_destino_id
    left join public.directorio_institucion di  on di.id  = d.institucion_id
    where d.ficha_id = p_ficha_id
      and d.activo
      and ce.estado_anterior is not null

    union all

    -- Órdenes de protección: registro y cada cambio de estado
    select oe.creado_en                                               as fecha,
           'orden_proteccion'::text                                   as tipo,
           null::text                                                 as area,
           (
             case
               when oe.estado_anterior is null
                 then 'Orden de protección registrada · ' || oe.estado_nuevo::text
               else 'Orden de protección: ' || oe.estado_anterior::text || ' → ' || oe.estado_nuevo::text
             end
           )::text                                                    as titulo,
           case
             when v_es_direccion or v_rol in ('juridico', 'trabajo_social') then
               nullif(btrim(concat_ws(' — ', nullif(btrim(op.numero_oficio), ''), nullif(btrim(op.autoridad_emisora), ''))), '')
             else null
           end                                                        as detalle,
           oe.id                                                      as referencia_id
    from public.orden_proteccion_evento oe
    join public.orden_proteccion op on op.id = oe.orden_id
    where op.ficha_id = p_ficha_id
      and op.activo

    union all

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
