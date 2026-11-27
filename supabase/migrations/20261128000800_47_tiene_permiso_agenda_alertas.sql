-- =====================================================================
-- 47_tiene_permiso_agenda_alertas.sql (Tarjeta #95)
-- 1. Migra get_agenda, cambiar_estado_cita, reagendar_cita,
--    get_lista_urgencias, get_cola_alertas, tomar_alerta y atender_alerta
--    de `e.rol in (...)` a `public.tiene_permiso(...)`, conservando
--    intactos los filtros ABAC por área.
-- 2. Actualiza get_linea_tiempo() (2.ª parte) para mostrar el
--    folio_seguimiento en atenciones y evento de archivo cuando la ficha
--    está archivada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. get_agenda -> tiene_permiso('agenda.ver')
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
  v_rol      public.rol_empleado;
  v_area_id  smallint;
begin
  if not public.tiene_permiso('agenda.ver') then
    raise exception 'Sin permiso para consultar la agenda' using errcode = '42501';
  end if;

  v_rol     := public.auth_rol();
  v_area_id := public.auth_area_id();

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

-- ---------------------------------------------------------------------
-- 2. cambiar_estado_cita -> tiene_permiso('agenda.gestionar')
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
  v_rol           public.rol_empleado;
  v_area_id       smallint;
  v_cita          record;
  v_confirmada_en timestamptz;
begin
  if not public.tiene_permiso('agenda.gestionar') then
    raise exception 'Sin permiso para gestionar citas' using errcode = '42501';
  end if;

  v_rol     := public.auth_rol();
  v_area_id := public.auth_area_id();

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

-- ---------------------------------------------------------------------
-- 3. reagendar_cita -> tiene_permiso('agenda.gestionar')
-- ---------------------------------------------------------------------
create or replace function public.reagendar_cita(
  p_cita_id     uuid,
  p_nueva_fecha timestamptz,
  p_motivo      text default null,
  p_prioridad   public.prioridad_nivel default null
)
returns table (
  cita_anterior_id uuid,
  cita_nueva_id    uuid,
  programada_en    timestamptz,
  estado           public.estado_cita
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rol      public.rol_empleado;
  v_area_id  smallint;
  v_cita     record;
  v_nueva_id uuid;
begin
  if not public.tiene_permiso('agenda.gestionar') then
    raise exception 'Sin permiso para reagendar citas' using errcode = '42501';
  end if;

  v_rol     := public.auth_rol();
  v_area_id := public.auth_area_id();

  if p_cita_id is null or p_nueva_fecha is null then
    raise exception 'La cita y la nueva fecha son obligatorias' using errcode = '23514';
  end if;

  if p_nueva_fecha <= now() then
    raise exception 'La nueva fecha de la cita debe estar en el futuro' using errcode = '23514';
  end if;

  if p_motivo is not null and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo no puede exceder 500 caracteres' using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, a.clave as area_clave,
         c.estado, c.prioridad, c.recomendada_por, c.origen
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
    raise exception 'Recepción solo puede reagendar citas de Trabajo Social o Psicología'
      using errcode = '42501';
  elsif v_rol in ('trabajo_social', 'psicologia', 'juridico')
        and v_cita.area_id is distinct from v_area_id then
    raise exception 'Sin permiso para reagendar citas de otra área' using errcode = '42501';
  end if;

  if v_cita.estado = 'reagendada'
     or exists (select 1 from public.cita c2 where c2.reagendada_de = p_cita_id) then
    raise exception 'Esta cita ya fue reagendada anteriormente' using errcode = '23505';
  end if;

  if v_cita.estado not in ('agendada', 'confirmada') then
    raise exception 'Solo se pueden reagendar citas agendadas o confirmadas (estado actual: %)', v_cita.estado
      using errcode = '23514';
  end if;

  update public.cita c
  set estado = 'reagendada',
      motivo_cancelacion = coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), c.motivo_cancelacion)
  where c.id = p_cita_id;

  insert into public.cita (
    persona_id,
    area_id,
    programada_en,
    estado,
    prioridad,
    recomendada_por,
    origen,
    reagendada_de,
    creado_por
  ) values (
    v_cita.persona_id,
    v_cita.area_id,
    p_nueva_fecha,
    'agendada',
    coalesce(p_prioridad, v_cita.prioridad),
    v_cita.recomendada_por,
    v_cita.origen,
    p_cita_id,
    v_actor_id
  )
  returning id into v_nueva_id;

  return query select p_cita_id, v_nueva_id, p_nueva_fecha, 'agendada'::public.estado_cita;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. get_lista_urgencias -> tiene_permiso('urgencias.ver')
