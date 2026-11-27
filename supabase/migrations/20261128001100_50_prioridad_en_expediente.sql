-- =====================================================================
-- 50_prioridad_en_expediente.sql (Tarjeta #119)
-- 1. Agrega prioridad y prioridad_actualizada_en a public.ficha_registro
--    y las rellena con la prioridad de la última atención activa.
-- 2. Crea RPC cambiar_prioridad_expediente(p_ficha_id, p_prioridad)
--    para todos los roles activos excepto Recepción/UMECA/app; rechaza
--    expediente archivado (23514) y deja bitácora.
-- 3. Actualiza crear_ficha_completa() para aceptar prioridad opcional y
--    get_expediente_detalle() para devolverla en 'ficha'.
-- 4. Quita cita.prioridad de la tabla cita, de get_agenda() y de
--    reagendar_cita(). atencion.prioridad no se toca.
-- =====================================================================

-- 1) Columnas en public.ficha_registro + backfill desde última atención
alter table public.ficha_registro
  add column if not exists prioridad public.prioridad_nivel,
  add column if not exists prioridad_actualizada_en timestamptz;

with ultima_atencion as (
  select distinct on (a.ficha_id)
    a.ficha_id,
    a.prioridad,
    a.atendida_en
  from public.atencion a
  where a.activo
    and a.prioridad is not null
  order by a.ficha_id, a.atendida_en desc, a.creado_en desc, a.id desc
)
update public.ficha_registro f
set prioridad                = ua.prioridad,
    prioridad_actualizada_en = ua.atendida_en
from ultima_atencion ua
where f.id = ua.ficha_id
  and f.prioridad is null;

