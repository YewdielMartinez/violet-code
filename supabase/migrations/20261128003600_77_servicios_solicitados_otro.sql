-- =====================================================================
-- 77. Servicios solicitados: opción «Otro (especifica)» con texto libre
-- ---------------------------------------------------------------------
-- Problema: «Servicios solicitados» solo acepta áreas de cat_area
-- (ficha_servicio_solicitado.area_id es FK), así que no se podía
-- registrar un servicio fuera del listado.
--
-- 1. ficha_registro.servicios_solicitados_otro (text, ≤ 250, opcional).
--    Es informativo: NO crea derivación/canalización.
-- 2. crear_ficha_completa: misma versión de la 76 + lee
--    identidad.serviciosSolicitadosOtro.
-- 3. actualizar_ficha: misma versión de la 59 + p_servicios_solicitados_otro
--    (NULL = no cambia, '' = borra) y lo devuelve.
-- 4. get_expediente_detalle: misma versión de la 62 + devuelve
--    ficha.servicios_solicitados_otro.
--
-- Idempotente: add column if not exists + create or replace.
-- =====================================================================

alter table public.ficha_registro
  add column if not exists servicios_solicitados_otro text;

alter table public.ficha_registro
  drop constraint if exists ficha_registro_servicios_solicitados_otro_check;

alter table public.ficha_registro
  add constraint ficha_registro_servicios_solicitados_otro_check
  check (
    servicios_solicitados_otro is null
    or char_length(btrim(servicios_solicitados_otro)) between 1 and 250
  );

comment on column public.ficha_registro.servicios_solicitados_otro is
  'Servicio solicitado fuera de cat_area (texto libre). No genera canalización.';

-- ---------------------------------------------------------------------
-- 1. RPC: public.crear_ficha_completa (+ serviciosSolicitadosOtro)
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
  v_persona_fecha_nac    date;
  v_servicios_otro       text;
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

  -- 77: servicio solicitado fuera del catálogo (texto libre, sin canalización)
  v_servicios_otro := nullif(btrim(coalesce(v_identidad ->> 'serviciosSolicitadosOtro', '')), '');
  if v_servicios_otro is not null and char_length(v_servicios_otro) > 250 then
    raise exception 'El otro servicio solicitado no debe exceder 250 caracteres'
      using errcode = '23514';
  end if;

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
        servicios_solicitados_otro   = v_servicios_otro,
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
      servicios_solicitados_otro,
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
      v_servicios_otro,
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
-- 2. RPC: public.actualizar_ficha (+ p_servicios_solicitados_otro)
-- ---------------------------------------------------------------------
drop function if exists public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, public.tipo_droga[],
  text, public.consumo_alcohol, smallint[], text[]
);

