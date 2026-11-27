-- =====================================================================
-- 60_integrar_develop_y_supabase.sql
-- Integra las líneas develop (Angel) y supabase (Iván). Las dos ramas
-- redefinieron las mismas funciones y en Postgres gana la última que corre,
-- así que esta migración va al final y deja la versión combinada de cada una:
--
--   * get_agenda, cambiar_estado_cita, reagendar_cita, registrar_seguimiento:
--     base de Iván (47 tiene_permiso, 50 sin cita.prioridad, 54 sin folio de
--     seguimiento y con cita del día) + regla de agenda de develop (40/42):
--     Recepción ve y gestiona TS, Psicología y Jurídico; crear, reagendar y
--     la próxima cita usan agenda.crear + puede_crear_cita_en_area().
--   * crear_cita (51): misma regla de creación de develop (42). La política
--     cita_insert queda cerrada como en la 51 (solo por RPC).
--   * get_expediente_detalle: base 58 (consumo como lista) + edad (48) +
--     prioridad del expediente (50).
--   * crear_ficha_completa: base 59 (casillas sin dato) + prioridad (50).
--
-- Regla de agenda vigente (develop 42, pendiente de confirmar con Iván):
--   recepcion -> TS, Psicología, Jurídico · juridico/psicologia -> su área
--   titular/subdireccion -> todas · trabajo_social -> ninguna
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. get_agenda: versión de la 50 (sin cita.prioridad) + alcance de la 40
--    (Recepción ve TS, Psicología y Jurídico)
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
      or (v_rol = 'recepcion' and a.clave in ('trabajo_social', 'psicologia', 'juridico'))
      or (v_rol = 'trabajo_social' and a.clave in ('trabajo_social', 'psicologia'))
      or (v_rol in ('psicologia', 'juridico') and c.area_id = v_area_id)
    )
  order by c.programada_en asc
  limit p_limite;
end;
$$;

revoke execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) from public, anon;
grant  execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) to authenticated;

-- ---------------------------------------------------------------------
-- 2. cambiar_estado_cita: versión de la 47 (tiene_permiso) + Recepción
--    gestiona Jurídico y solo roles de agenda (40)
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

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para gestionar citas' using errcode = '42501';
  end if;

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

  if v_rol = 'recepcion' and v_cita.area_clave not in ('trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Recepción solo puede gestionar citas de Trabajo Social, Psicología o Jurídico'
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

revoke execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) from public, anon;
grant  execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. reagendar_cita: versión de la 50 (3 parámetros, sin prioridad) +
--    regla de creación de la 42 (agenda.crear + puede_crear_cita_en_area)
-- ---------------------------------------------------------------------
create or replace function public.reagendar_cita(
  p_cita_id     uuid,
  p_nueva_fecha timestamptz,
  p_motivo      text default null
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
  -- Reagendar crea una cita nueva: misma regla que crear (agenda.crear).
  if not public.tiene_permiso('agenda.crear') then
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
         c.estado, c.recomendada_por, c.origen
  into v_cita
  from public.cita c
  join public.cat_area a on a.id = c.area_id
  where c.id = p_cita_id
    and c.activo
  for update;

  if v_cita.id is null then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if not public.puede_crear_cita_en_area(v_cita.area_id) then
    raise exception 'Sin permiso para reagendar citas de esta área' using errcode = '42501';
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
    recomendada_por,
    origen,
    reagendada_de,
    creado_por
  ) values (
    v_cita.persona_id,
    v_cita.area_id,
    p_nueva_fecha,
    'agendada',
    v_cita.recomendada_por,
    v_cita.origen,
    p_cita_id,
    v_actor_id
  )
  returning id into v_nueva_id;

  return query select p_cita_id, v_nueva_id, p_nueva_fecha, 'agendada'::public.estado_cita;
end;
$$;

