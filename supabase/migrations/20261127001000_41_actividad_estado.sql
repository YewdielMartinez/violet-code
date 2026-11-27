-- =====================================================================
-- 41_actividad_estado.sql (Sprint 02 · RF-16)
-- Qué contiene:
--   1. Enum public.estado_actividad ('pendiente','realizada','cancelada').
--   2. Columnas en public.actividad_preventiva: estado, realizada_en,
--      cancelada_motivo, observaciones_cierre (+ checks). Backfill:
--      las actividades con programada_en < now() pasan a 'realizada'
--      con realizada_en = programada_en; el resto queda 'pendiente'.
--   3. get_actividades_preventivas: nuevo parámetro opcional p_estado y
--      nuevas columnas de salida (cambia el tipo de retorno: drop + create).
--   4. RPC actualizar_estado_actividad(...) con permiso
--      'actividad.registrar' (sin cambios en tiene_permiso).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------
do $$ begin
  create type public.estado_actividad as enum ('pendiente', 'realizada', 'cancelada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Columnas, backfill y constraints
-- ---------------------------------------------------------------------
alter table public.actividad_preventiva
  add column if not exists estado public.estado_actividad not null default 'pendiente',
  add column if not exists realizada_en timestamptz,
  add column if not exists cancelada_motivo text
    check (cancelada_motivo is null or char_length(cancelada_motivo) <= 500),
  add column if not exists observaciones_cierre text
    check (observaciones_cierre is null or char_length(observaciones_cierre) <= 1000);

-- Backfill (solo filas aún 'pendiente' sin realizada_en, para ser idempotente)
update public.actividad_preventiva ap
set estado       = 'realizada',
    realizada_en = ap.programada_en
where ap.estado = 'pendiente'
  and ap.realizada_en is null
  and ap.programada_en < now();

alter table public.actividad_preventiva
  drop constraint if exists actividad_preventiva_realizada_en_chk;
alter table public.actividad_preventiva
  add constraint actividad_preventiva_realizada_en_chk
  check (estado <> 'realizada' or realizada_en is not null);

create index if not exists actividad_preventiva_estado_idx
  on public.actividad_preventiva (estado);

-- ---------------------------------------------------------------------
-- 3. get_actividades_preventivas con filtro y columnas de estado
-- ---------------------------------------------------------------------
drop function if exists public.get_actividades_preventivas(timestamptz, timestamptz, integer);

create or replace function public.get_actividades_preventivas(
  p_desde  timestamptz default null,
  p_hasta  timestamptz default null,
  p_limite integer     default 100,
  p_estado public.estado_actividad default null
)
returns table (
  id                    uuid,
  titulo                text,
  tipo_actividad_id     smallint,
  tipo_actividad_clave  text,
  tipo_actividad_nombre text,
  tipo_institucion      public.tipo_institucion_actividad,
  nivel_educativo       public.nivel_educativo,
  sede                  text,
  direccion             text,
  referencias           text,
  asentamiento_id       integer,
  asentamiento_nombre   text,
  codigo_postal         text,
  municipio             text,
  programada_en         timestamptz,
  numero_asistentes     smallint,
  creado_por            uuid,
  creado_por_nombre     text,
  creado_en             timestamptz,
  participantes         jsonb,
  estado                public.estado_actividad,
  realizada_en          timestamptz,
  cancelada_motivo      text,
  observaciones_cierre  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- 1. Validar permiso RBAC centralizado
  if not public.tiene_permiso('actividad.ver') then
    raise exception 'Sin permiso para consultar actividades preventivas'
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

  -- 3. Consulta con alias explícitos en todas las tablas
  return query
  select ap.id                                    as id,
         ap.titulo                                as titulo,
         ap.tipo_actividad_id                     as tipo_actividad_id,
         cta.clave                                as tipo_actividad_clave,
         cta.nombre                               as tipo_actividad_nombre,
         ap.tipo_institucion                      as tipo_institucion,
         ap.nivel_educativo                       as nivel_educativo,
         ap.sede                                  as sede,
         ap.direccion                             as direccion,
         ap.referencias                           as referencias,
         ap.asentamiento_id                       as asentamiento_id,
         ca.nombre                                as asentamiento_nombre,
         ca.codigo_postal                         as codigo_postal,
         ca.municipio                             as municipio,
         ap.programada_en                         as programada_en,
         ap.numero_asistentes                     as numero_asistentes,
         ap.creado_por                            as creado_por,
         ec.nombre                                as creado_por_nombre,
         ap.creado_en                             as creado_en,
         coalesce(part.lista, '[]'::jsonb)        as participantes,
         ap.estado                                as estado,
         ap.realizada_en                          as realizada_en,
         ap.cancelada_motivo                      as cancelada_motivo,
         ap.observaciones_cierre                  as observaciones_cierre
  from public.actividad_preventiva ap
  join public.cat_tipo_actividad cta on cta.id = ap.tipo_actividad_id
  left join public.cat_asentamiento ca on ca.id = ap.asentamiento_id
  left join public.empleado ec on ec.id = ap.creado_por
  left join lateral (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'empleado_id', ep.id,
                 'nombre',      ep.nombre,
                 'rol',         ep.rol
               )
               order by ep.nombre
             ),
             '[]'::jsonb
           ) as lista
    from public.actividad_empleado ae
    join public.empleado ep on ep.id = ae.empleado_id
    where ae.actividad_preventiva_id = ap.id
      and ae.activo
  ) part on true
  where ap.activo
    and (p_desde is null or ap.programada_en >= p_desde)
    and (p_hasta is null or ap.programada_en <= p_hasta)
    and (p_estado is null or ap.estado = p_estado)
  order by ap.programada_en desc, ap.creado_en desc
  limit p_limite;
