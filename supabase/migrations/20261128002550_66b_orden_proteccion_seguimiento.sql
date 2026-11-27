-- =====================================================================
-- 66_orden_proteccion_seguimiento.sql
-- Cada cambio de estado de una orden de protección debe aparecer en el
-- área de seguimiento del expediente (pestaña «Seguimiento» = línea de
-- tiempo, RPC get_linea_tiempo).
--
-- Qué contiene:
--   1. Tabla append-only public.orden_proteccion_evento (mismo patrón que
--      canalizacion_evento): estado anterior -> nuevo, nota, usuario y fecha.
--      RLS SELECT con expediente.ver; sin INSERT/UPDATE/DELETE directos.
--   2. Columna transitoria orden_proteccion.nota_cambio_estado: la web la
--      envía en el mismo UPDATE que cambia el estado; el trigger la copia
--      al evento y la limpia (nunca queda almacenada en la orden).
--   3. Triggers en orden_proteccion:
--        - AFTER INSERT: evento inicial (estado_anterior = null).
--        - BEFORE UPDATE: evento cuando estado cambia (y limpia la nota).
--      Así el evento se registra aunque el cambio llegue por PostgREST
--      (update directo), sin depender de un RPC.
--   4. Backfill: un evento inicial por cada orden existente.
--   5. get_linea_tiempo(p_ficha_id): misma firma y permisos; agrega los
--      cambios de estado de órdenes (tipo 'orden_proteccion', título
--      «Orden de protección: <anterior> → <nuevo>») y calcula el título del
--      alta con el estado inicial de la orden, no el actual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla public.orden_proteccion_evento (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.orden_proteccion_evento (
  id                  uuid primary key default gen_random_uuid(),
  orden_proteccion_id uuid not null references public.orden_proteccion (id) on delete restrict,
  estado_anterior     public.estado_orden_proteccion,
  estado_nuevo        public.estado_orden_proteccion not null,
  nota                text check (nota is null or char_length(btrim(nota)) <= 1000),
  creado_por          uuid references public.empleado (id) on delete restrict,
  creado_en           timestamptz not null default now()
);

create index if not exists orden_proteccion_evento_orden_creado_idx
  on public.orden_proteccion_evento (orden_proteccion_id, creado_en asc);

create index if not exists orden_proteccion_evento_creado_por_idx
  on public.orden_proteccion_evento (creado_por);

revoke all on table public.orden_proteccion_evento from public, anon, authenticated;
grant select on table public.orden_proteccion_evento to authenticated;

alter table public.orden_proteccion_evento enable row level security;

drop policy if exists orden_proteccion_evento_select on public.orden_proteccion_evento;

create policy orden_proteccion_evento_select on public.orden_proteccion_evento
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

-- ---------------------------------------------------------------------
-- 2. Columna transitoria para la nota del cambio de estado
-- ---------------------------------------------------------------------
alter table public.orden_proteccion
  add column if not exists nota_cambio_estado text;

alter table public.orden_proteccion
  drop constraint if exists orden_proteccion_nota_cambio_estado_check;

alter table public.orden_proteccion
  add constraint orden_proteccion_nota_cambio_estado_check
  check (nota_cambio_estado is null or char_length(btrim(nota_cambio_estado)) <= 1000);

-- ---------------------------------------------------------------------
-- 3. Triggers de registro de eventos
-- ---------------------------------------------------------------------
create or replace function public.orden_proteccion_evento_alta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.orden_proteccion_evento (
    orden_proteccion_id,
    estado_anterior,
    estado_nuevo,
    nota,
    creado_por,
    creado_en
  ) values (
    new.id,
    null,
    new.estado,
    null,
    coalesce(
      (select e.id from public.empleado e where e.id = auth.uid()),
      new.creado_por
    ),
    new.creado_en
  );
  return null;
end;
$$;

revoke all on function public.orden_proteccion_evento_alta() from public, anon, authenticated;

create or replace function public.orden_proteccion_evento_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.orden_proteccion_evento (
      orden_proteccion_id,
      estado_anterior,
      estado_nuevo,
      nota,
      creado_por
    ) values (
      new.id,
      old.estado,
      new.estado,
      nullif(btrim(coalesce(new.nota_cambio_estado, '')), ''),
      (select e.id from public.empleado e where e.id = auth.uid())
    );
  end if;

  -- La nota solo viaja en el UPDATE: nunca se conserva en la orden.
  new.nota_cambio_estado := null;
  return new;
end;
$$;

revoke all on function public.orden_proteccion_evento_estado() from public, anon, authenticated;

drop trigger if exists orden_proteccion_evento_alta on public.orden_proteccion;
create trigger orden_proteccion_evento_alta
  after insert on public.orden_proteccion
  for each row execute function public.orden_proteccion_evento_alta();

drop trigger if exists orden_proteccion_evento_estado on public.orden_proteccion;
create trigger orden_proteccion_evento_estado
  before update on public.orden_proteccion
  for each row execute function public.orden_proteccion_evento_estado();

-- ---------------------------------------------------------------------
-- 4. Backfill: evento inicial para las órdenes existentes
-- ---------------------------------------------------------------------
insert into public.orden_proteccion_evento (
  orden_proteccion_id,
  estado_anterior,
  estado_nuevo,
  nota,
  creado_por,
  creado_en
)
select
  op.id,
  null::public.estado_orden_proteccion,
  op.estado,
  null,
  op.creado_por,
  op.creado_en
from public.orden_proteccion op
where not exists (
  select 1
  from public.orden_proteccion_evento oe
  where oe.orden_proteccion_id = op.id
);

-- ---------------------------------------------------------------------
-- 5. get_linea_tiempo(p_ficha_id): agrega cambios de estado de órdenes
--    (misma firma, mismos permisos y filtros ABAC que la migración 54).
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

    -- Alta de la orden: el título refleja el estado con el que se registró.
    select op.creado_en                                               as fecha,
           'orden_proteccion'::text                                   as tipo,
           null::text                                                 as area,
           (
             'Orden de protección · '
             || coalesce(
                  (
                    select oe0.estado_nuevo::text
                    from public.orden_proteccion_evento oe0
                    where oe0.orden_proteccion_id = op.id
                      and oe0.estado_anterior is null
                    order by oe0.creado_en asc, oe0.id asc
                    limit 1
                  ),
                  op.estado::text
                )
           )::text                                                    as titulo,
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

    -- Cambios de estado de la orden: anterior -> nuevo, usuario y nota.
    select oe.creado_en                                               as fecha,
           'orden_proteccion'::text                                   as tipo,
           null::text                                                 as area,
           (
             'Orden de protección: '
             || oe.estado_anterior::text
             || ' → '
             || oe.estado_nuevo::text
           )::text                                                    as titulo,
           case
             when v_es_direccion or v_rol in ('juridico', 'trabajo_social') then
               nullif(
                 btrim(
                   concat_ws(
                     ' — ',
                     case when emp.nombre is not null then 'Por ' || emp.nombre end,
                     nullif(btrim(oe.nota), '')
                   )
                 ),
                 ''
               )
             else null
           end                                                        as detalle,
           oe.id                                                      as referencia_id
    from public.orden_proteccion_evento oe
    join public.orden_proteccion op   on op.id  = oe.orden_proteccion_id
    left join public.empleado emp     on emp.id = oe.creado_por
    where op.ficha_id = p_ficha_id
      and op.activo
      and oe.estado_anterior is not null

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