revoke execute on function public.reagendar_cita(uuid, timestamptz, text) from public, anon;
grant  execute on function public.reagendar_cita(uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. registrar_seguimiento: versión de la 54 (cita del día, sin folio) +
--    la próxima cita sigue la regla de creación (40/42)
-- ---------------------------------------------------------------------
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

  -- Agendar la próxima cita es crear una cita: misma regla que crear_cita.
  if p_proxima_cita_en is not null and not public.puede_crear_cita_en_area(v_area_id) then
    raise exception 'Sin permiso para agendar la próxima cita; solicítela a Recepción'
      using errcode = '42501';
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

-- ---------------------------------------------------------------------
-- 5. crear_cita: versión de la 51 con la regla de creación de la 42.
--    La política cita_insert sigue cerrada (51): solo se crea por RPC.
-- ---------------------------------------------------------------------
create or replace function public.crear_cita(
  p_persona_id      uuid,
  p_area_id         smallint,
  p_programada_en   timestamptz,
  p_recomendada_por text default null,
  p_origen          public.origen_cita default 'regular'
)
returns table (
  cita_id       uuid,
  persona_id    uuid,
  area_id       smallint,
  programada_en timestamptz,
  estado        public.estado_cita,
  origen        public.origen_cita
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id        uuid := auth.uid();
  v_rol             public.rol_empleado;
  v_actor_area_id   smallint;
  v_area_clave      text;
  v_persona_activa  boolean;
  v_ficha_estado    public.estado_ficha;
  v_origen          public.origen_cita := coalesce(p_origen, 'regular');
  v_recomendada_por text := nullif(btrim(coalesce(p_recomendada_por, '')), '');
  v_cita_id         uuid;
begin
  if not public.tiene_permiso('agenda.crear') then
    raise exception 'Sin permiso para agendar citas' using errcode = '42501';
  end if;

  if p_persona_id is null or p_area_id is null or p_programada_en is null then
    raise exception 'Persona, área y fecha/hora son obligatorias para crear una cita'
      using errcode = '23514';
  end if;

  if v_recomendada_por is not null and char_length(v_recomendada_por) > 200 then
    raise exception 'El campo recomendada_por no puede exceder 200 caracteres'
      using errcode = '23514';
  end if;

  select ca.clave
  into v_area_clave
  from public.cat_area ca
  where ca.id = p_area_id;

  if not found then
    raise exception 'El área especificada no existe o está inactiva' using errcode = '23514';
  end if;

  v_rol := public.auth_rol();
  v_actor_area_id := public.auth_area_id();

  -- Alcance por rol/área: misma regla que reagendar y la próxima cita
  -- (puede_crear_cita_en_area: Recepción TS/Psic/Jur, Jurídico y Psicología
  -- su área, Dirección todas, TS ninguna).
  if not public.puede_crear_cita_en_area(p_area_id) then
    if v_rol = 'recepcion' then
      raise exception 'Recepción solo puede agendar citas de Trabajo Social, Psicología o Jurídico'
        using errcode = '42501';
    end if;
    raise exception 'Sin permiso para agendar citas en esta área' using errcode = '42501';
  end if;

  if p_programada_en <= now() then
    raise exception 'La fecha y hora de la cita deben ser futuras' using errcode = '23514';
  end if;

  select p.activo
  into v_persona_activa
  from public.persona p
  where p.id = p_persona_id;

  if not coalesce(v_persona_activa, false) then
    raise exception 'Persona no encontrada o inactiva' using errcode = '23514';
  end if;

  -- Si la persona tiene expediente activo, rechazar si está archivado
  select f.estado
  into v_ficha_estado
  from public.ficha_registro f
  where f.persona_id = p_persona_id
    and f.activo
  order by f.creado_en desc, f.id desc
  limit 1;

  if v_ficha_estado = 'archivado' then
    raise exception 'No se puede agendar una cita para un expediente archivado'
      using errcode = '23514';
  end if;

  -- Evitar cita duplicada en la misma área y hora
  if exists (
    select 1
    from public.cita c
    where c.persona_id = p_persona_id
      and c.area_id = p_area_id
      and c.programada_en = p_programada_en
      and c.activo
      and c.estado in ('agendada', 'confirmada')
  ) then
    raise exception 'Ya existe una cita activa para esta persona en esa área y horario'
      using errcode = '23514';
  end if;

  insert into public.cita (
    persona_id,
    area_id,
    programada_en,
    estado,
    recomendada_por,
    origen,
    creado_por
  ) values (
    p_persona_id,
    p_area_id,
    p_programada_en,
    'agendada',
    v_recomendada_por,
    v_origen,
    v_actor_id
  )
  returning id into v_cita_id;

  return query
  select v_cita_id, p_persona_id, p_area_id, p_programada_en, 'agendada'::public.estado_cita, v_origen;
end;
$$;

revoke execute on function public.crear_cita(uuid, smallint, timestamptz, text, public.origen_cita) from public, anon;
grant  execute on function public.crear_cita(uuid, smallint, timestamptz, text, public.origen_cita) to authenticated;

-- ---------------------------------------------------------------------
-- 6. get_expediente_detalle: versión de la 58 (consumo como lista) +
--    edad (48) + prioridad del expediente (50)
-- ---------------------------------------------------------------------
create or replace function public.get_expediente_detalle(
  p_ficha_id          uuid,
  p_incluir_agresores boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_incluir_agr    boolean := coalesce(p_incluir_agresores, false);
  v_es_dir         boolean;
  v_rol            public.rol_empleado;
  v_area_id        smallint;
  v_ficha          record;
  v_persona        record;
  v_servicios      jsonb;
  v_domicilio      jsonb;
  v_estudio        jsonb;
  v_orden_vigente  boolean;
  v_citas_hoy      jsonb;
  v_agresores      jsonb;
  v_result         jsonb;
begin
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para consultar el detalle del expediente' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  select f.*,
         co.nombre as ocupacion_nombre
  into v_ficha
  from public.ficha_registro f
  left join public.cat_ocupacion co on co.id = f.ocupacion_id
  where f.id = p_ficha_id
    and f.activo;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  select p.*
  into v_persona
  from public.persona p
  where p.id = v_ficha.persona_id
    and p.activo;

  if not found then
    raise exception 'Persona asociada al expediente no encontrada o inactiva' using errcode = '23514';
  end if;

  -- Bitácora obligatoria de lectura (RF-22)
  insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
  values (v_actor_id, 'ver', 'ficha_registro', v_ficha.id::text);

  if v_incluir_agr then
    insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
    values (v_actor_id, 'ver', 'agresor', v_ficha.id::text);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'area_id', ca.id,
        'clave',   ca.clave,
        'nombre',  ca.nombre
      )
      order by ca.nombre
    ),
    '[]'::jsonb
  )
  into v_servicios
  from public.ficha_servicio_solicitado fss
  join public.cat_area ca on ca.id = fss.area_id
  where fss.ficha_id = v_ficha.id;

  select jsonb_build_object(
    'id',                  d.id,
    'asentamiento_id',     d.asentamiento_id,
    'asentamiento_nombre', cs.nombre,
    'codigo_postal',       coalesce(cs.codigo_postal, d.codigo_postal),
    'calle',               d.calle,
    'numero_exterior',     d.numero_exterior,
    'numero_interior',     d.numero_interior,
    'referencias',         d.referencias,
    'zona',                d.zona
  )
  into v_domicilio
  from public.domicilio d
  left join public.cat_asentamiento cs on cs.id = d.asentamiento_id
  where d.persona_id = v_persona.id
    and d.activo
    and d.es_actual
  limit 1;

  select jsonb_build_object(
    'id',                     es.id,
    'fecha_estudio',          es.fecha_estudio,
    'ingreso_mensual_propio', es.ingreso_mensual_propio,
    'numero_dependientes',    es.numero_dependientes,
    'tiene_apoyo',            es.tiene_apoyo,
    'especificacion_apoyo',   es.especificacion_apoyo,
    'tipo_vivienda',          es.tipo_vivienda,
    'material',               es.material,
    'material_otro',          es.material_otro,
    'servicios',              es.servicios,
    'bienes',                 es.bienes,
    'aportantes',             coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',                ah.id,
            'nombre',            ah.nombre,
            'parentesco_id',     ah.parentesco_id,
            'parentesco_nombre', cp.nombre,
            'parentesco_otro',   ah.parentesco_otro,
            'ocupacion_id',      ah.ocupacion_id,
            'ocupacion_nombre',  co2.nombre,
            'ocupacion_otra',    ah.ocupacion_otra,
            'tipo_trabajo',      ah.tipo_trabajo,
            'monto',             ah.monto,
            'frecuencia',        ah.frecuencia
          )
          order by ah.creado_en
        )
        from public.aportante_hogar ah
        left join public.cat_parentesco cp  on cp.id  = ah.parentesco_id
        left join public.cat_ocupacion  co2 on co2.id = ah.ocupacion_id
        where ah.estudio_socioeconomico_id = es.id
          and ah.activo
      ),
      '[]'::jsonb
    )
  )
  into v_estudio
  from public.estudio_socioeconomico es
  where es.ficha_id = v_ficha.id
    and es.activo
    and es.es_actual
  limit 1;

  select exists (
    select 1
    from public.orden_proteccion op
    where op.ficha_id = v_ficha.id
      and op.activo
      and op.estado = 'vigente'
      and (op.fecha_vigencia is null or op.fecha_vigencia >= current_date)
  )
  into v_orden_vigente;

  v_es_dir  := public.es_direccion();
  v_rol     := public.auth_rol();
  v_area_id := public.auth_area_id();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cita_id',       c.id,
        'programada_en', c.programada_en,
        'estado',        c.estado,
        'area_clave',    ca.clave
      )
      order by c.programada_en
    ),
    '[]'::jsonb
  )
  into v_citas_hoy
  from public.cita c
  join public.cat_area ca on ca.id = c.area_id
  where c.persona_id = v_persona.id
    and c.activo
    and (c.programada_en at time zone 'America/Mazatlan')::date = (now() at time zone 'America/Mazatlan')::date
    and (
      v_es_dir
      or (v_rol = 'trabajo_social' and ca.clave in ('trabajo_social', 'psicologia'))
      or (v_rol in ('psicologia', 'juridico') and c.area_id = v_area_id)
    );

  v_result := jsonb_build_object(
    'ficha', jsonb_build_object(
      'id',                           v_ficha.id,
      'folio',                        v_ficha.folio,
      'estado',                       v_ficha.estado,
      'prioridad',                    v_ficha.prioridad,
      'prioridad_actualizada_en',     v_ficha.prioridad_actualizada_en,
      'registrada_en',                v_ficha.registrada_en,
      'aviso_privacidad_aceptado_en', v_ficha.aviso_privacidad_aceptado_en,
      'estado_civil',                 v_ficha.estado_civil,
      'ocupacion_id',                 v_ficha.ocupacion_id,
      'ocupacion_nombre',             v_ficha.ocupacion_nombre,
      'ocupacion_otra',               v_ficha.ocupacion_otra,
      'tiene_trabajo',                v_ficha.tiene_trabajo,
      'servicio_medico',              v_ficha.servicio_medico,
      'servicio_medico_otro',         v_ficha.servicio_medico_otro,
      'numero_hijas',                 v_ficha.numero_hijas,
      'numero_hijos_hombres',         v_ficha.numero_hijos_hombres,
      'tiene_embarazo',               v_ficha.tiene_embarazo,
      'tiene_denuncia',               v_ficha.tiene_denuncia,
      'es_victima_delito',            v_ficha.es_victima_delito,
      'drogas',                       v_ficha.drogas,
      'especificacion_droga',         v_ficha.especificacion_droga,
      'consumo_alcohol',              v_ficha.consumo_alcohol
    ),
    'persona', jsonb_build_object(
      'id',                 v_persona.id,
      'curp',               v_persona.curp,
      'nombres',            v_persona.nombres,
      'apellido_paterno',   v_persona.apellido_paterno,
      'apellido_materno',   v_persona.apellido_materno,
      'sexo',               v_persona.sexo,
      'fecha_nacimiento',   v_persona.fecha_nacimiento,
      'edad',               public.calcular_edad(v_persona.fecha_nacimiento),
      'entidad_nacimiento', v_persona.entidad_nacimiento,
      'celular',            v_persona.celular,
      'escolaridad',        v_persona.escolaridad,
      'discapacidad',       v_persona.discapacidad,
      'religion',           v_persona.religion,
      'grupo_etnico',       v_persona.grupo_etnico
    ),
    'servicios_solicitados', v_servicios,
    'domicilio_actual',      v_domicilio,
    'estudio_actual',        v_estudio,
    'orden_vigente',         v_orden_vigente,
    'citas_hoy',             v_citas_hoy
  );

  if v_incluir_agr then
    select coalesce(
      jsonb_agg(
        (to_jsonb(ag) || jsonb_build_object('edad', public.calcular_edad(ag.fecha_nacimiento)))
        order by ag.creado_en
      ),
      '[]'::jsonb
    )
    into v_agresores
    from public.agresor ag
    where ag.ficha_id = v_ficha.id
      and ag.activo;

    v_result := v_result || jsonb_build_object('agresores', v_agresores);
  end if;

  return v_result;