create or replace function public.actualizar_ficha(
  p_ficha_id                       uuid,
  p_actualizado_en                 timestamptz,
  p_estado_civil                   public.estado_civil default null,
  p_ocupacion_id                   smallint default null,
  p_ocupacion_otra                 text default null,
  p_tiene_trabajo                  boolean default null,
  p_numero_hijas                   smallint default null,
  p_numero_hijos_hombres           smallint default null,
  p_servicio_medico                public.servicio_medico default null,
  p_servicio_medico_otro           text default null,
  p_tiene_embarazo                 boolean default null,
  p_tiene_denuncia                 boolean default null,
  p_es_victima_delito              boolean default null,
  p_drogas                         public.tipo_droga[] default null,
  p_especificacion_droga           text default null,
  p_consumo_alcohol                public.consumo_alcohol default null,
  p_servicios_solicitados_area_ids smallint[] default null,
  p_campos_sin_dato                text[] default null,
  p_servicios_solicitados_otro     text default null
)
returns table (
  id                           uuid,
  folio                        text,
  persona_id                   uuid,
  estado                       public.estado_ficha,
  estado_civil                 public.estado_civil,
  ocupacion_id                 smallint,
  ocupacion_otra               text,
  tiene_trabajo                boolean,
  numero_hijas                 smallint,
  numero_hijos_hombres         smallint,
  servicio_medico              public.servicio_medico,
  servicio_medico_otro         text,
  tiene_embarazo               boolean,
  tiene_denuncia               boolean,
  es_victima_delito            boolean,
  drogas                       public.tipo_droga[],
  especificacion_droga         text,
  consumo_alcohol              public.consumo_alcohol,
  servicios_solicitados_area_ids smallint[],
  servicios_solicitados_otro   text,
  actualizado_en               timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_ficha                public.ficha_registro%rowtype;
  v_campos_sin_dato      text[] := '{}'::text[];
  v_campo_raw            text;
  v_campo_norm           text;
  v_estado_civil         public.estado_civil;
  v_ocupacion_id         smallint;
  v_ocupacion_otra       text;
  v_tiene_trabajo        boolean;
  v_numero_hijas         smallint;
  v_numero_hijos_hombres smallint;
  v_servicio_medico      public.servicio_medico;
  v_servicio_medico_otro text;
  v_tiene_embarazo       boolean;
  v_tiene_denuncia       boolean;
  v_es_victima_delito    boolean;
  v_drogas               public.tipo_droga[];
  v_especificacion_droga text;
  v_consumo_alcohol      public.consumo_alcohol;
  v_area_ids             smallint[];
  v_servicios_otro       text;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para editar el expediente'
      using errcode = '42501';
  end if;

  if p_ficha_id is null or p_actualizado_en is null then
    raise exception 'El identificador del expediente y actualizado_en son obligatorios'
      using errcode = '23514';
  end if;

  if p_campos_sin_dato is not null then
    foreach v_campo_raw in array p_campos_sin_dato loop
      v_campo_norm := lower(btrim(coalesce(v_campo_raw, '')));
      if v_campo_norm = '' or v_campo_norm not in (
        'estado_civil',
        'ocupacion_id',
        'tiene_trabajo',
        'numero_hijas',
        'numero_hijos_hombres',
        'servicio_medico',
        'tiene_embarazo',
        'tiene_denuncia',
        'es_victima_delito',
        'drogas',
        'consumo_alcohol'
      ) then
        raise exception 'Campo inválido en p_campos_sin_dato: %', coalesce(v_campo_raw, '<null>')
          using errcode = '23514';
      end if;
      if not (v_campo_norm = any(v_campos_sin_dato)) then
        v_campos_sin_dato := array_append(v_campos_sin_dato, v_campo_norm);
      end if;
    end loop;
  end if;

  select fr.*
  into v_ficha
  from public.ficha_registro fr
  where fr.id = p_ficha_id
    and fr.activo
  for update;

  if v_ficha.id is null then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  if v_ficha.actualizado_en is distinct from p_actualizado_en then
    raise exception 'Este registro fue modificado por otra persona. Recarga los datos.'
      using errcode = '23505';
  end if;

  v_estado_civil := case
    when 'estado_civil' = any(v_campos_sin_dato) then null
    else coalesce(p_estado_civil, v_ficha.estado_civil)
  end;

  if 'ocupacion_id' = any(v_campos_sin_dato) then
    v_ocupacion_id := null;
  elsif p_ocupacion_id is not null then
    if not exists (
      select 1
      from public.cat_ocupacion co
      where co.id = p_ocupacion_id
    ) then
      raise exception 'Ocupación no encontrada en catálogo'
        using errcode = '23514';
    end if;
    v_ocupacion_id := p_ocupacion_id;
  else
    v_ocupacion_id := v_ficha.ocupacion_id;
  end if;

  if p_ocupacion_otra is null then
    v_ocupacion_otra := v_ficha.ocupacion_otra;
  else
    v_ocupacion_otra := nullif(btrim(p_ocupacion_otra), '');
    if v_ocupacion_otra is not null and char_length(v_ocupacion_otra) > 150 then
      raise exception 'La especificación de ocupación no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  v_tiene_trabajo := case
    when 'tiene_trabajo' = any(v_campos_sin_dato) then null
    else coalesce(p_tiene_trabajo, v_ficha.tiene_trabajo)
  end;

  if 'numero_hijas' = any(v_campos_sin_dato) then
    v_numero_hijas := null;
  else
    v_numero_hijas := coalesce(p_numero_hijas, v_ficha.numero_hijas);
    if v_numero_hijas is not null and (v_numero_hijas < 0 or v_numero_hijas > 30) then
      raise exception 'El número de hijas debe estar entre 0 y 30'
        using errcode = '23514';
    end if;
  end if;

  if 'numero_hijos_hombres' = any(v_campos_sin_dato) then
    v_numero_hijos_hombres := null;
  else
    v_numero_hijos_hombres := coalesce(p_numero_hijos_hombres, v_ficha.numero_hijos_hombres);
    if v_numero_hijos_hombres is not null and (v_numero_hijos_hombres < 0 or v_numero_hijos_hombres > 30) then
      raise exception 'El número de hijos debe estar entre 0 y 30'
        using errcode = '23514';
    end if;
  end if;

  v_servicio_medico := case
    when 'servicio_medico' = any(v_campos_sin_dato) then null
    else coalesce(p_servicio_medico, v_ficha.servicio_medico)
  end;

  if p_servicio_medico_otro is null then
    v_servicio_medico_otro := v_ficha.servicio_medico_otro;
  else
    v_servicio_medico_otro := nullif(btrim(p_servicio_medico_otro), '');
    if v_servicio_medico_otro is not null and char_length(v_servicio_medico_otro) > 150 then
      raise exception 'El servicio médico especificado no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_servicio_medico is distinct from 'otro'::public.servicio_medico then
    if p_servicio_medico_otro is not null and v_servicio_medico_otro is not null then
      raise exception 'Solo especifica otro servicio médico cuando el servicio sea "otro"'
        using errcode = '23514';
    end if;
    v_servicio_medico_otro := null;
  end if;

  v_tiene_embarazo := case
    when 'tiene_embarazo' = any(v_campos_sin_dato) then null
    else coalesce(p_tiene_embarazo, v_ficha.tiene_embarazo)
  end;

  v_tiene_denuncia := case
    when 'tiene_denuncia' = any(v_campos_sin_dato) then null
    else coalesce(p_tiene_denuncia, v_ficha.tiene_denuncia)
  end;

  v_es_victima_delito := case
    when 'es_victima_delito' = any(v_campos_sin_dato) then null
    else coalesce(p_es_victima_delito, v_ficha.es_victima_delito)
  end;

  if 'drogas' = any(v_campos_sin_dato) then
    v_drogas := null;
  elsif p_drogas is null then
    v_drogas := v_ficha.drogas;
  else
    select array_agg(d_item order by idx)
    into v_drogas
    from (
      select distinct on (elem) elem as d_item, min(ord) as idx
      from unnest(p_drogas) with ordinality as u(elem, ord)
      where elem is not null
      group by elem
    ) s;

    if v_drogas is not null
       and 'no_consume'::public.tipo_droga = any(v_drogas)
       and cardinality(v_drogas) > 1 then
      raise exception 'Si seleccionas "no_consume", no puedes seleccionar otras drogas'
        using errcode = '23514';
    end if;
  end if;

  if p_especificacion_droga is null then
    v_especificacion_droga := v_ficha.especificacion_droga;
  else
    v_especificacion_droga := nullif(btrim(p_especificacion_droga), '');
    if v_especificacion_droga is not null and char_length(v_especificacion_droga) > 250 then
      raise exception 'La especificación de droga no debe exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_drogas is null
     or coalesce(cardinality(v_drogas), 0) = 0
     or 'no_consume'::public.tipo_droga = any(v_drogas) then
    if p_especificacion_droga is not null and v_especificacion_droga is not null then
      raise exception 'No puedes especificar droga cuando no hay consumo o se seleccionó "no_consume"'
        using errcode = '23514';
    end if;
    v_especificacion_droga := null;
  end if;

  v_consumo_alcohol := case
    when 'consumo_alcohol' = any(v_campos_sin_dato) then null
    else coalesce(p_consumo_alcohol, v_ficha.consumo_alcohol)
  end;

  -- 77: NULL conserva el valor actual; '' lo borra
  if p_servicios_solicitados_otro is null then
    v_servicios_otro := v_ficha.servicios_solicitados_otro;
  else
    v_servicios_otro := nullif(btrim(p_servicios_solicitados_otro), '');
    if v_servicios_otro is not null and char_length(v_servicios_otro) > 250 then
      raise exception 'El otro servicio solicitado no debe exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_servicios_solicitados_area_ids is not null then
    select array_agg(distinct a_id order by a_id)
    into v_area_ids
    from unnest(p_servicios_solicitados_area_ids) as a_id
    where a_id is not null;

    if v_area_ids is null or cardinality(v_area_ids) = 0 then
      delete from public.ficha_servicio_solicitado fss
      where fss.ficha_id = p_ficha_id;
    else
      if (
        select count(*)
        from public.cat_area ca
        where ca.id = any(v_area_ids)
      ) <> cardinality(v_area_ids) then
        raise exception 'Alguno de los servicios solicitados no existe en cat_area'
          using errcode = '23514';
      end if;

      delete from public.ficha_servicio_solicitado fss
      where fss.ficha_id = p_ficha_id
        and not (fss.area_id = any(v_area_ids));

      insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
      select p_ficha_id, a_id, v_actor_id
      from unnest(v_area_ids) as a_id
      on conflict (ficha_id, area_id) do nothing;
    end if;
  end if;

  return query
  with actualizado as (
    update public.ficha_registro fr
    set estado_civil          = v_estado_civil,
        ocupacion_id          = v_ocupacion_id,
        ocupacion_otra        = v_ocupacion_otra,
        tiene_trabajo         = v_tiene_trabajo,
        numero_hijas          = v_numero_hijas,
        numero_hijos_hombres  = v_numero_hijos_hombres,
        servicio_medico       = v_servicio_medico,
        servicio_medico_otro  = v_servicio_medico_otro,
        tiene_embarazo        = v_tiene_embarazo,
        tiene_denuncia        = v_tiene_denuncia,
        es_victima_delito     = v_es_victima_delito,
        drogas                = v_drogas,
        especificacion_droga  = v_especificacion_droga,
        consumo_alcohol       = v_consumo_alcohol,
        servicios_solicitados_otro = v_servicios_otro
    where fr.id = p_ficha_id
    returning fr.*
  )
  select
    act.id,
    act.folio,
    act.persona_id,
    act.estado,
    act.estado_civil,
    act.ocupacion_id,
    act.ocupacion_otra,
    act.tiene_trabajo,
    act.numero_hijas,
    act.numero_hijos_hombres,
    act.servicio_medico,
    act.servicio_medico_otro,
    act.tiene_embarazo,
    act.tiene_denuncia,
    act.es_victima_delito,
    act.drogas,
    act.especificacion_droga,
    act.consumo_alcohol,
    coalesce(
      (
        select array_agg(fss.area_id order by fss.area_id)
        from public.ficha_servicio_solicitado fss
        where fss.ficha_id = act.id
      ),
      '{}'::smallint[]
    ) as servicios_solicitados_area_ids,
    act.servicios_solicitados_otro,
    act.actualizado_en
  from actualizado act;
end;
$$;

revoke all on function public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, public.tipo_droga[],
  text, public.consumo_alcohol, smallint[], text[], text
) from public, anon;

