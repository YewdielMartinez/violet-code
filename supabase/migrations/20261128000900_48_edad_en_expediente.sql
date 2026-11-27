-- =====================================================================
-- 48_edad_en_expediente.sql (Tarjeta #111)
-- 1. Crea función public.calcular_edad(p_fecha date) con la fecha de hoy
--    en America/Mazatlan (sin guardar edad en ninguna tabla).
-- 2. Actualiza get_expediente_detalle() para devolver 'edad' en persona
--    y en cada agresor (calculada desde fecha_nacimiento).
-- 3. Recrea buscar_expedientes() agregando la columna 'edad'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. public.calcular_edad(p_fecha date)
-- ---------------------------------------------------------------------
create or replace function public.calcular_edad(p_fecha date)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_fecha is null then null
    else extract(year from age((now() at time zone 'America/Mazatlan')::date, p_fecha))::integer
  end;
$$;

revoke all on function public.calcular_edad(date) from public, anon;
grant  execute on function public.calcular_edad(date) to authenticated;

-- ---------------------------------------------------------------------
-- 2. get_expediente_detalle(p_ficha_id uuid, p_incluir_agresores bool)
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
      'tiene_consumo_droga',          v_ficha.tiene_consumo_droga,
      'drogas',                       v_ficha.drogas,
      'especificacion_droga',         v_ficha.especificacion_droga,
      'tiene_consumo_alcohol',        v_ficha.tiene_consumo_alcohol
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
-- 3. buscar_expedientes(p_termino, p_limite, p_incluir_archivados)
-- ---------------------------------------------------------------------
drop function if exists public.buscar_expedientes(text, int, boolean);

create or replace function public.buscar_expedientes(
  p_termino            text,
  p_limite             int default 20,
  p_incluir_archivados boolean default false
)
returns table (
  ficha_id           uuid,
  folio              text,
  estado             public.estado_ficha,
  persona_id         uuid,
  curp               text,
  nombre_completo    text,
  sexo               text,
  fecha_nacimiento   date,
  edad               integer,
  en_lista_urgencias boolean,
  coincidencia       text,
  similitud          real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_termino      text := btrim(coalesce(p_termino, ''));
  v_termino_norm text;
  v_upper        text;
  v_limite       int := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_incluir_arch boolean := coalesce(p_incluir_archivados, false);
begin
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para buscar expedientes' using errcode = '42501';
  end if;

  if char_length(v_termino) < 3 then
    raise exception 'Ingresa al menos 3 caracteres para buscar' using errcode = '23514';
  end if;

  v_upper := upper(v_termino);
  v_termino_norm := extensions.unaccent(lower(v_termino));

  if v_upper ~ '^[A-Z0-9]{18}$' then
    return query
    select f.id as ficha_id,
           f.folio,
           f.estado,
           p.id as persona_id,
           p.curp,
           concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as nombre_completo,
           p.sexo,
           p.fecha_nacimiento,
           public.calcular_edad(p.fecha_nacimiento) as edad,
           exists (
             select 1 from public.vista_lista_urgencias vlu where vlu.ficha_id = f.id
           ) as en_lista_urgencias,
           'curp'::text as coincidencia,
           1.0::real as similitud
    from public.ficha_registro f
    join public.persona p on p.id = f.persona_id
    where f.activo
      and p.activo
      and (v_incluir_arch or f.estado <> 'archivado')
      and p.curp = v_upper
    order by f.registrada_en desc
    limit v_limite;
    return;
  end if;

  if v_upper ~ '^SEM-' then
    return query
    select f.id as ficha_id,
           f.folio,
           f.estado,
           p.id as persona_id,
           p.curp,
           concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as nombre_completo,
           p.sexo,
           p.fecha_nacimiento,
           public.calcular_edad(p.fecha_nacimiento) as edad,
           exists (
             select 1 from public.vista_lista_urgencias vlu where vlu.ficha_id = f.id
           ) as en_lista_urgencias,
           'folio'::text as coincidencia,
           1.0::real as similitud
    from public.ficha_registro f
    join public.persona p on p.id = f.persona_id
    where f.activo
      and p.activo
      and (v_incluir_arch or f.estado <> 'archivado')
      and f.folio ilike v_upper || '%'
    order by f.registrada_en desc
    limit v_limite;
    return;
  end if;

  return query
  select f.id as ficha_id,
         f.folio,
         f.estado,
         p.id as persona_id,
         p.curp,
         concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as nombre_completo,
         p.sexo,
         p.fecha_nacimiento,
         public.calcular_edad(p.fecha_nacimiento) as edad,
         exists (
           select 1 from public.vista_lista_urgencias vlu where vlu.ficha_id = f.id
         ) as en_lista_urgencias,
         'nombre'::text as coincidencia,
         greatest(
           extensions.similarity(
             extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))),
             v_termino_norm
           ),
           case
             when extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))) like '%' || v_termino_norm || '%'
             then 0.8::real
             else 0.0::real
           end
         )::real as similitud
  from public.ficha_registro f
  join public.persona p on p.id = f.persona_id
  where f.activo
    and p.activo
    and (v_incluir_arch or f.estado <> 'archivado')
    and (
      extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))) like '%' || v_termino_norm || '%'
      or extensions.similarity(
           extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))),
           v_termino_norm
         ) >= 0.25
    )
  order by similitud desc, f.registrada_en desc
  limit v_limite;
end;
$$;

revoke execute on function public.buscar_expedientes(text, int, boolean) from public, anon;
grant  execute on function public.buscar_expedientes(text, int, boolean) to authenticated;
