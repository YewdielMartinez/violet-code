-- =====================================================================
-- 11_revertir_catalogos_y_tipo_arma.sql
-- Regresa al diseño original (01_base.sql y 04_ficha.sql):
--   persona.discapacidad, religion y grupo_etnico vuelven a ser text libre
--   (se eliminan cat_discapacidad, cat_religion y cat_grupo_etnico).
--   agresor pierde tipo_arma (enum); el arma vuelve a describirse con
--   utilizo_arma_u_objeto + especificacion_arma, como estaba.
--   Actualiza crear_ficha_completa(jsonb) para usar esos campos de texto.
-- Los datos existentes NO se pierden: se copian al texto antes de borrar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) persona: discapacidad, religion y grupo_etnico como text
-- ---------------------------------------------------------------------
alter table public.persona
  add column discapacidad text,
  add column religion     text,
  add column grupo_etnico text;

-- Se copia el texto "otro" si se capturó; si no, el nombre del catálogo.
update public.persona p
set discapacidad = coalesce(nullif(trim(p.discapacidad_otra), ''),
                            (select c.nombre from public.cat_discapacidad c where c.id = p.discapacidad_id)),
    religion     = coalesce(nullif(trim(p.religion_otra), ''),
                            (select c.nombre from public.cat_religion c where c.id = p.religion_id)),
    grupo_etnico = coalesce(nullif(trim(p.grupo_etnico_otro), ''),
                            (select c.nombre from public.cat_grupo_etnico c where c.id = p.grupo_etnico_id))
where p.discapacidad_id is not null or p.discapacidad_otra is not null
   or p.religion_id     is not null or p.religion_otra     is not null
   or p.grupo_etnico_id is not null or p.grupo_etnico_otro is not null;

-- Al borrar las columnas se borran también sus FKs y checks.
alter table public.persona
  drop column discapacidad_id,
  drop column discapacidad_otra,
  drop column religion_id,
  drop column religion_otra,
  drop column grupo_etnico_id,
  drop column grupo_etnico_otro;

-- Sus políticas RLS y grants se eliminan junto con cada tabla.
drop table public.cat_discapacidad;
drop table public.cat_religion;
drop table public.cat_grupo_etnico;

-- ---------------------------------------------------------------------
-- 2) agresor: quitar tipo_arma
-- ---------------------------------------------------------------------
-- Si solo se capturó tipo_arma, se pasa a especificacion_arma para no
-- perder el dato (p. ej. 'arma_blanca' -> 'arma blanca').
update public.agresor
set especificacion_arma = replace(tipo_arma::text, '_', ' ')
where tipo_arma is not null
  and nullif(trim(especificacion_arma), '') is null;

alter table public.agresor drop column tipo_arma;
alter table public.agresor
  add constraint agresor_arma_especificacion_check
  check (coalesce(utilizo_arma_u_objeto, false) or especificacion_arma is null);
drop type public.tipo_arma;

-- ---------------------------------------------------------------------
-- 3) Actualizar RPC crear_ficha_completa(p_payload jsonb)
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
  v_actor_id       uuid := auth.uid();
  v_identidad      jsonb := coalesce(p_payload -> 'identidad', '{}'::jsonb);
  v_domicilio      jsonb := coalesce(p_payload -> 'domicilio', '{}'::jsonb);
  v_estudio        jsonb := coalesce(p_payload -> 'estudio', '{}'::jsonb);
  v_curp           text;
  v_persona_id     uuid;
  v_ficha_id       uuid;
  v_folio          text;
  v_estudio_id     uuid;
  v_asentamiento   integer;
  v_cp_foraneo     text;
  v_aviso_ts       timestamptz;
  v_servicios      public.servicio_vivienda[];
  v_bienes         public.bien_vivienda[];
  v_aportante      jsonb;
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

  -- 1) Persona: reutiliza existingPersonaId o persona sin ficha activa; bloquea duplicados
  v_persona_id := nullif(btrim(coalesce(v_identidad ->> 'existingPersonaId', '')), '')::uuid;

  if v_persona_id is null then
    select p.id into v_persona_id
    from public.persona p
    where p.curp = v_curp;

    if v_persona_id is not null then
      if exists (
        select 1
        from public.ficha_registro f
        where f.persona_id = v_persona_id
          and f.activo
      ) then
        raise exception 'Esta persona ya tiene una Ficha Única registrada con esa CURP'
          using errcode = '23505';
      end if;
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

  -- 3) Servicios solicitados (N:M)
  insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
  select v_ficha_id, (elem)::smallint, v_actor_id
  from jsonb_array_elements_text(v_identidad -> 'serviciosSolicitadosAreaIds') as elem;

  -- 4) Domicilio actual
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