end;
$$;

revoke execute on function public.get_expediente_detalle(uuid, boolean) from public, anon;
grant  execute on function public.get_expediente_detalle(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 7. crear_ficha_completa: versión de la 59 (casillas sin dato) +
--    prioridad opcional del expediente (50)
-- ---------------------------------------------------------------------
create or replace function public.crear_ficha_completa(p_payload jsonb)
returns table (
  ficha_id   uuid,
  folio      text,
  persona_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_identidad            jsonb := coalesce(p_payload -> 'identidad', '{}'::jsonb);
  v_domicilio            jsonb := coalesce(p_payload -> 'domicilio', '{}'::jsonb);
  v_estudio              jsonb := coalesce(p_payload -> 'estudio', '{}'::jsonb);
  v_curp                 text;
  v_persona_id           uuid;
  v_ficha_existente      record;
  v_reutilizar_ficha     boolean := false;
  v_ficha_id             uuid;
  v_folio                text;
  v_estudio_id           uuid;
  v_asentamiento         integer;
  v_cp_foraneo           text;
  v_aviso_ts             timestamptz;
  v_prioridad            public.prioridad_nivel;
  v_prioridad_ts         timestamptz;
  v_tiene_trabajo        boolean;
  v_numero_hijas         smallint;
  v_numero_hijos_hombres smallint;
  v_tiene_embarazo       boolean;
  v_tiene_denuncia       boolean;
  v_es_victima_delito    boolean;
  v_drogas               public.tipo_droga[];
  v_especificacion_droga text;
  v_consumo_alcohol      public.consumo_alcohol;
  v_servicios            public.servicio_vivienda[];
  v_bienes               public.bien_vivienda[];
  v_aportante            jsonb;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para crear expedientes' using errcode = '42501';
  end if;

  if not coalesce((v_identidad ->> 'avisoPrivacidadAceptado')::boolean, false) then
    raise exception 'Es obligatorio aceptar el Aviso de Privacidad (RNF-04)' using errcode = '23514';
  end if;

  v_curp := upper(btrim(coalesce(v_identidad ->> 'curp', '')));
  v_aviso_ts := now();
  v_prioridad := nullif(btrim(coalesce(v_identidad ->> 'prioridad', '')), '')::public.prioridad_nivel;
  v_prioridad_ts := case when v_prioridad is not null then v_aviso_ts else null end;

  -- Casillas e hijos opcionales: sin dato = NULL (no false ni 0)
  v_tiene_trabajo        := nullif(btrim(coalesce(v_identidad ->> 'tieneTrabajo', '')), '')::boolean;
  v_numero_hijas         := nullif(btrim(coalesce(v_identidad ->> 'numeroHijas', '')), '')::smallint;
  v_numero_hijos_hombres := nullif(btrim(coalesce(v_identidad ->> 'numeroHijosHombres', '')), '')::smallint;
  v_tiene_embarazo       := nullif(btrim(coalesce(v_identidad ->> 'tieneEmbarazo', '')), '')::boolean;
  v_tiene_denuncia       := nullif(btrim(coalesce(v_identidad ->> 'tieneDenuncia', '')), '')::boolean;
  v_es_victima_delito    := nullif(btrim(coalesce(v_identidad ->> 'esVictimaDelito', '')), '')::boolean;

  -- Consumo de sustancias (lista con 'no_consume' exclusivo)
  if v_identidad ? 'drogas' and jsonb_typeof(v_identidad -> 'drogas') <> 'null' then
    if jsonb_typeof(v_identidad -> 'drogas') <> 'array' then
      raise exception 'drogas debe ser un arreglo JSON' using errcode = '23514';
    end if;

    select array_agg(d_item order by idx)
    into v_drogas
    from (
      select distinct on (nullif(btrim(elem), ''))
             nullif(btrim(elem), '')::public.tipo_droga as d_item,
             min(ord) as idx
      from jsonb_array_elements_text(v_identidad -> 'drogas') with ordinality as u(elem, ord)
      where nullif(btrim(elem), '') is not null
      group by nullif(btrim(elem), '')
    ) s;

    if coalesce(array_length(v_drogas, 1), 0) = 0 then
      v_drogas := null;
    elsif 'no_consume'::public.tipo_droga = any(v_drogas) and cardinality(v_drogas) > 1 then
      raise exception 'Si seleccionas "no_consume", no puedes seleccionar otras drogas'
        using errcode = '23514';
    end if;
  else
    v_drogas := null;
  end if;

  v_especificacion_droga := nullif(btrim(coalesce(v_identidad ->> 'especificacionDroga', '')), '');
  if v_especificacion_droga is not null and char_length(v_especificacion_droga) > 250 then
    raise exception 'La especificación de droga no debe exceder 250 caracteres'
      using errcode = '23514';
  end if;

  if v_especificacion_droga is not null
     and (v_drogas is null or 'no_consume'::public.tipo_droga = any(v_drogas)) then
    raise exception 'No puedes especificar droga cuando no hay consumo o se seleccionó "no_consume"'
      using errcode = '23514';
  end if;

  v_consumo_alcohol := nullif(btrim(coalesce(v_identidad ->> 'consumoAlcohol', '')), '')::public.consumo_alcohol;

  -- 1) Resolver persona por existingPersonaId o por CURP
  v_persona_id := nullif(btrim(coalesce(v_identidad ->> 'existingPersonaId', '')), '')::uuid;

  if v_persona_id is null then
    select p.id into v_persona_id
    from public.persona p
    where p.curp = v_curp;
  end if;

  if v_persona_id is not null then
    select f.id, f.folio
    into v_ficha_existente
    from public.ficha_registro f
    where f.persona_id = v_persona_id
    limit 1;

    if v_ficha_existente.id is not null then
      -- Si es una ficha trunca sin estudio ni registros hijos, se reutiliza con UPDATE (sin DELETE físico)
      if v_ficha_existente.id not in (
           '10000000-0000-4000-a000-000000000301',
           '10000000-0000-4000-a000-000000000302',
           '10000000-0000-4000-a000-000000000303'
         )
         and not exists (select 1 from public.estudio_socioeconomico es where es.ficha_id = v_ficha_existente.id)
         and not exists (select 1 from public.atencion a where a.ficha_id = v_ficha_existente.id)
         and not exists (select 1 from public.agresor ag where ag.ficha_id = v_ficha_existente.id)
         and not exists (select 1 from public.orden_proteccion op where op.ficha_id = v_ficha_existente.id)
         and not exists (select 1 from public.nota_area na where na.ficha_id = v_ficha_existente.id)
         and not exists (select 1 from public.derivacion d where d.ficha_id = v_ficha_existente.id)
         and not exists (select 1 from public.documento doc where doc.ficha_id = v_ficha_existente.id)
      then
        v_reutilizar_ficha := true;
        v_ficha_id := v_ficha_existente.id;
        v_folio := v_ficha_existente.folio;
      else
        raise exception 'Esta CURP ya cuenta con un expediente registrado (folio %). Consúltalo en Expedientes.',
          v_ficha_existente.folio
          using errcode = '23505';
      end if;
    end if;

    update public.persona p
    set nombres          = btrim(v_identidad ->> 'nombres'),
        apellido_paterno = btrim(v_identidad ->> 'apellidoPaterno'),
        apellido_materno = nullif(btrim(coalesce(v_identidad ->> 'apellidoMaterno', '')), ''),
        celular          = nullif(btrim(coalesce(v_identidad ->> 'celular', '')), ''),
        escolaridad      = nullif(btrim(coalesce(v_identidad ->> 'escolaridad', '')), '')::public.escolaridad_nivel,
        discapacidad     = nullif(btrim(coalesce(v_identidad ->> 'discapacidad', '')), ''),
        grupo_etnico     = nullif(btrim(coalesce(v_identidad ->> 'grupoEtnico', '')), ''),
        religion         = nullif(btrim(coalesce(v_identidad ->> 'religion', '')), ''),
        activo           = true
    where p.id = v_persona_id;
  else
    insert into public.persona (
      curp,
      nombres,
      apellido_paterno,
      apellido_materno,
      celular,
      escolaridad,
      discapacidad,
      grupo_etnico,
      religion,
      creado_por
    ) values (
      v_curp,
      btrim(v_identidad ->> 'nombres'),
      btrim(v_identidad ->> 'apellidoPaterno'),
      nullif(btrim(coalesce(v_identidad ->> 'apellidoMaterno', '')), ''),
      nullif(btrim(coalesce(v_identidad ->> 'celular', '')), ''),
      nullif(btrim(coalesce(v_identidad ->> 'escolaridad', '')), '')::public.escolaridad_nivel,
      nullif(btrim(coalesce(v_identidad ->> 'discapacidad', '')), ''),
      nullif(btrim(coalesce(v_identidad ->> 'grupoEtnico', '')), ''),
      nullif(btrim(coalesce(v_identidad ->> 'religion', '')), ''),
      v_actor_id
    )
    returning id into v_persona_id;
  end if;

  -- 2) Ficha Única: UPDATE si se reutiliza ficha trunca, INSERT si es nueva
  if v_reutilizar_ficha then
    update public.ficha_registro f
    set estado                       = 'abierto',
        aviso_privacidad_aceptado_en = v_aviso_ts,
        prioridad                    = v_prioridad,
        prioridad_actualizada_en     = v_prioridad_ts,
        estado_civil                 = nullif(btrim(coalesce(v_identidad ->> 'estadoCivil', '')), '')::public.estado_civil,
        ocupacion_id                 = nullif(btrim(coalesce(v_identidad ->> 'ocupacionId', '')), '')::smallint,
        ocupacion_otra               = nullif(btrim(coalesce(v_identidad ->> 'ocupacionOtra', '')), ''),
        tiene_trabajo                = v_tiene_trabajo,
        numero_hijas                 = v_numero_hijas,
        numero_hijos_hombres         = v_numero_hijos_hombres,
        servicio_medico              = nullif(btrim(coalesce(v_identidad ->> 'servicioMedico', '')), '')::public.servicio_medico,
        servicio_medico_otro         = case
          when v_identidad ->> 'servicioMedico' = 'otro'
          then nullif(btrim(coalesce(v_identidad ->> 'servicioMedicoOtro', '')), '')
          else null
        end,
        tiene_embarazo               = v_tiene_embarazo,
        tiene_denuncia               = v_tiene_denuncia,
        es_victima_delito            = v_es_victima_delito,
        drogas                       = v_drogas,
        especificacion_droga         = v_especificacion_droga,
        consumo_alcohol              = v_consumo_alcohol,
        activo                       = true
    where f.id = v_ficha_id
    returning f.folio into v_folio;

    delete from public.ficha_servicio_solicitado fss
    where fss.ficha_id = v_ficha_id;
  else
    insert into public.ficha_registro (
      persona_id,
      aviso_privacidad_aceptado_en,
      prioridad,
      prioridad_actualizada_en,
      estado_civil,
      ocupacion_id,
      ocupacion_otra,
      tiene_trabajo,
      numero_hijas,
      numero_hijos_hombres,
      servicio_medico,
      servicio_medico_otro,
      tiene_embarazo,
      tiene_denuncia,
      es_victima_delito,
      drogas,
      especificacion_droga,
      consumo_alcohol,
      creado_por
    ) values (
      v_persona_id,
      v_aviso_ts,
      v_prioridad,
      v_prioridad_ts,
      nullif(btrim(coalesce(v_identidad ->> 'estadoCivil', '')), '')::public.estado_civil,
      nullif(btrim(coalesce(v_identidad ->> 'ocupacionId', '')), '')::smallint,
      nullif(btrim(coalesce(v_identidad ->> 'ocupacionOtra', '')), ''),
      v_tiene_trabajo,
      v_numero_hijas,
      v_numero_hijos_hombres,
      nullif(btrim(coalesce(v_identidad ->> 'servicioMedico', '')), '')::public.servicio_medico,
      case
        when v_identidad ->> 'servicioMedico' = 'otro'
        then nullif(btrim(coalesce(v_identidad ->> 'servicioMedicoOtro', '')), '')
        else null
      end,
      v_tiene_embarazo,
      v_tiene_denuncia,
      v_es_victima_delito,
      v_drogas,
      v_especificacion_droga,
      v_consumo_alcohol,
      v_actor_id
    )
    returning id, ficha_registro.folio into v_ficha_id, v_folio;
  end if;

  -- 3) Servicios solicitados (N:M, deduplicados; opcional en A-14)
  if v_identidad ? 'serviciosSolicitadosAreaIds'
     and jsonb_typeof(v_identidad -> 'serviciosSolicitadosAreaIds') <> 'null' then
    if jsonb_typeof(v_identidad -> 'serviciosSolicitadosAreaIds') <> 'array' then
      raise exception 'serviciosSolicitadosAreaIds debe ser un arreglo JSON'
        using errcode = '23514';
    end if;

    insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
    select v_ficha_id, s.area_id, v_actor_id
    from (
      select distinct (nullif(btrim(elem), ''))::smallint as area_id
      from jsonb_array_elements_text(v_identidad -> 'serviciosSolicitadosAreaIds') as elem
      where nullif(btrim(elem), '') is not null
    ) s;
  end if;

  -- 4) Domicilio actual
  update public.domicilio d
  set es_actual = false
  where d.persona_id = v_persona_id
    and d.activo
    and d.es_actual;

  v_asentamiento := nullif(btrim(coalesce(v_domicilio ->> 'asentamientoId', '')), '')::integer;
  v_cp_foraneo := case
    when v_asentamiento is null
    then nullif(btrim(coalesce(v_domicilio ->> 'codigoPostalForaneo', '')), '')
    else null
  end;

  insert into public.domicilio (
    persona_id,
    asentamiento_id,
    codigo_postal,
    calle,
    numero_exterior,
    numero_interior,
    referencias,
    zona,
    es_actual,
    creado_por
  ) values (
    v_persona_id,
    v_asentamiento,
    v_cp_foraneo,
    nullif(btrim(coalesce(v_domicilio ->> 'calle', '')), ''),
    nullif(btrim(coalesce(v_domicilio ->> 'numeroExterior', '')), ''),
    nullif(btrim(coalesce(v_domicilio ->> 'numeroInterior', '')), ''),
    nullif(btrim(coalesce(v_domicilio ->> 'referencias', '')), ''),
    nullif(btrim(coalesce(v_domicilio ->> 'zona', '')), '')::public.zona_geografica,
    true,
    v_actor_id
  );

  -- 5) Estudio Socioeconómico actual
  select array(
    select elem::public.servicio_vivienda
    from jsonb_array_elements_text(coalesce(v_estudio -> 'servicios', '[]'::jsonb)) as elem
  ) into v_servicios;

  select array(
    select elem::public.bien_vivienda
    from jsonb_array_elements_text(coalesce(v_estudio -> 'bienes', '[]'::jsonb)) as elem
  ) into v_bienes;

  insert into public.estudio_socioeconomico (
    ficha_id,
    es_actual,
    ingreso_mensual_propio,
    numero_dependientes,
    tiene_apoyo,
    especificacion_apoyo,
    tipo_vivienda,
    material,
    material_otro,
    servicios,
    bienes,
    creado_por
  ) values (
    v_ficha_id,
    true,
    nullif(btrim(coalesce(v_estudio ->> 'ingresoMensualPropio', '')), '')::numeric(10, 2),
    nullif(btrim(coalesce(v_estudio ->> 'numeroDependientes', '')), '')::smallint,
    coalesce((v_estudio ->> 'tieneApoyo')::boolean, false),
    case
      when coalesce((v_estudio ->> 'tieneApoyo')::boolean, false)
      then nullif(btrim(coalesce(v_estudio ->> 'especificacionApoyo', '')), '')
      else null
    end,
    nullif(btrim(coalesce(v_estudio ->> 'tipoVivienda', '')), '')::public.tipo_vivienda,
    nullif(btrim(coalesce(v_estudio ->> 'material', '')), '')::public.material_vivienda,
    case
      when v_estudio ->> 'material' = 'otro'
      then nullif(btrim(coalesce(v_estudio ->> 'materialOtro', '')), '')
      else null
    end,
    case when coalesce(array_length(v_servicios, 1), 0) > 0 then v_servicios else null end,
    case when coalesce(array_length(v_bienes, 1), 0) > 0 then v_bienes else null end,
    v_actor_id
  )
  returning id into v_estudio_id;

  -- 6) Aportantes del hogar (nombre opcional en A-14)
  for v_aportante in
    select value from jsonb_array_elements(coalesce(v_estudio -> 'aportantes', '[]'::jsonb))
  loop
    insert into public.aportante_hogar (
      estudio_socioeconomico_id,
      nombre,
      parentesco_id,
      parentesco_otro,
      ocupacion_id,
      ocupacion_otra,
      tipo_trabajo,
      monto,
      frecuencia,
      creado_por
    ) values (
      v_estudio_id,
      nullif(btrim(coalesce(v_aportante ->> 'nombre', '')), ''),
      nullif(btrim(coalesce(v_aportante ->> 'parentescoId', '')), '')::smallint,
      nullif(btrim(coalesce(v_aportante ->> 'parentescoOtro', '')), ''),
      nullif(btrim(coalesce(v_aportante ->> 'ocupacionId', '')), '')::smallint,
      nullif(btrim(coalesce(v_aportante ->> 'ocupacionOtra', '')), ''),
      nullif(btrim(coalesce(v_aportante ->> 'tipoTrabajo', '')), '')::public.tipo_trabajo,
      nullif(btrim(coalesce(v_aportante ->> 'monto', '')), '')::numeric(10, 2),
      nullif(btrim(coalesce(v_aportante ->> 'frecuencia', '')), '')::public.frecuencia_ingreso,
      v_actor_id
    );
  end loop;

  return query select v_ficha_id, v_folio, v_persona_id;
end;
$$;

revoke execute on function public.crear_ficha_completa(jsonb) from public, anon;
grant  execute on function public.crear_ficha_completa(jsonb) to authenticated;
