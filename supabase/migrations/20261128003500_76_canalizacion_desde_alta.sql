-- =====================================================================
-- 76. Canalización inicial desde el alta del expediente
-- ---------------------------------------------------------------------
-- Problema: el wizard de alta guarda "Servicios solicitados" solo en
-- ficha_servicio_solicitado; la pestaña Canalizaciones lee derivacion,
-- así que el expediente nuevo aparecía sin canalizaciones.
--
-- 1. crear_ficha_completa: misma versión de la 60 + bloque 3b que crea
--    una derivacion 'pendiente' por cada servicio solicitado de área
--    interna (sin duplicar si ya hay una abierta a esa área).
-- 2. Backfill único: lo mismo para expedientes existentes con servicios
--    solicitados y sin derivación abierta a esa área.
-- 3. Psicología/Jurídico se omiten para menores de 18 (RN-01, igual que
--    validar_derivacion_area); el select final lista los omitidos.
--
-- Idempotente: create or replace + inserts con not exists. Se puede
-- correr más de una vez sin duplicar.
-- =====================================================================

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
  v_persona_fecha_nac    date;
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

  select p.fecha_nacimiento into v_persona_fecha_nac
  from public.persona p
  where p.id = v_persona_id;

  -- 3b) Canalización inicial (76): cada servicio solicitado de un área
  --     interna (trabajo_social, psicologia, juridico) abre una
  --     derivación pendiente, para que aparezca en la pestaña
  --     Canalizaciones. No duplica si ya hay una abierta a esa área.
  insert into public.derivacion (
    ficha_id, area_origen_id, area_destino_id, destino, motivo, estado, creado_por
  )
  select
    v_ficha_id,
    public.auth_area_id(),
    a.id,
    a.clave::public.destino_derivacion,
    'Servicio solicitado en el alta del expediente',
    'pendiente',
    (select e.id from public.empleado e where e.id = v_actor_id)
  from public.ficha_servicio_solicitado fss
  join public.cat_area a on a.id = fss.area_id
  where fss.ficha_id = v_ficha_id
    and a.clave in ('trabajo_social', 'psicologia', 'juridico')
    -- RN-01: Psicología y Jurídico solo para mayores de 18 (misma regla
    -- que validar_derivacion_area). Para menores se omite en vez de
    -- tumbar el alta; el servicio solicitado queda guardado igual.
    and (
      a.clave = 'trabajo_social'
      or v_persona_fecha_nac is null
      or v_persona_fecha_nac <= ((now() at time zone 'America/Mazatlan')::date - interval '18 years')::date
    )
    and not exists (
      select 1
      from public.derivacion d
      where d.ficha_id = v_ficha_id
        and d.area_destino_id = a.id
        and d.activo
        and d.estado in ('pendiente', 'en_proceso')
    );

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


-- ---------------------------------------------------------------------
-- 2. Backfill: expedientes ya creados con servicios solicitados
-- ---------------------------------------------------------------------
insert into public.derivacion (
  ficha_id, area_origen_id, area_destino_id, destino, motivo,
  fecha_derivacion, estado, creado_por
)
select
  f.id,
  e.area_id,
  a.id,
  a.clave::public.destino_derivacion,
  'Servicio solicitado en el alta del expediente',
  f.registrada_en::date,
  'pendiente',
  e.id
from public.ficha_servicio_solicitado fss
join public.ficha_registro f on f.id = fss.ficha_id
join public.cat_area a on a.id = fss.area_id
left join public.empleado e on e.id = coalesce(fss.creado_por, f.creado_por)
join public.persona p on p.id = f.persona_id
where f.activo
  and f.estado <> 'archivado'
  and a.clave in ('trabajo_social', 'psicologia', 'juridico')
  and (
    a.clave = 'trabajo_social'
    or p.fecha_nacimiento is null
    or p.fecha_nacimiento <= ((now() at time zone 'America/Mazatlan')::date - interval '18 years')::date
  )
  and not exists (
    select 1
    from public.derivacion d
    where d.ficha_id = f.id
      and d.area_destino_id = a.id
      and d.activo
      and d.estado in ('pendiente', 'en_proceso')
  );

-- ---------------------------------------------------------------------
-- 3. Reporte: servicios solicitados que NO se canalizaron por RN-01
--    (menores de 18 con Psicología o Jurídico). Solo lectura.
-- ---------------------------------------------------------------------
select f.folio, a.nombre as area_omitida, p.fecha_nacimiento
from public.ficha_servicio_solicitado fss
join public.ficha_registro f on f.id = fss.ficha_id
join public.persona p on p.id = f.persona_id
join public.cat_area a on a.id = fss.area_id
where f.activo
  and f.estado <> 'archivado'
  and a.clave in ('psicologia', 'juridico')
  and p.fecha_nacimiento > ((now() at time zone 'America/Mazatlan')::date - interval '18 years')::date
order by f.folio, a.nombre;