-- ---------------------------------------------------------------------
create or replace function public.get_lista_urgencias(
  p_area_id smallint default null
)
returns table (
  persona_id             uuid,
  ficha_id               uuid,
  folio                  text,
  nombre_completo        text,
  celular                text,
  area_ultima_prioridad  text,
  fecha_ultima_prioridad date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('urgencias.ver') then
    raise exception 'Sin permiso para consultar la lista de urgencias' using errcode = '42501';
  end if;

  return query
  with ultima_prioridad as (
    select distinct on (at.ficha_id)
      at.ficha_id,
      at.prioridad,
      at.area_id,
      ca.clave as area_clave,
      (at.atendida_en at time zone 'America/Mazatlan')::date as fecha_atencion
    from public.atencion at
    join public.cat_area ca on ca.id = at.area_id
    where at.activo
      and at.prioridad is not null
    order by at.ficha_id, at.atendida_en desc, at.creado_en desc
  )
  select
    p.id as persona_id,
    f.id as ficha_id,
    f.folio,
    concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
    p.celular,
    u.area_clave as area_ultima_prioridad,
    u.fecha_atencion as fecha_ultima_prioridad
  from public.ficha_registro f
  join public.persona p on p.id = f.persona_id
  join ultima_prioridad u on u.ficha_id = f.id
  where f.activo
    and p.activo
    and f.estado in ('abierto', 'en_seguimiento')
    and u.prioridad = 'alta'
    and (p_area_id is null or u.area_id = p_area_id)
    and not exists (
      select 1
      from public.cita c
      where c.persona_id = f.persona_id
        and c.activo
        and c.estado in ('agendada', 'confirmada')
        and c.programada_en > now()
    )
  order by u.fecha_atencion asc, f.creado_en asc;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. get_cola_alertas -> tiene_permiso('alerta.ver_cola')
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
begin
  if not public.tiene_permiso('alerta.ver_cola') then
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

-- ---------------------------------------------------------------------
-- 6. tomar_alerta -> tiene_permiso('alerta.atender')
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
  v_alerta      record;
  v_tomada_en   timestamptz;
  v_atendida_en timestamptz;
begin
  if not public.tiene_permiso('alerta.atender') then
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

-- ---------------------------------------------------------------------
-- 7. atender_alerta -> tiene_permiso('alerta.atender')
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
  v_alerta       record;
  v_tomada_en    timestamptz;
  v_atendida_en  timestamptz;
  v_atendida_por uuid;
begin
  if not public.tiene_permiso('alerta.atender') then
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

-- ---------------------------------------------------------------------
-- 8. get_linea_tiempo() (2.ª parte): folio_seguimiento + archivo/reapertura
--    y compatibilidad con canalizacion_evento (34) + archivar/reabrir (38)
-- ---------------------------------------------------------------------
do $outer$
declare
  v_tiene_canalizacion boolean := to_regclass('public.canalizacion_evento') is not null;
  v_tiene_archivo_cols boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ficha_registro'
      and column_name = 'reabierta_en'
  );
  v_sql text;
begin
  v_sql := $fn$
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
    as $body$
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
  $fn$;

  if v_tiene_archivo_cols then
    v_sql := v_sql || $fn$
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
    $fn$;
  else
    v_sql := v_sql || $fn$
        union all

        select fr.actualizado_en                                          as fecha,
               'archivo'::text                                            as tipo,
               null::text                                                 as area,
               ('Archivo de expediente ' || fr.folio)::text               as titulo,
               null::text                                                 as detalle,
               fr.id                                                      as referencia_id
        from public.ficha_registro fr
        where fr.id = p_ficha_id
          and fr.activo
          and fr.estado = 'archivado'
    $fn$;
  end if;

  v_sql := v_sql || $fn$
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
               ('Atención ' || ca.nombre || ' · ' || cta.nombre || ' (' || a.folio_seguimiento || ')')::text as titulo,
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
  $fn$;

  if v_tiene_canalizacion then
    v_sql := v_sql || $fn$
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
    $fn$;
  end if;

  v_sql := v_sql || $fn$
        union all

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
    $body$;
  $fn$;

  execute v_sql;
end;
$outer$;

revoke execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) from public, anon;
grant  execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) to authenticated;

revoke execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) from public, anon;
grant  execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) to authenticated;

revoke execute on function public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel) from public, anon;
grant  execute on function public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel) to authenticated;

revoke execute on function public.get_lista_urgencias(smallint) from public, anon;
grant  execute on function public.get_lista_urgencias(smallint) to authenticated;

revoke execute on function public.get_cola_alertas(public.estado_alerta[], int) from public, anon;
grant  execute on function public.get_cola_alertas(public.estado_alerta[], int) to authenticated;

revoke execute on function public.tomar_alerta(uuid) from public, anon;
grant  execute on function public.tomar_alerta(uuid) to authenticated;

revoke execute on function public.atender_alerta(uuid, text) from public, anon;
grant  execute on function public.atender_alerta(uuid, text) to authenticated;

revoke execute on function public.get_linea_tiempo(uuid) from public, anon;
grant  execute on function public.get_linea_tiempo(uuid) to authenticated;
