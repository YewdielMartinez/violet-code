-- =====================================================================
-- 26_rpc_actividades_preventivas.sql (B-05 · Sprint 01 · RF-16)
-- RPCs para registro atómico y listado por rango de actividades
-- preventivas y sus empleados participantes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- public.registrar_actividad_preventiva(p_payload jsonb)
-- Crea una actividad preventiva y registra a sus empleados participantes
-- en una sola transacción. Requiere permiso 'actividad.registrar'.
-- ---------------------------------------------------------------------
create or replace function public.registrar_actividad_preventiva(p_payload jsonb)
returns table (
  actividad_id        uuid,
  total_participantes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id            uuid := auth.uid();
  v_titulo              text;
  v_tipo_actividad_id   smallint;
  v_tipo_institucion    public.tipo_institucion_actividad;
  v_nivel_educativo     public.nivel_educativo;
  v_sede                text;
  v_direccion           text;
  v_referencias         text;
  v_asentamiento_id     integer;
  v_programada_en       timestamptz;
  v_numero_asistentes   smallint;
  v_num_asistentes_int  integer;
  v_elem                jsonb;
  v_emp_id              uuid;
  v_participantes_raw   uuid[] := array[]::uuid[];
  v_participantes       uuid[] := array[]::uuid[];
  v_empleados_validos   integer := 0;
  v_actividad_id        uuid;
  v_total_participantes integer := 0;
begin
  -- 1. Validar permiso RBAC centralizado
  if not public.tiene_permiso('actividad.registrar') then
    raise exception 'Sin permiso para registrar actividades preventivas'
      using errcode = '42501';
  end if;

  -- 2. Validar estructura base del payload
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'El payload de actividad preventiva debe ser un objeto JSON'
      using errcode = '23514';
  end if;

  -- Título requerido (1..200)
  if not (p_payload ? 'titulo') or jsonb_typeof(p_payload -> 'titulo') <> 'string' then
    raise exception 'El título de la actividad es obligatorio'
      using errcode = '23514';
  end if;
  v_titulo := btrim(p_payload ->> 'titulo');
  if char_length(v_titulo) not between 1 and 200 then
    raise exception 'El título de la actividad debe tener entre 1 y 200 caracteres'
      using errcode = '23514';
  end if;

  -- tipo_actividad_id requerido y existente en cat_tipo_actividad
  if not (p_payload ? 'tipo_actividad_id')
     or jsonb_typeof(p_payload -> 'tipo_actividad_id') <> 'number' then
    raise exception 'El tipo de actividad es obligatorio y debe ser numérico'
      using errcode = '23514';
  end if;
  begin
    v_tipo_actividad_id := (p_payload ->> 'tipo_actividad_id')::smallint;
  exception when others then
    raise exception 'El identificador de tipo de actividad es inválido'
      using errcode = '23514';
  end;
  if not exists (
    select 1 from public.cat_tipo_actividad cta where cta.id = v_tipo_actividad_id
  ) then
    raise exception 'El tipo de actividad indicado no existe en el catálogo'
      using errcode = '23514';
  end if;

  -- tipo_institucion requerido y válido en enum
  if not (p_payload ? 'tipo_institucion')
     or jsonb_typeof(p_payload -> 'tipo_institucion') <> 'string' then
    raise exception 'El tipo de institución es obligatorio'
      using errcode = '23514';
  end if;
  begin
    v_tipo_institucion := btrim(p_payload ->> 'tipo_institucion')::public.tipo_institucion_actividad;
  exception when others then
    raise exception 'El tipo de institución indicado no es válido'
      using errcode = '23514';
  end;

  -- nivel_educativo opcional y solo permitido cuando tipo_institucion = 'escuela'
  if (p_payload ? 'nivel_educativo')
     and jsonb_typeof(p_payload -> 'nivel_educativo') <> 'null' then
    if jsonb_typeof(p_payload -> 'nivel_educativo') <> 'string' then
      raise exception 'El nivel educativo debe ser texto'
        using errcode = '23514';
    end if;
    if btrim(p_payload ->> 'nivel_educativo') <> '' then
      begin
        v_nivel_educativo := btrim(p_payload ->> 'nivel_educativo')::public.nivel_educativo;
      exception when others then
        raise exception 'El nivel educativo indicado no es válido'
          using errcode = '23514';
      end;
    end if;
  end if;
  if v_nivel_educativo is not null and v_tipo_institucion <> 'escuela' then
    raise exception 'El nivel educativo solo aplica cuando la institución es una escuela'
      using errcode = '23514';
  end if;

  -- sede requerida (1..200)
  if not (p_payload ? 'sede') or jsonb_typeof(p_payload -> 'sede') <> 'string' then
    raise exception 'La sede de la actividad es obligatoria'
      using errcode = '23514';
  end if;
  v_sede := btrim(p_payload ->> 'sede');
  if char_length(v_sede) not between 1 and 200 then
    raise exception 'La sede debe tener entre 1 y 200 caracteres'
      using errcode = '23514';
  end if;

  -- direccion opcional (<= 250)
  if (p_payload ? 'direccion')
     and jsonb_typeof(p_payload -> 'direccion') <> 'null' then
    if jsonb_typeof(p_payload -> 'direccion') <> 'string' then
      raise exception 'La dirección debe ser texto'
        using errcode = '23514';
    end if;
    v_direccion := nullif(btrim(p_payload ->> 'direccion'), '');
    if v_direccion is not null and char_length(v_direccion) > 250 then
      raise exception 'La dirección no puede exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  -- referencias opcional (<= 250)
  if (p_payload ? 'referencias')
     and jsonb_typeof(p_payload -> 'referencias') <> 'null' then
    if jsonb_typeof(p_payload -> 'referencias') <> 'string' then
      raise exception 'Las referencias deben ser texto'
        using errcode = '23514';
    end if;
    v_referencias := nullif(btrim(p_payload ->> 'referencias'), '');
    if v_referencias is not null and char_length(v_referencias) > 250 then
      raise exception 'Las referencias no pueden exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  -- asentamiento_id opcional y existente en cat_asentamiento
  if (p_payload ? 'asentamiento_id')
     and jsonb_typeof(p_payload -> 'asentamiento_id') <> 'null' then
    if jsonb_typeof(p_payload -> 'asentamiento_id') <> 'number' then
      raise exception 'El asentamiento_id debe ser numérico'
        using errcode = '23514';
    end if;
    begin
      v_asentamiento_id := (p_payload ->> 'asentamiento_id')::integer;
    exception when others then
      raise exception 'El asentamiento_id es inválido'
        using errcode = '23514';
    end;
    if not exists (
      select 1 from public.cat_asentamiento ca where ca.id = v_asentamiento_id
    ) then
      raise exception 'El asentamiento indicado no existe en el catálogo'
        using errcode = '23514';
    end if;
  end if;

  -- programada_en requerida
  if not (p_payload ? 'programada_en')
     or jsonb_typeof(p_payload -> 'programada_en') <> 'string'
     or btrim(p_payload ->> 'programada_en') = '' then
    raise exception 'La fecha programada_en es obligatoria'
      using errcode = '23514';
  end if;
  begin
    v_programada_en := (p_payload ->> 'programada_en')::timestamptz;
  exception when others then
    raise exception 'La fecha programada_en tiene un formato inválido'
      using errcode = '23514';
  end;

  -- numero_asistentes opcional (0..10000)
  if (p_payload ? 'numero_asistentes')
     and jsonb_typeof(p_payload -> 'numero_asistentes') <> 'null' then
    if jsonb_typeof(p_payload -> 'numero_asistentes') <> 'number' then
      raise exception 'El número de asistentes debe ser numérico'
        using errcode = '23514';
    end if;
    begin
      v_num_asistentes_int := (p_payload ->> 'numero_asistentes')::integer;
    exception when others then
      raise exception 'El número de asistentes debe ser un entero válido'
        using errcode = '23514';
    end;
    if v_num_asistentes_int not between 0 and 10000 then
      raise exception 'El número de asistentes debe estar entre 0 y 10000'
        using errcode = '23514';
    end if;
    v_numero_asistentes := v_num_asistentes_int::smallint;
  end if;

  -- participantes_ids opcional (arreglo JSON de UUIDs de empleados activos)
  if (p_payload ? 'participantes_ids')
     and jsonb_typeof(p_payload -> 'participantes_ids') <> 'null' then
    if jsonb_typeof(p_payload -> 'participantes_ids') <> 'array' then
      raise exception 'participantes_ids debe ser un arreglo JSON'
        using errcode = '23514';
    end if;

    for v_elem in
      select t.elem from jsonb_array_elements(p_payload -> 'participantes_ids') as t(elem)
    loop
      if jsonb_typeof(v_elem) <> 'string' then
        raise exception 'Cada participante en participantes_ids debe ser un UUID en texto'
          using errcode = '23514';
      end if;
      begin
        v_emp_id := (v_elem #>> '{}')::uuid;
      exception when others then
        raise exception 'Uno de los identificadores en participantes_ids no es un UUID válido'
          using errcode = '23514';
      end;
      v_participantes_raw := array_append(v_participantes_raw, v_emp_id);
    end loop;

    if coalesce(array_length(v_participantes_raw, 1), 0) > 0 then
      select coalesce(array_agg(distinct u.emp_id), array[]::uuid[])
        into v_participantes
      from unnest(v_participantes_raw) as u(emp_id);

      select count(*)
        into v_empleados_validos
      from public.empleado e
      where e.id = any(v_participantes)
        and e.activo;

      if v_empleados_validos <> coalesce(array_length(v_participantes, 1), 0) then
        raise exception 'Uno o más participantes no existen o están inactivos'
          using errcode = '23514';
      end if;
    end if;
  end if;

  -- 3. Inserción atómica en actividad_preventiva y actividad_empleado
  insert into public.actividad_preventiva (
    titulo,
    tipo_actividad_id,
    tipo_institucion,
    nivel_educativo,
    sede,
    direccion,
    referencias,
    asentamiento_id,
    programada_en,
    numero_asistentes,
    creado_por
  ) values (
    v_titulo,
    v_tipo_actividad_id,
    v_tipo_institucion,
    v_nivel_educativo,
    v_sede,
    v_direccion,
    v_referencias,
    v_asentamiento_id,
    v_programada_en,
    v_numero_asistentes,
    v_actor_id
  )
  returning public.actividad_preventiva.id into v_actividad_id;

  if coalesce(array_length(v_participantes, 1), 0) > 0 then
    insert into public.actividad_empleado (
      actividad_preventiva_id,
      empleado_id,
      creado_por
    )
    select v_actividad_id, u.emp_id, v_actor_id
    from unnest(v_participantes) as u(emp_id);

    get diagnostics v_total_participantes = row_count;
  end if;

  return query select v_actividad_id, v_total_participantes;
end;
$$;

revoke execute on function public.registrar_actividad_preventiva(jsonb) from public, anon;
grant  execute on function public.registrar_actividad_preventiva(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- public.get_actividades_preventivas(p_desde, p_hasta, p_limite)
-- Lista actividades preventivas activas por rango con asentamiento y
-- participantes. Requiere permiso 'actividad.ver' (incluye Recepción).
-- ---------------------------------------------------------------------
create or replace function public.get_actividades_preventivas(
  p_desde  timestamptz default null,
  p_hasta  timestamptz default null,
  p_limite integer     default 100
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
  participantes         jsonb
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
         coalesce(part.lista, '[]'::jsonb)        as participantes
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
  order by ap.programada_en desc, ap.creado_en desc
  limit p_limite;
end;
$$;

revoke execute on function public.get_actividades_preventivas(timestamptz, timestamptz, integer) from public, anon;
grant  execute on function public.get_actividades_preventivas(timestamptz, timestamptz, integer) to authenticated;