-- 2) RPC cambiar_prioridad_expediente(p_ficha_id, p_prioridad)
create or replace function public.cambiar_prioridad_expediente(
  p_ficha_id  uuid,
  p_prioridad public.prioridad_nivel
)
returns table (
  ficha_id                 uuid,
  prioridad                public.prioridad_nivel,
  prioridad_actualizada_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id       uuid := auth.uid();
  v_ficha          record;
  v_actualizada_en timestamptz := now();
begin
  -- Todos los roles de empleados activos excepto Recepción (y UMECA/app/anon)
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para cambiar la prioridad del expediente' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  select f.id, f.estado
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo
  for update;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'No se puede cambiar la prioridad de un expediente archivado' using errcode = '23514';
  end if;

  update public.ficha_registro f
  set prioridad                = p_prioridad,
      prioridad_actualizada_en = v_actualizada_en
  where f.id = v_ficha.id;

  -- Bitácora explícita de cambio de prioridad (además del trigger de actualización si aplica)
  insert into public.bitacora_acceso (empleado_id, accion, tabla_afectada, registro_id)
  values (v_actor_id, 'actualizar', 'ficha_registro', v_ficha.id::text);

  return query select v_ficha.id, p_prioridad, v_actualizada_en;
end;
$$;

revoke execute on function public.cambiar_prioridad_expediente(uuid, public.prioridad_nivel) from public, anon;
grant  execute on function public.cambiar_prioridad_expediente(uuid, public.prioridad_nivel) to authenticated;

-- 3) Actualizar crear_ficha_completa(p_payload) para aceptar prioridad opcional
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
  v_actor_id              uuid := auth.uid();
  v_identidad             jsonb := coalesce(p_payload -> 'identidad', '{}'::jsonb);
  v_domicilio             jsonb := coalesce(p_payload -> 'domicilio', '{}'::jsonb);
  v_estudio               jsonb := coalesce(p_payload -> 'estudio', '{}'::jsonb);
  v_curp                  text;
  v_persona_id            uuid;
  v_ficha_existente       record;
  v_reutilizar_ficha      boolean := false;
  v_ficha_id              uuid;
  v_folio                 text;
  v_estudio_id            uuid;
  v_asentamiento          integer;
  v_cp_foraneo            text;
  v_aviso_ts              timestamptz;
  v_prioridad             public.prioridad_nivel;
  v_prioridad_ts          timestamptz;
  v_tiene_consumo_droga   boolean;
  v_drogas                public.tipo_droga[];
  v_especificacion_droga  text;
  v_tiene_consumo_alcohol boolean;
  v_servicios             public.servicio_vivienda[];
  v_bienes                public.bien_vivienda[];
  v_aportante             jsonb;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para crear expedientes' using errcode = '42501';
  end if;

  if not coalesce((v_identidad ->> 'avisoPrivacidadAceptado')::boolean, false) then
    raise exception 'Es obligatorio aceptar el Aviso de Privacidad (RNF-04)' using errcode = '23514';
  end if;

  if jsonb_array_length(coalesce(v_identidad -> 'serviciosSolicitadosAreaIds', '[]'::jsonb)) = 0 then
    raise exception 'Selecciona al menos un servicio solicitado' using errcode = '23514';
  end if;

  v_curp := upper(btrim(coalesce(v_identidad ->> 'curp', '')));
  v_aviso_ts := now();
  v_prioridad := nullif(btrim(coalesce(v_identidad ->> 'prioridad', '')), '')::public.prioridad_nivel;
  v_prioridad_ts := case when v_prioridad is not null then v_aviso_ts else null end;

  -- Consumo de sustancias (opcional en identidad)
  v_tiene_consumo_droga := case
    when v_identidad ? 'tieneConsumoDroga' and nullif(btrim(coalesce(v_identidad ->> 'tieneConsumoDroga', '')), '') is not null
    then (v_identidad ->> 'tieneConsumoDroga')::boolean
    else null
  end;

  if coalesce(v_tiene_consumo_droga, false) then
    select array(
      select elem::public.tipo_droga
      from jsonb_array_elements_text(coalesce(v_identidad -> 'drogas', '[]'::jsonb)) as elem
    ) into v_drogas;
    if coalesce(array_length(v_drogas, 1), 0) = 0 then
      v_drogas := null;
    end if;
    v_especificacion_droga := nullif(btrim(coalesce(v_identidad ->> 'especificacionDroga', '')), '');
  else
    v_drogas := null;
    v_especificacion_droga := null;
  end if;

  v_tiene_consumo_alcohol := case
    when v_identidad ? 'tieneConsumoAlcohol' and nullif(btrim(coalesce(v_identidad ->> 'tieneConsumoAlcohol', '')), '') is not null
    then (v_identidad ->> 'tieneConsumoAlcohol')::boolean
    else null
  end;

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
        tiene_trabajo                = coalesce((v_identidad ->> 'tieneTrabajo')::boolean, false),
        numero_hijas                 = coalesce(nullif(btrim(coalesce(v_identidad ->> 'numeroHijas', '')), '')::smallint, 0),
        numero_hijos_hombres         = coalesce(nullif(btrim(coalesce(v_identidad ->> 'numeroHijosHombres', '')), '')::smallint, 0),
        servicio_medico              = nullif(btrim(coalesce(v_identidad ->> 'servicioMedico', '')), '')::public.servicio_medico,
        servicio_medico_otro         = case
          when v_identidad ->> 'servicioMedico' = 'otro'
          then nullif(btrim(coalesce(v_identidad ->> 'servicioMedicoOtro', '')), '')
          else null
        end,
        tiene_embarazo               = coalesce((v_identidad ->> 'tieneEmbarazo')::boolean, false),
        tiene_denuncia               = coalesce((v_identidad ->> 'tieneDenuncia')::boolean, false),
        es_victima_delito            = coalesce((v_identidad ->> 'esVictimaDelito')::boolean, false),
        tiene_consumo_droga          = v_tiene_consumo_droga,
        drogas                       = v_drogas,
        especificacion_droga         = v_especificacion_droga,
        tiene_consumo_alcohol        = v_tiene_consumo_alcohol,
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
      tiene_consumo_droga,
      drogas,
      especificacion_droga,
      tiene_consumo_alcohol,
      creado_por
    ) values (
      v_persona_id,
      v_aviso_ts,
      v_prioridad,
      v_prioridad_ts,
      nullif(btrim(coalesce(v_identidad ->> 'estadoCivil', '')), '')::public.estado_civil,
      nullif(btrim(coalesce(v_identidad ->> 'ocupacionId', '')), '')::smallint,
      nullif(btrim(coalesce(v_identidad ->> 'ocupacionOtra', '')), ''),
      coalesce((v_identidad ->> 'tieneTrabajo')::boolean, false),
      coalesce(nullif(btrim(coalesce(v_identidad ->> 'numeroHijas', '')), '')::smallint, 0),
      coalesce(nullif(btrim(coalesce(v_identidad ->> 'numeroHijosHombres', '')), '')::smallint, 0),
      nullif(btrim(coalesce(v_identidad ->> 'servicioMedico', '')), '')::public.servicio_medico,
      case
        when v_identidad ->> 'servicioMedico' = 'otro'
        then nullif(btrim(coalesce(v_identidad ->> 'servicioMedicoOtro', '')), '')
        else null
      end,
      coalesce((v_identidad ->> 'tieneEmbarazo')::boolean, false),
      coalesce((v_identidad ->> 'tieneDenuncia')::boolean, false),
      coalesce((v_identidad ->> 'esVictimaDelito')::boolean, false),
      v_tiene_consumo_droga,
      v_drogas,
      v_especificacion_droga,
      v_tiene_consumo_alcohol,
      v_actor_id
    )
    returning id, ficha_registro.folio into v_ficha_id, v_folio;
  end if;

  -- 3) Servicios solicitados (N:M, deduplicados)
  insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
  select v_ficha_id, s.area_id, v_actor_id
  from (
    select distinct (elem)::smallint as area_id
    from jsonb_array_elements_text(v_identidad -> 'serviciosSolicitadosAreaIds') as elem
  ) s;

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

  -- 6) Aportantes del hogar
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
      btrim(v_aportante ->> 'nombre'),
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

-- 4) Actualizar get_expediente_detalle() para devolver prioridad y prioridad_actualizada_en en ficha
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

-- 5) Quitar cita.prioridad de la tabla, de get_agenda() y de reagendar_cita()
alter table public.cita
  drop column if exists prioridad;

drop function if exists public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int);

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
      or (v_rol in ('recepcion', 'trabajo_social') and a.clave in ('trabajo_social', 'psicologia'))
      or (v_rol in ('psicologia', 'juridico') and c.area_id = v_area_id)
    )
  order by c.programada_en asc
  limit p_limite;
end;
$$;

revoke execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) from public, anon;
grant  execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) to authenticated;

drop function if exists public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel);

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