end;
$$;

revoke execute on function public.get_actividades_preventivas(timestamptz, timestamptz, integer, public.estado_actividad) from public, anon;
grant  execute on function public.get_actividades_preventivas(timestamptz, timestamptz, integer, public.estado_actividad) to authenticated;

-- ---------------------------------------------------------------------
-- 4. public.actualizar_estado_actividad
-- Transiciones: pendiente -> realizada | cancelada; realizada/cancelada
-- -> pendiente (reapertura). Mismo estado => 22023. Cualquier otra
-- transición (realizada <-> cancelada) => 22023 (reabrir primero).
-- actualizado_en lo mantiene el trigger set_actualizado_en.
-- ---------------------------------------------------------------------
create or replace function public.actualizar_estado_actividad(
  p_actividad_id       uuid,
  p_estado             public.estado_actividad,
  p_numero_asistentes  integer default null,
  p_observaciones      text    default null,
  p_motivo_cancelacion text    default null
)
returns table (
  actividad_id uuid,
  estado       public.estado_actividad,
  realizada_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id      uuid := auth.uid();
  v_actual        public.estado_actividad;
  v_observaciones text;
  v_motivo        text;
  v_realizada_en  timestamptz;
begin
  if not public.tiene_permiso('actividad.registrar') then
    raise exception 'Sin permiso para actualizar actividades'
      using errcode = '42501';
  end if;

  if p_actividad_id is null or p_estado is null then
    raise exception 'La actividad y el estado son obligatorios'
      using errcode = '22023';
  end if;

  select ap.estado
    into v_actual
  from public.actividad_preventiva ap
  where ap.id = p_actividad_id
    and ap.activo
  for update;

  if not found then
    raise exception 'Actividad no encontrada o inactiva'
      using errcode = 'P0002';
  end if;

  if v_actual = p_estado then
    raise exception 'La actividad ya está en ese estado'
      using errcode = '22023';
  end if;

  if v_actual <> 'pendiente' and p_estado <> 'pendiente' then
    raise exception 'Para cambiar el estado primero reabra la actividad (pendiente)'
      using errcode = '22023';
  end if;

  v_observaciones := nullif(btrim(coalesce(p_observaciones, '')), '');
  v_motivo        := nullif(btrim(coalesce(p_motivo_cancelacion, '')), '');

  if p_estado = 'realizada' then
    if p_numero_asistentes is not null and p_numero_asistentes not between 0 and 10000 then
      raise exception 'El número de asistentes debe estar entre 0 y 10000'
        using errcode = '23514';
    end if;
    if v_observaciones is not null and char_length(v_observaciones) > 1000 then
      raise exception 'Las observaciones no pueden exceder 1000 caracteres'
        using errcode = '23514';
    end if;

    v_realizada_en := now();
    update public.actividad_preventiva ap
    set estado               = 'realizada',
        realizada_en         = v_realizada_en,
        cancelada_motivo     = null,
        observaciones_cierre = v_observaciones,
        numero_asistentes    = coalesce(p_numero_asistentes::smallint, ap.numero_asistentes)
    where ap.id = p_actividad_id;

  elsif p_estado = 'cancelada' then
    if v_motivo is not null and char_length(v_motivo) > 500 then
      raise exception 'El motivo de cancelación no puede exceder 500 caracteres'
        using errcode = '23514';
    end if;

    v_realizada_en := null;
    update public.actividad_preventiva ap
    set estado               = 'cancelada',
        realizada_en         = null,
        cancelada_motivo     = v_motivo,
        observaciones_cierre = null
    where ap.id = p_actividad_id;

  else
    -- Reapertura: vuelve a 'pendiente' y limpia datos de cierre/cancelación
    v_realizada_en := null;
    update public.actividad_preventiva ap
    set estado               = 'pendiente',
        realizada_en         = null,
        cancelada_motivo     = null,
        observaciones_cierre = null
    where ap.id = p_actividad_id;
  end if;

  insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
  values (v_actor_id, 'actualizar', 'actividad_preventiva', p_actividad_id::text);

  return query select p_actividad_id, p_estado, v_realizada_en;
end;
$$;

revoke execute on function public.actualizar_estado_actividad(uuid, public.estado_actividad, integer, text, text) from public, anon;
grant  execute on function public.actualizar_estado_actividad(uuid, public.estado_actividad, integer, text, text) to authenticated;