grant execute on function public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, public.tipo_droga[],
  text, public.consumo_alcohol, smallint[], text[], text
) to authenticated;


-- ---------------------------------------------------------------------
-- 3. RPC: public.get_expediente_detalle (+ servicios_solicitados_otro)
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
    'zona',                d.zona,
    'actualizado_en',      d.actualizado_en
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
    'actualizado_en',         es.actualizado_en,
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
      'actualizado_en',               v_ficha.actualizado_en,
      'aviso_privacidad_aceptado_en', v_ficha.aviso_privacidad_aceptado_en,
      'estado_civil',                 v_ficha.estado_civil,
      'ocupacion_id',                 v_ficha.ocupacion_id,
      'ocupacion_nombre',             v_ficha.ocupacion_nombre,
      'ocupacion_otra',               v_ficha.ocupacion_otra,
      'tiene_trabajo',                v_ficha.tiene_trabajo,
      'servicio_medico',              v_ficha.servicio_medico,
      'servicio_medico_otro',         v_ficha.servicio_medico_otro,
      'servicios_solicitados_otro',   v_ficha.servicios_solicitados_otro,
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
      'grupo_etnico',       v_persona.grupo_etnico,
      'actualizado_en',     v_persona.actualizado_en
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


notify pgrst, 'reload schema';
