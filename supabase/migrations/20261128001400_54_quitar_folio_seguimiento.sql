-- =====================================================================
-- 54_quitar_folio_seguimiento.sql (Tarjeta #118)
-- Elimina atencion.folio_seguimiento, su índice/constraint, secuencia y
-- funciones generadoras; actualiza registrar_seguimiento, corregir_seguimiento,
-- get_contexto_seguimiento y get_linea_tiempo para no devolver ni usar
-- folio_seguimiento.
-- =====================================================================

-- 1) Eliminar trigger, función generadora, constraint/índice, columna y secuencia
drop trigger if exists atencion_folio_seguimiento_auto on public.atencion;
drop function if exists public.asignar_folio_seguimiento();

alter table public.atencion
  drop constraint if exists atencion_folio_seguimiento_key;

alter table public.atencion
  drop column if exists folio_seguimiento;

drop function if exists public.generar_folio_seguimiento();
drop sequence if exists public.seguimiento_folio_seq;

-- 2) Actualizar registrar_seguimiento() sin folio_seguimiento
drop function if exists public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz);

create or replace function public.registrar_seguimiento(
  p_ficha_id            uuid,
  p_cita_id             uuid default null,
  p_tipo_atencion_id    smallint default null,
  p_acciones_realizadas text default null,
  p_proxima_accion      text default null,
  p_prioridad           public.prioridad_nivel default null,
  p_observaciones       text default null,
  p_proxima_cita_en     timestamptz default null
)
returns table (
  atencion_id             uuid,
  cita_proxima_id         uuid,
  es_primera_vez_area     boolean,
  tiene_historial_clinico boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id              uuid := auth.uid();
  v_area_id               smallint;
  v_ficha                 record;
  v_cita                  record;
  v_es_primera_vez        boolean;
  v_tiene_historial       boolean;
  v_atencion_id           uuid;
  v_cita_proxima_id       uuid;
  v_hoy_mazatlan          date := (now() at time zone 'America/Mazatlan')::date;
begin
  if not public.tiene_permiso('seguimiento.registrar') then
    raise exception 'Sin permiso para registrar seguimiento' using errcode = '42501';
  end if;

  v_area_id := public.auth_area_id();
  if v_area_id is null then
    raise exception 'El actor no tiene área asignada' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  select f.id, f.persona_id, f.estado
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if p_tipo_atencion_id is null or not exists (
    select 1
    from public.cat_tipo_atencion ta
    where ta.id = p_tipo_atencion_id
      and ta.area_id = v_area_id
  ) then
    raise exception 'El tipo de atención no corresponde al área del actor' using errcode = '23514';
  end if;

  if p_cita_id is null then
    raise exception 'La cita del día (p_cita_id) es obligatoria para registrar el seguimiento'
      using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, c.estado, c.programada_en
  into v_cita
  from public.cita c
  where c.id = p_cita_id
    and c.activo
  for update;

  if not found then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.atencion a
    where a.cita_id = p_cita_id
  ) then
    raise exception 'Esta cita ya cuenta con una hoja de seguimiento registrada' using errcode = '23505';
  end if;

  if v_cita.persona_id <> v_ficha.persona_id then
    raise exception 'La cita no pertenece a la persona de este expediente' using errcode = '23514';
  end if;

  if v_cita.area_id <> v_area_id then
    raise exception 'La cita no pertenece al área del actor' using errcode = '23514';
  end if;

  if v_cita.estado not in ('agendada', 'confirmada') then
    raise exception 'Solo se puede registrar seguimiento sobre citas agendadas o confirmadas' using errcode = '23514';
  end if;

  if (v_cita.programada_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
    raise exception 'Solo se puede registrar seguimiento sobre una cita programada para el día de hoy'
      using errcode = '23514';
  end if;

  if p_proxima_cita_en is not null and p_proxima_cita_en <= now() then
    raise exception 'La fecha de la próxima cita debe ser futura' using errcode = '23514';
  end if;

  -- Evaluar antes de insertar la nueva atención (RN-19)
  v_es_primera_vez := not exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.area_id = v_area_id
      and a.activo
  );

  update public.cita c
  set estado = 'asistio'
  where c.id = p_cita_id;

  insert into public.atencion (
    ficha_id,
    cita_id,
    area_id,
    tipo_atencion_id,
    atendida_por,
    acciones_realizadas,
    proxima_accion,
    prioridad,
    observaciones,
    creado_por
  ) values (
    v_ficha.id,
    p_cita_id,
    v_area_id,
    p_tipo_atencion_id,
    v_actor_id,
    nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    p_prioridad,
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_actor_id
  )
  returning id into v_atencion_id;

  if v_ficha.estado = 'abierto' then
    update public.ficha_registro f
    set estado = 'en_seguimiento'
    where f.id = v_ficha.id;
  end if;

  if p_proxima_cita_en is not null then
    insert into public.cita (
      persona_id,
      area_id,
      programada_en,
      estado,
      origen,
      creado_por
    ) values (
      v_ficha.persona_id,
      v_area_id,
      p_proxima_cita_en,
      'agendada',
      'regular',
      v_actor_id
    )
    returning id into v_cita_proxima_id;
  end if;

  v_tiene_historial := exists (
    select 1
    from public.historial_clinico hc
    where hc.ficha_id = v_ficha.id
      and hc.activo
  );

  return query select v_atencion_id, v_cita_proxima_id, v_es_primera_vez, v_tiene_historial;
