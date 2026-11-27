-- =====================================================================
-- 34_historial_canalizaciones.sql (A-02 · Sprint 02)
-- Qué contiene:
--   1. Tabla append-only public.canalizacion_evento con RLS SELECT igual
--      a derivacion_select (sin INSERT/UPDATE/DELETE directos).
--   2. Backfill inicial (estado_anterior = null) para canalizaciones
--      existentes en public.derivacion.
--   3. Actualiza cambiar_estado_derivacion(p_derivacion_id, p_estado, p_nota):
--      migra a tiene_permiso('derivacion.gestionar'), exige nota para
--      concluida/cancelada (23514) y registra evento en canalizacion_evento.
--   4. Actualiza get_derivaciones() para validar con
--      tiene_permiso('derivacion.gestionar') manteniendo su alcance ABAC.
--   5. Crea get_historial_canalizaciones(p_ficha_id) con eventos jsonb.
--   6. Extiende get_linea_tiempo(p_ficha_id) (1.ª parte) con cambios de
--      estado de canalización filtrados por rol/área.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla public.canalizacion_evento (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.canalizacion_evento (
  id              uuid primary key default gen_random_uuid(),
  derivacion_id   uuid not null references public.derivacion (id) on delete restrict,
  estado_anterior public.estado_derivacion,
  estado_nuevo    public.estado_derivacion not null,
  nota            text check (nota is null or char_length(btrim(nota)) <= 1000),
  creado_por      uuid references public.empleado (id) on delete restrict,
  creado_en       timestamptz not null default now()
);

create index if not exists canalizacion_evento_derivacion_creado_idx
  on public.canalizacion_evento (derivacion_id, creado_en asc);

revoke all on table public.canalizacion_evento from public, anon, authenticated;
grant select on table public.canalizacion_evento to authenticated;

alter table public.canalizacion_evento enable row level security;

drop policy if exists canalizacion_evento_select on public.canalizacion_evento;

create policy canalizacion_evento_select on public.canalizacion_evento
  for select to authenticated
  using (
    (select public.tiene_permiso('derivacion.gestionar'))
    and exists (
      select 1
      from public.derivacion d
      where d.id = canalizacion_evento.derivacion_id
        and (
          (select public.es_direccion())
          or (select public.auth_rol()) = 'trabajo_social'
          or d.area_origen_id = (select public.auth_area_id())
          or d.area_destino_id = (select public.auth_area_id())
        )
    )
  );

-- ---------------------------------------------------------------------
-- 2. Backfill inicial para canalizaciones ya existentes
-- ---------------------------------------------------------------------
insert into public.canalizacion_evento (
  derivacion_id,
  estado_anterior,
  estado_nuevo,
  nota,
  creado_por,
  creado_en
)
select
  d.id,
  null::public.estado_derivacion,
  d.estado,
  nullif(btrim(coalesce(d.motivo, '')), ''),
  d.creado_por,
  d.creado_en
from public.derivacion d
where not exists (
  select 1
  from public.canalizacion_evento ce
  where ce.derivacion_id = d.id
);

-- ---------------------------------------------------------------------
-- 3. RPC: public.cambiar_estado_derivacion (firma extendida con p_nota)
-- ---------------------------------------------------------------------
drop function if exists public.cambiar_estado_derivacion(uuid, public.estado_derivacion);

create or replace function public.cambiar_estado_derivacion(
  p_derivacion_id uuid,
  p_estado        public.estado_derivacion,
  p_nota          text default null
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
  v_es_direccion   boolean;
  v_deriv          record;
  v_nota           text;
  v_actualizado_en timestamptz;
begin
  if not public.tiene_permiso('derivacion.gestionar') then
    raise exception 'Sin permiso para gestionar derivaciones' using errcode = '42501';
  end if;

  if p_derivacion_id is null or p_estado is null then
    raise exception 'Derivación y estado destino son obligatorios' using errcode = '23514';
  end if;

  v_nota := nullif(btrim(coalesce(p_nota, '')), '');

  if v_nota is not null and char_length(v_nota) > 1000 then
    raise exception 'La nota de canalización no debe exceder 1000 caracteres'
      using errcode = '23514';
  end if;

  if p_estado in ('concluida', 'cancelada') and v_nota is null then
    raise exception 'La nota es obligatoria al concluir o cancelar una canalización'
      using errcode = '23514';
  end if;

  v_rol          := public.auth_rol();
  v_area_id      := public.auth_area_id();
  v_es_direccion := public.es_direccion();

  select d.id, d.estado, d.area_origen_id, d.area_destino_id
  into v_deriv
  from public.derivacion d
  where d.id = p_derivacion_id
    and d.activo
  for update;

  if v_deriv.id is null then
    raise exception 'Derivación no encontrada o inactiva' using errcode = '23514';
  end if;

  if not v_es_direccion
     and v_rol <> 'trabajo_social'
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

  insert into public.canalizacion_evento (
    derivacion_id,
    estado_anterior,
    estado_nuevo,
    nota,
    creado_por
  ) values (
    p_derivacion_id,
    v_deriv.estado,
    p_estado,
    v_nota,
    v_actor_id
  );

  return query select p_derivacion_id, p_estado, v_actualizado_en;
end;
$$;

revoke all on function public.cambiar_estado_derivacion(uuid, public.estado_derivacion, text) from public, anon;
grant  execute on function public.cambiar_estado_derivacion(uuid, public.estado_derivacion, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC: public.get_derivaciones (migra RBAC a tiene_permiso)
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
  v_rol          public.rol_empleado;
  v_area_id      smallint;
  v_es_direccion boolean;
begin
  if not public.tiene_permiso('derivacion.gestionar') then
    raise exception 'Sin permiso para consultar derivaciones' using errcode = '42501';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'El límite de derivaciones debe estar entre 1 y 200' using errcode = '23514';
  end if;

  v_rol          := public.auth_rol();
  v_area_id      := public.auth_area_id();
  v_es_direccion := public.es_direccion();

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
      v_es_direccion
      or v_rol = 'trabajo_social'
      or d.area_origen_id = v_area_id
      or d.area_destino_id = v_area_id
    )
  order by d.creado_en desc
  limit p_limite;
end;
$$;

revoke all on function public.get_derivaciones(uuid, public.estado_derivacion, int) from public, anon;
grant  execute on function public.get_derivaciones(uuid, public.estado_derivacion, int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: public.get_historial_canalizaciones(p_ficha_id)
-- ---------------------------------------------------------------------
create or replace function public.get_historial_canalizaciones(
  p_ficha_id uuid
)
returns table (
  id                  uuid,
  ficha_id            uuid,
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
  creado_en           timestamptz,
  actualizado_en      timestamptz,
  eventos             jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol          public.rol_empleado;
  v_area_id      smallint;
  v_es_direccion boolean;
begin
  if not public.tiene_permiso('derivacion.gestionar') then
    raise exception 'Sin permiso para consultar el historial de canalizaciones'
      using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente (p_ficha_id) es obligatorio'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.ficha_registro f
    where f.id = p_ficha_id
      and f.activo
  ) then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  v_rol          := public.auth_rol();
  v_area_id      := public.auth_area_id();
  v_es_direccion := public.es_direccion();

  return query
  select
    d.id,
    d.ficha_id,
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
    d.creado_en,
    d.actualizado_en,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ce.id,
            'estado_anterior', ce.estado_anterior,
            'estado_nuevo', ce.estado_nuevo,
            'nota', ce.nota,
            'creado_por', ce.creado_por,
            'creado_por_nombre', emp.nombre,
            'creado_en', ce.creado_en
          )
          order by ce.creado_en asc, ce.id asc
        )
        from public.canalizacion_evento ce
        left join public.empleado emp on emp.id = ce.creado_por
        where ce.derivacion_id = d.id
      ),
      '[]'::jsonb
    ) as eventos
  from public.derivacion d
  left join public.cat_area ao on ao.id = d.area_origen_id
  left join public.cat_area ad on ad.id = d.area_destino_id
  left join public.directorio_institucion inst on inst.id = d.institucion_id
  where d.activo
    and d.ficha_id = p_ficha_id
    and (
      v_es_direccion
      or v_rol = 'trabajo_social'
      or d.area_origen_id = v_area_id
      or d.area_destino_id = v_area_id
    )
  order by d.creado_en desc, d.id desc;
end;
$$;

revoke all on function public.get_historial_canalizaciones(uuid) from public, anon;
grant  execute on function public.get_historial_canalizaciones(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC: public.get_linea_tiempo(p_ficha_id) (1.ª parte: agrega
--    eventos de cambio de estado de canalización)
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

    -- 4.4b Eventos de cambio de estado de canalizaciones
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

revoke all on function public.get_linea_tiempo(uuid) from public, anon;
grant  execute on function public.get_linea_tiempo(uuid) to authenticated;
