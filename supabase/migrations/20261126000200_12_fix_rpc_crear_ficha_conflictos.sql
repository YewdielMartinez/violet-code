-- =====================================================================
-- 12_fix_rpc_crear_ficha_conflictos.sql
-- Qué contiene:
--   1. Limpieza de fichas truncas/huérfanas (sin estudio_socioeconomico
--      ni registros hijos) generadas antes del RPC transaccional.
--   2. Sincronización de la secuencia public.ficha_folio_seq con el
--      máximo consecutivo existente en public.ficha_registro.
--   3. Endurecimiento de public.crear_ficha_completa(jsonb) contra
--      falsos conflictos 409 (SQLSTATE 23505):
--      - Verifica expediente existente tanto por existingPersonaId como
--        por CURP y devuelve el folio existente en el mensaje.
--      - Si existe una ficha trunca sin estudio ni registros asociados,
--        la limpia dentro de la misma transacción.
--      - Si la persona ya existía sin ficha, actualiza sus datos y
--        desmarca domicilios previos (es_actual = false) antes de
--        insertar el nuevo domicilio actual (domicilio_persona_actual_uidx).
--      - Deduplica serviciosSolicitadosAreaIds con SELECT DISTINCT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Limpieza de fichas truncas/huérfanas previas al RPC atómico
-- ---------------------------------------------------------------------
delete from public.ficha_servicio_solicitado fss
using public.ficha_registro f
where fss.ficha_id = f.id
  and f.id not in (
    '10000000-0000-4000-a000-000000000301',
    '10000000-0000-4000-a000-000000000302',
    '10000000-0000-4000-a000-000000000303'
  )
  and not exists (select 1 from public.estudio_socioeconomico es where es.ficha_id = f.id)
  and not exists (select 1 from public.atencion a where a.ficha_id = f.id)
  and not exists (select 1 from public.agresor ag where ag.ficha_id = f.id)
  and not exists (select 1 from public.orden_proteccion op where op.ficha_id = f.id)
  and not exists (select 1 from public.nota_area na where na.ficha_id = f.id)
  and not exists (select 1 from public.derivacion d where d.ficha_id = f.id)
  and not exists (select 1 from public.documento doc where doc.ficha_id = f.id);

delete from public.ficha_registro f
where f.id not in (
    '10000000-0000-4000-a000-000000000301',
    '10000000-0000-4000-a000-000000000302',
    '10000000-0000-4000-a000-000000000303'
  )
  and not exists (select 1 from public.estudio_socioeconomico es where es.ficha_id = f.id)
  and not exists (select 1 from public.atencion a where a.ficha_id = f.id)
  and not exists (select 1 from public.agresor ag where ag.ficha_id = f.id)
  and not exists (select 1 from public.orden_proteccion op where op.ficha_id = f.id)
  and not exists (select 1 from public.nota_area na where na.ficha_id = f.id)
  and not exists (select 1 from public.derivacion d where d.ficha_id = f.id)
  and not exists (select 1 from public.documento doc where doc.ficha_id = f.id);

-- ---------------------------------------------------------------------
-- 2. Sincronizar secuencia ficha_folio_seq con el máximo folio actual
-- ---------------------------------------------------------------------
do $$
declare
  v_max_num bigint;
begin
  select coalesce(
    max((regexp_match(folio, '^SEM-[0-9]{4}-([0-9]+)$'))[1]::bigint),
    0
  )
  into v_max_num
  from public.ficha_registro;

  if v_max_num > 0 then
    perform setval('public.ficha_folio_seq', v_max_num, true);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. RPC transaccional atómico actualizado: crear_ficha_completa(jsonb)
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
  v_actor_id        uuid := auth.uid();
  v_identidad       jsonb := coalesce(p_payload -> 'identidad', '{}'::jsonb);
  v_domicilio       jsonb := coalesce(p_payload -> 'domicilio', '{}'::jsonb);
  v_estudio         jsonb := coalesce(p_payload -> 'estudio', '{}'::jsonb);
  v_curp            text;
  v_persona_id      uuid;
  v_ficha_existente record;
  v_ficha_id        uuid;
  v_folio           text;
  v_estudio_id      uuid;
  v_asentamiento    integer;
  v_cp_foraneo      text;
  v_aviso_ts        timestamptz;
  v_servicios       public.servicio_vivienda[];
  v_bienes          public.bien_vivienda[];
  v_aportante       jsonb;
begin
  -- Validación de rol activo autorizado (titular, subdireccion, trabajo_social)
  if v_actor_id is null or not exists (
    select 1
    from public.empleado e
    where e.id = v_actor_id
      and e.activo
      and e.rol in ('titular', 'subdireccion', 'trabajo_social')
  ) then
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

  -- 1) Resolver persona por existingPersonaId o por CURP
  v_persona_id := nullif(btrim(coalesce(v_identidad ->> 'existingPersonaId', '')), '')::uuid;

  if v_persona_id is null then
    select p.id into v_persona_id
    from public.persona p
    where p.curp = v_curp;
  end if;

  if v_persona_id is not null then
    -- Verificar si ya existe una ficha para esta persona (activa o inactiva, dado UNIQUE(persona_id))
    select f.id, f.folio
    into v_ficha_existente
    from public.ficha_registro f
    where f.persona_id = v_persona_id
    limit 1;

    if v_ficha_existente.id is not null then
      -- Si es una ficha trunca sin estudio ni registros hijos, limpiarla para permitir el alta completa
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
        delete from public.ficha_servicio_solicitado where ficha_id = v_ficha_existente.id;
        delete from public.ficha_registro where id = v_ficha_existente.id;
      else
        raise exception 'Esta CURP ya cuenta con un expediente registrado (folio %). Consúltalo en Expedientes.',
          v_ficha_existente.folio
          using errcode = '23505';
      end if;
    end if;

    -- Actualizar datos de la persona existente
    update public.persona
    set nombres          = btrim(v_identidad ->> 'nombres'),
        apellido_paterno = btrim(v_identidad ->> 'apellidoPaterno'),
        apellido_materno = nullif(btrim(coalesce(v_identidad ->> 'apellidoMaterno', '')), ''),
        celular          = nullif(btrim(coalesce(v_identidad ->> 'celular', '')), ''),
        escolaridad      = nullif(btrim(coalesce(v_identidad ->> 'escolaridad', '')), '')::public.escolaridad_nivel,
        discapacidad     = nullif(btrim(coalesce(v_identidad ->> 'discapacidad', '')), ''),
        grupo_etnico     = nullif(btrim(coalesce(v_identidad ->> 'grupoEtnico', '')), ''),
        religion         = nullif(btrim(coalesce(v_identidad ->> 'religion', '')), ''),
        activo           = true
    where id = v_persona_id;
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

  -- 2) Ficha Única (folio automático vía trigger/secuencia)
  insert into public.ficha_registro (
    persona_id,
    aviso_privacidad_aceptado_en,
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
    creado_por
  ) values (
    v_persona_id,
    v_aviso_ts,
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
    v_actor_id
  )
  returning id, ficha_registro.folio into v_ficha_id, v_folio;

  -- 3) Servicios solicitados (N:M, deduplicados)
  insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
  select v_ficha_id, s.area_id, v_actor_id
  from (
    select distinct (elem)::smallint as area_id
    from jsonb_array_elements_text(v_identidad -> 'serviciosSolicitadosAreaIds') as elem
  ) s;

  -- 4) Domicilio actual (desmarcar previos activos de la misma persona para respetar domicilio_persona_actual_uidx)
  update public.domicilio
  set es_actual = false
  where persona_id = v_persona_id
    and activo
    and es_actual;

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
