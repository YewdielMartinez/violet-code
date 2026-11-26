-- =====================================================================
-- 10_rpc_ficha_y_enums_arrays.sql
-- Qué contiene:
--   1. Convierte listas cerradas de text[] + CHECK a ENUM[] nativos de
--      PostgreSQL (`servicio_vivienda`, `bien_vivienda`, `tipo_droga`)
--      para tener una sola fuente de verdad y tipos estrictos en TS.
--   2. RPC transaccional atómico `crear_ficha_completa(p_payload jsonb)`
--      (docs/resiliencia-concurrencia-sesiones.md §4): crea persona (o
--      reutiliza existente sin ficha activa), ficha_registro (folio
--      automático), ficha_servicio_solicitado, domicilio,
--      estudio_socioeconomico y aportante_hogar en una sola transacción.
-- Depende de: 01_base.sql, 02_atencion.sql, 04_ficha.sql, 06_reglas_negocio.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMs nativos para servicios, bienes y drogas
-- ---------------------------------------------------------------------
do $$ begin
  create type public.servicio_vivienda as enum (
    'agua', 'drenaje', 'luz', 'pavimento', 'cable', 'internet'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bien_vivienda as enum (
    'estufa', 'refrigerador', 'lavadora', 'aire_acondicionado',
    'abanico', 'tv', 'microondas', 'computadora'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tipo_droga as enum (
    'marihuana', 'cristal', 'cocaina', 'inhalantes',
    'medicamento_controlado', 'otra'
  );
exception when duplicate_object then null;
end $$;

-- Eliminar CHECKs de subconjunto (<@) sobre text[] antes de cambiar el tipo
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in (
        'public.estudio_socioeconomico'::regclass,
        'public.ficha_registro'::regclass,
        'public.agresor'::regclass
      )
      and pg_get_constraintdef(c.oid) like '%<@%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.estudio_socioeconomico
  alter column servicios type public.servicio_vivienda[]
    using servicios::public.servicio_vivienda[],
  alter column bienes type public.bien_vivienda[]
    using bienes::public.bien_vivienda[];

alter table public.ficha_registro
  alter column drogas type public.tipo_droga[]
    using drogas::public.tipo_droga[];

alter table public.agresor
  alter column drogas type public.tipo_droga[]
    using drogas::public.tipo_droga[];

-- ---------------------------------------------------------------------
-- 2. RPC transaccional atómico: crear_ficha_completa(p_payload jsonb)
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
        discapacidad_id,
        grupo_etnico_id,
        religion_id,
        creado_por
      ) values (
        v_curp,
        btrim(v_identidad ->> 'nombres'),
        btrim(v_identidad ->> 'apellidoPaterno'),
        nullif(btrim(coalesce(v_identidad ->> 'apellidoMaterno', '')), ''),
        nullif(btrim(coalesce(v_identidad ->> 'celular', '')), ''),
        nullif(btrim(coalesce(v_identidad ->> 'escolaridad', '')), '')::public.escolaridad_nivel,
        nullif(btrim(coalesce(v_identidad ->> 'discapacidadId', '')), '')::smallint,
        nullif(btrim(coalesce(v_identidad ->> 'grupoEtnicoId', '')), '')::smallint,
        nullif(btrim(coalesce(v_identidad ->> 'religionId', '')), '')::smallint,
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