end;
$$;

revoke execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) from public, anon;
grant  execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) to authenticated;

-- 3) Actualizar corregir_seguimiento() sin folio_seguimiento
drop function if exists public.corregir_seguimiento(uuid, timestamptz, smallint, text, text, public.prioridad_nivel, text);

create or replace function public.corregir_seguimiento(
  p_atencion_id         uuid,
  p_actualizado_en      timestamptz,
  p_tipo_atencion_id    smallint default null,
  p_acciones_realizadas text default null,
  p_proxima_accion      text default null,
  p_prioridad           public.prioridad_nivel default null,
  p_observaciones       text default null
)
returns table (
  atencion_id    uuid,
  actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_es_dir         boolean := public.es_direccion();
  v_hoy_mazatlan   date := (now() at time zone 'America/Mazatlan')::date;
  v_atencion       record;
  v_nuevo_act_en   timestamptz;
begin
  if not (public.tiene_permiso('seguimiento.corregir') or v_es_dir or public.es_area_atencion()) then
    raise exception 'Sin permiso para corregir seguimiento' using errcode = '42501';
  end if;

  if p_atencion_id is null then
    raise exception 'El identificador de la atención es obligatorio' using errcode = '23514';
  end if;

  if p_actualizado_en is null then
    raise exception 'La marca de tiempo p_actualizado_en es obligatoria' using errcode = '23514';
  end if;

  select a.id, a.area_id, a.tipo_atencion_id, a.atendida_por, a.atendida_en, a.creado_por, a.actualizado_en
  into v_atencion
  from public.atencion a
  where a.id = p_atencion_id
    and a.activo
  for update;

  if not found then
    raise exception 'Atención no encontrada o inactiva' using errcode = '23514';
  end if;

  if not v_es_dir then
    if coalesce(v_atencion.atendida_por, v_atencion.creado_por) <> v_actor_id then
      raise exception 'Solo quien creó el seguimiento puede corregirlo' using errcode = '42501';
    end if;

    if (v_atencion.atendida_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
      raise exception 'Solo se puede corregir el seguimiento el mismo día de su registro' using errcode = '42501';
    end if;
  end if;

  if date_trunc('milliseconds', v_atencion.actualizado_en) <> date_trunc('milliseconds', p_actualizado_en) then
    raise exception 'El seguimiento fue modificado por otra persona. Recarga antes de guardar.'
      using errcode = '40001';
  end if;

  if p_tipo_atencion_id is not null and not exists (
    select 1
    from public.cat_tipo_atencion ta
    where ta.id = p_tipo_atencion_id
      and ta.area_id = v_atencion.area_id
  ) then
    raise exception 'El tipo de atención no corresponde al área del seguimiento' using errcode = '23514';
  end if;

  update public.atencion a
  set
    tipo_atencion_id    = coalesce(p_tipo_atencion_id, a.tipo_atencion_id),
    acciones_realizadas = nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    proxima_accion      = nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    prioridad           = p_prioridad,
    observaciones       = nullif(btrim(coalesce(p_observaciones, '')), '')
  where a.id = v_atencion.id
  returning a.actualizado_en into v_nuevo_act_en;

  return query select v_atencion.id, v_nuevo_act_en;
end;
$$;

revoke execute on function public.corregir_seguimiento(uuid, timestamptz, smallint, text, text, public.prioridad_nivel, text) from public, anon;
grant  execute on function public.corregir_seguimiento(uuid, timestamptz, smallint, text, text, public.prioridad_nivel, text) to authenticated;

-- 4) Actualizar get_contexto_seguimiento() sin ultimo_folio_seguimiento
drop function if exists public.get_contexto_seguimiento(uuid);

create or replace function public.get_contexto_seguimiento(
  p_cita_id uuid
)
returns table (
  ficha_id                 uuid,
  folio_expediente         text,
  nombre_persona           text,
  edad                     integer,
  es_primera_vez_area      boolean,
  ultima_proxima_accion    text,
  tiene_orden_vigente      boolean,
  tiene_historial_clinico  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_area_id        smallint;
  v_area_clave     text;
  v_hoy_mazatlan   date := (now() at time zone 'America/Mazatlan')::date;
  v_cita           record;
  v_ficha          record;
  v_persona        record;
  v_ultima_accion  text;
  v_es_primera     boolean;
  v_orden_vigente  boolean;
  v_hist_clinico   boolean := null;
  v_edad           integer := null;
begin
  if not public.tiene_permiso('seguimiento.registrar') then
    raise exception 'Sin permiso para consultar contexto de seguimiento' using errcode = '42501';
  end if;

  v_area_id := public.auth_area_id();
  if v_area_id is null then
    raise exception 'El actor no tiene área asignada' using errcode = '42501';
  end if;

  select ca.clave
  into v_area_clave
  from public.cat_area ca
  where ca.id = v_area_id;

  if p_cita_id is null then
    raise exception 'El identificador de la cita es obligatorio' using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, c.programada_en, c.activo
  into v_cita
  from public.cita c
  where c.id = p_cita_id
    and c.activo;

  if not found then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_cita.area_id <> v_area_id then
    raise exception 'La cita no pertenece al área del actor' using errcode = '23514';
  end if;

  if (v_cita.programada_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
    raise exception 'Solo se puede consultar contexto de citas programadas para el día de hoy'
      using errcode = '23514';
  end if;

  select f.id, f.folio
  into v_ficha
  from public.ficha_registro f
  where f.persona_id = v_cita.persona_id
    and f.activo
  order by f.creado_en desc, f.id desc
  limit 1;

  if not found then
    raise exception 'La persona no cuenta con expediente activo' using errcode = '23514';
  end if;

  select p.id, p.nombres, p.apellido_paterno, p.apellido_materno, p.fecha_nacimiento
  into v_persona
  from public.persona p
  where p.id = v_cita.persona_id
    and p.activo;

  if not found then
    raise exception 'Persona no encontrada o inactiva' using errcode = '23514';
  end if;

  -- Bitácora obligatoria de acceso ('ver')
  insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
  values (v_actor_id, 'ver', 'ficha_registro', v_ficha.id::text);

  if v_persona.fecha_nacimiento is not null then
    v_edad := extract(year from age(v_hoy_mazatlan, v_persona.fecha_nacimiento))::int;
  end if;

  v_es_primera := not exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.area_id = v_area_id
      and a.activo
  );

  select a.proxima_accion
  into v_ultima_accion
  from public.atencion a
  where a.ficha_id = v_ficha.id
    and a.area_id = v_area_id
    and a.activo
  order by a.creado_en desc, a.id desc
  limit 1;

  v_orden_vigente := public.tiene_orden_vigente(v_persona.id);

  if v_area_clave = 'psicologia' then
    v_hist_clinico := exists (
      select 1
      from public.historial_clinico hc
      where hc.ficha_id = v_ficha.id
        and hc.activo
    );
  end if;

  return query
  select
    v_ficha.id,
    v_ficha.folio,
    btrim(concat_ws(' ', v_persona.nombres, v_persona.apellido_paterno, v_persona.apellido_materno)),
    v_edad,
    v_es_primera,
    v_ultima_accion,
    v_orden_vigente,
    v_hist_clinico;
end;
$$;

revoke execute on function public.get_contexto_seguimiento(uuid) from public, anon;
grant  execute on function public.get_contexto_seguimiento(uuid) to authenticated;

-- 5) Actualizar get_linea_tiempo() sin folio_seguimiento (compatible con develop)
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
end
$outer$;

revoke execute on function public.get_linea_tiempo(uuid) from public, anon;
grant  execute on function public.get_linea_tiempo(uuid) to authenticated;
