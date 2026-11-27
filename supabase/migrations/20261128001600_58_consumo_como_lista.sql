-- =====================================================================
-- 58_consumo_como_lista.sql (A-15 · Sprint 02)
-- Qué contiene:
--   1. Agrega 'no_consume' a public.tipo_droga (exclusivo en el arreglo).
--   2. Crea el enum public.consumo_alcohol ('no_consume', 'ocasional', 'frecuente').
--   3. Migra public.ficha_registro y public.agresor:
--      - tiene_consumo_droga = false -> drogas = '{no_consume}'
--      - tiene_consumo_droga is null -> drogas = null
--      - tiene_consumo_alcohol: false -> 'no_consume', true -> 'ocasional'
--      - Elimina tiene_consumo_droga y tiene_consumo_alcohol.
--      - Agrega constraints de consistencia para no_consume y especificacion_droga.
--   4. Actualiza get_expediente_detalle, crear_ficha_completa, actualizar_ficha
--      y guardar_agresor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Eliminar firmas previas dependientes de tipo_droga / columnas viejas
-- ---------------------------------------------------------------------
drop function if exists public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, boolean, public.tipo_droga[],
  text, boolean, smallint[]
);

drop function if exists public.guardar_agresor(
  uuid, uuid, timestamptz, text, text, text, smallint, date, text,
  public.sexo_biologico, public.estado_civil, text, smallint, text, integer,
  text, text, text, text, text, public.zona_geografica, smallint, text,
  public.tipo_trabajo, boolean, public.tipo_droga[], text, boolean, text, text
);

-- ---------------------------------------------------------------------
-- 2. Recrear tipo_droga con 'no_consume' (transacción segura)
-- ---------------------------------------------------------------------
alter table public.ficha_registro
  drop constraint if exists ficha_registro_check;

alter table public.agresor
  drop constraint if exists agresor_check1;

alter type public.tipo_droga rename to tipo_droga_old;

create type public.tipo_droga as enum (
  'no_consume',
  'marihuana',
  'cristal',
  'cocaina',
  'inhalantes',
  'medicamento_controlado',
  'otra'
);

alter table public.ficha_registro
  alter column drogas type public.tipo_droga[]
  using drogas::text[]::public.tipo_droga[];

alter table public.agresor
  alter column drogas type public.tipo_droga[]
  using drogas::text[]::public.tipo_droga[];

drop type public.tipo_droga_old;

-- ---------------------------------------------------------------------
-- 3. Crear enum consumo_alcohol, migrar datos y quitar booleanos viejos
-- ---------------------------------------------------------------------
create type public.consumo_alcohol as enum (
  'no_consume',
  'ocasional',
  'frecuente'
);

alter table public.ficha_registro
  add column consumo_alcohol public.consumo_alcohol;

alter table public.agresor
  add column consumo_alcohol public.consumo_alcohol;

update public.ficha_registro
set drogas = case
      when tiene_consumo_droga = false then array['no_consume']::public.tipo_droga[]
      when tiene_consumo_droga is null then null
      when coalesce(cardinality(drogas), 0) = 0 then null
      else drogas
    end,
    especificacion_droga = case
      when coalesce(tiene_consumo_droga, false)
           and coalesce(cardinality(drogas), 0) > 0
      then especificacion_droga
      else null
    end,
    consumo_alcohol = case
      when tiene_consumo_alcohol = false then 'no_consume'::public.consumo_alcohol
      when tiene_consumo_alcohol = true then 'ocasional'::public.consumo_alcohol
      else null
    end;

update public.agresor
set drogas = case
      when tiene_consumo_droga = false then array['no_consume']::public.tipo_droga[]
      when tiene_consumo_droga is null then null
      when coalesce(cardinality(drogas), 0) = 0 then null
      else drogas
    end,
    especificacion_droga = case
      when coalesce(tiene_consumo_droga, false)
           and coalesce(cardinality(drogas), 0) > 0
      then especificacion_droga
      else null
    end,
    consumo_alcohol = case
      when tiene_consumo_alcohol = false then 'no_consume'::public.consumo_alcohol
      when tiene_consumo_alcohol = true then 'ocasional'::public.consumo_alcohol
      else null
    end;

alter table public.ficha_registro
  drop column tiene_consumo_droga,
  drop column tiene_consumo_alcohol;

alter table public.agresor
  drop column tiene_consumo_droga,
  drop column tiene_consumo_alcohol;

alter table public.ficha_registro
  add constraint ficha_registro_drogas_check
    check (
      drogas is null
      or not ('no_consume'::public.tipo_droga = any(drogas))
      or cardinality(drogas) = 1
    ),
  add constraint ficha_registro_especificacion_droga_consistencia_check
    check (
      especificacion_droga is null
      or (
        drogas is not null
        and cardinality(drogas) > 0
        and not ('no_consume'::public.tipo_droga = any(drogas))
      )
    );

alter table public.agresor
  add constraint agresor_drogas_check
    check (
      drogas is null
      or not ('no_consume'::public.tipo_droga = any(drogas))
      or cardinality(drogas) = 1
    ),
  add constraint agresor_especificacion_droga_consistencia_check
    check (
      especificacion_droga is null
      or (
        drogas is not null
        and cardinality(drogas) > 0
        and not ('no_consume'::public.tipo_droga = any(drogas))
      )
    );

-- ---------------------------------------------------------------------
-- 4. RPC: public.get_expediente_detalle(p_ficha_id, p_incluir_agresores)
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
      jsonb_agg(to_jsonb(ag) order by ag.creado_en),
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
-- 5. RPC: public.crear_ficha_completa(p_payload jsonb)
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

-- ---------------------------------------------------------------------
-- 6. RPC: public.actualizar_ficha
-- ---------------------------------------------------------------------
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
  p_servicios_solicitados_area_ids smallint[] default null
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
  actualizado_en               timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_ficha                public.ficha_registro%rowtype;
  v_ocupacion_id         smallint;
  v_ocupacion_otra       text;
  v_numero_hijas         smallint;
  v_numero_hijos_hombres smallint;
  v_servicio_medico      public.servicio_medico;
  v_servicio_medico_otro text;
  v_drogas               public.tipo_droga[];
  v_especificacion_droga text;
  v_area_ids             smallint[];
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para editar el expediente'
      using errcode = '42501';
  end if;

  if p_ficha_id is null or p_actualizado_en is null then
    raise exception 'El identificador del expediente y actualizado_en son obligatorios'
      using errcode = '23514';
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

  if p_ocupacion_id is not null then
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

  v_numero_hijas := coalesce(p_numero_hijas, v_ficha.numero_hijas);
  if v_numero_hijas is not null and (v_numero_hijas < 0 or v_numero_hijas > 30) then
    raise exception 'El número de hijas debe estar entre 0 y 30'
      using errcode = '23514';
  end if;

  v_numero_hijos_hombres := coalesce(p_numero_hijos_hombres, v_ficha.numero_hijos_hombres);
  if v_numero_hijos_hombres is not null and (v_numero_hijos_hombres < 0 or v_numero_hijos_hombres > 30) then
    raise exception 'El número de hijos debe estar entre 0 y 30'
      using errcode = '23514';
  end if;

  v_servicio_medico := coalesce(p_servicio_medico, v_ficha.servicio_medico);
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

  if p_drogas is null then
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
    set estado_civil          = coalesce(p_estado_civil, v_ficha.estado_civil),
        ocupacion_id          = v_ocupacion_id,
        ocupacion_otra        = v_ocupacion_otra,
        tiene_trabajo         = coalesce(p_tiene_trabajo, v_ficha.tiene_trabajo),
        numero_hijas          = v_numero_hijas,
        numero_hijos_hombres  = v_numero_hijos_hombres,
        servicio_medico       = v_servicio_medico,
        servicio_medico_otro  = v_servicio_medico_otro,
        tiene_embarazo        = coalesce(p_tiene_embarazo, v_ficha.tiene_embarazo),
        tiene_denuncia        = coalesce(p_tiene_denuncia, v_ficha.tiene_denuncia),
        es_victima_delito     = coalesce(p_es_victima_delito, v_ficha.es_victima_delito),
        drogas                = v_drogas,
        especificacion_droga  = v_especificacion_droga,
        consumo_alcohol       = coalesce(p_consumo_alcohol, v_ficha.consumo_alcohol)
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
    act.actualizado_en
  from actualizado act;
end;
$$;

revoke all on function public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, public.tipo_droga[],
  text, public.consumo_alcohol, smallint[]
) from public, anon;

grant execute on function public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, public.tipo_droga[],
  text, public.consumo_alcohol, smallint[]
) to authenticated;

-- ---------------------------------------------------------------------
-- 7. RPC: public.guardar_agresor
-- ---------------------------------------------------------------------
create or replace function public.guardar_agresor(
  p_agresor_id           uuid default null,
  p_ficha_id             uuid default null,
  p_actualizado_en       timestamptz default null,
  p_nombres              text default null,
  p_apellido_paterno     text default null,
  p_apellido_materno     text default null,
  p_edad                 smallint default null,
  p_fecha_nacimiento     date default null,
  p_entidad_nacimiento   text default null,
  p_sexo                 public.sexo_biologico default null,
  p_estado_civil         public.estado_civil default null,
  p_curp                 text default null,
  p_parentesco_id        smallint default null,
  p_parentesco_otro      text default null,
  p_asentamiento_id      integer default null,
  p_codigo_postal        text default null,
  p_calle                text default null,
  p_numero_exterior      text default null,
  p_numero_interior      text default null,
  p_referencias          text default null,
  p_zona                 public.zona_geografica default null,
  p_ocupacion_id         smallint default null,
  p_ocupacion_otra       text default null,
  p_tipo_trabajo         public.tipo_trabajo default null,
  p_drogas               public.tipo_droga[] default null,
  p_especificacion_droga text default null,
  p_consumo_alcohol      public.consumo_alcohol default null,
  p_especificacion_arma  text default null,
  p_observaciones        text default null
)
returns table (
  id                   uuid,
  ficha_id             uuid,
  nombres              text,
  apellido_paterno     text,
  apellido_materno     text,
  edad                 smallint,
  fecha_nacimiento     date,
  entidad_nacimiento   text,
  sexo                 public.sexo_biologico,
  estado_civil         public.estado_civil,
  curp                 text,
  parentesco_id        smallint,
  parentesco_otro      text,
  asentamiento_id      integer,
  codigo_postal        text,
  calle                text,
  numero_exterior      text,
  numero_interior      text,
  referencias          text,
  zona                 public.zona_geografica,
  ocupacion_id         smallint,
  ocupacion_otra       text,
  tipo_trabajo         public.tipo_trabajo,
  drogas               public.tipo_droga[],
  especificacion_droga text,
  consumo_alcohol      public.consumo_alcohol,
  especificacion_arma  text,
  observaciones        text,
  activo               boolean,
  actualizado_en       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_actual               public.agresor%rowtype;
  v_ficha_id             uuid;
  v_ficha                record;
  v_nombres              text;
  v_apellido_paterno     text;
  v_apellido_materno     text;
  v_edad                 smallint;
  v_fecha_nacimiento     date;
  v_entidad_nacimiento   text;
  v_curp                 text;
  v_parentesco_id        smallint;
  v_parentesco_clave     text;
  v_parentesco_otro      text;
  v_asentamiento_id      integer;
  v_codigo_postal        text;
  v_calle                text;
  v_numero_exterior      text;
  v_numero_interior      text;
  v_referencias          text;
  v_ocupacion_id         smallint;
  v_ocupacion_otra       text;
  v_drogas               public.tipo_droga[];
  v_especificacion_droga text;
  v_especificacion_arma  text;
  v_observaciones        text;
begin
  if not public.tiene_permiso('agresor.acceder') then
    raise exception 'Sin permiso para gestionar datos de la persona agresora'
      using errcode = '42501';
  end if;

  if p_agresor_id is null then
    if p_ficha_id is null then
      raise exception 'El expediente (p_ficha_id) es obligatorio al registrar agresor'
        using errcode = '23514';
    end if;
    v_ficha_id := p_ficha_id;

    v_nombres := nullif(btrim(coalesce(p_nombres, '')), '');
    if v_nombres is not null and char_length(v_nombres) > 100 then
      raise exception 'El nombre de la persona agresora no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  else
    if p_actualizado_en is null then
      raise exception 'actualizado_en es obligatorio al editar un agresor'
        using errcode = '23514';
    end if;

    select ag.*
    into v_actual
    from public.agresor ag
    where ag.id = p_agresor_id
      and ag.activo
    for update;

    if v_actual.id is null then
      raise exception 'Persona agresora no encontrada o inactiva'
        using errcode = '23514';
    end if;

    if p_ficha_id is not null and p_ficha_id is distinct from v_actual.ficha_id then
      raise exception 'No se puede cambiar el expediente asociado al agresor'
        using errcode = '23514';
    end if;

    v_ficha_id := v_actual.ficha_id;
  end if;

  select fr.id, fr.estado
  into v_ficha
  from public.ficha_registro fr
  where fr.id = v_ficha_id
    and fr.activo;

  if v_ficha.id is null then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  if p_agresor_id is not null and v_actual.actualizado_en is distinct from p_actualizado_en then
    raise exception 'Este registro fue modificado por otra persona. Recarga los datos.'
      using errcode = '23505';
  end if;

  if p_agresor_id is not null then
    if p_nombres is not null then
      v_nombres := nullif(btrim(p_nombres), '');
      if v_nombres is not null and char_length(v_nombres) > 100 then
        raise exception 'El nombre de la persona agresora no debe exceder 100 caracteres'
          using errcode = '23514';
      end if;
    else
      v_nombres := v_actual.nombres;
    end if;
  end if;

  if p_apellido_paterno is null then
    v_apellido_paterno := v_actual.apellido_paterno;
  else
    v_apellido_paterno := nullif(btrim(p_apellido_paterno), '');
    if v_apellido_paterno is not null and char_length(v_apellido_paterno) > 100 then
      raise exception 'El apellido paterno no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_apellido_materno is null then
    v_apellido_materno := v_actual.apellido_materno;
  else
    v_apellido_materno := nullif(btrim(p_apellido_materno), '');
    if v_apellido_materno is not null and char_length(v_apellido_materno) > 100 then
      raise exception 'El apellido materno no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  v_edad := coalesce(p_edad, v_actual.edad);
  if v_edad is not null and (v_edad < 0 or v_edad > 120) then
    raise exception 'La edad debe estar entre 0 y 120 años'
      using errcode = '23514';
  end if;

  v_fecha_nacimiento := coalesce(p_fecha_nacimiento, v_actual.fecha_nacimiento);
  if v_fecha_nacimiento is not null and v_fecha_nacimiento > current_date then
    raise exception 'La fecha de nacimiento no puede ser futura'
      using errcode = '23514';
  end if;

  if p_entidad_nacimiento is null then
    v_entidad_nacimiento := v_actual.entidad_nacimiento;
  else
    v_entidad_nacimiento := nullif(upper(btrim(p_entidad_nacimiento)), '');
    if v_entidad_nacimiento is not null and v_entidad_nacimiento not in (
      'AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG',
      'JC','MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR',
      'TC','TS','TL','VZ','YN','ZS','NE'
    ) then
      raise exception 'Clave de entidad de nacimiento inválida'
        using errcode = '23514';
    end if;
  end if;

  if p_curp is null then
    v_curp := v_actual.curp;
  else
    v_curp := nullif(upper(btrim(p_curp)), '');
    if v_curp is not null and v_curp !~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$' then
      raise exception 'La CURP no tiene un formato válido'
        using errcode = '23514';
    end if;
  end if;

  if p_parentesco_id is not null then
    select cp.clave
    into v_parentesco_clave
    from public.cat_parentesco cp
    where cp.id = p_parentesco_id;

    if v_parentesco_clave is null then
      raise exception 'Parentesco no encontrado en catálogo'
        using errcode = '23514';
    end if;
    v_parentesco_id := p_parentesco_id;
  else
    v_parentesco_id := v_actual.parentesco_id;
    if v_parentesco_id is not null then
      select cp.clave
      into v_parentesco_clave
      from public.cat_parentesco cp
      where cp.id = v_parentesco_id;
    end if;
  end if;

  if p_parentesco_otro is null then
    v_parentesco_otro := v_actual.parentesco_otro;
  else
    v_parentesco_otro := nullif(btrim(p_parentesco_otro), '');
    if v_parentesco_otro is not null and char_length(v_parentesco_otro) > 120 then
      raise exception 'La especificación de parentesco no debe exceder 120 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_parentesco_clave is distinct from 'otro' then
    if p_parentesco_otro is not null and v_parentesco_otro is not null then
      raise exception 'Solo especifica otro parentesco cuando el parentesco sea "otro"'
        using errcode = '23514';
    end if;
    v_parentesco_otro := null;
  end if;

  if p_codigo_postal is null then
    v_codigo_postal := null;
  else
    v_codigo_postal := nullif(btrim(p_codigo_postal), '');
    if v_codigo_postal is not null and v_codigo_postal !~ '^[0-9]{5}$' then
      raise exception 'El código postal debe contener exactamente 5 dígitos'
        using errcode = '23514';
    end if;
  end if;

  if p_asentamiento_id is not null and v_codigo_postal is not null then
    raise exception 'Indica un asentamiento del catálogo o un código postal manual, no ambos'
      using errcode = '23514';
  elsif p_asentamiento_id is not null then
    if not exists (
      select 1
      from public.cat_asentamiento ca
      where ca.id = p_asentamiento_id
    ) then
      raise exception 'Asentamiento no encontrado en catálogo'
        using errcode = '23514';
    end if;
    v_asentamiento_id := p_asentamiento_id;
    v_codigo_postal   := null;
  elsif p_codigo_postal is not null then
    if v_codigo_postal is not null then
      v_asentamiento_id := null;
    else
      v_asentamiento_id := v_actual.asentamiento_id;
    end if;
  else
    v_asentamiento_id := v_actual.asentamiento_id;
    v_codigo_postal   := v_actual.codigo_postal;
  end if;

  if p_calle is null then
    v_calle := v_actual.calle;
  else
    v_calle := nullif(btrim(p_calle), '');
    if v_calle is not null and char_length(v_calle) > 150 then
      raise exception 'La calle no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_numero_exterior is null then
    v_numero_exterior := v_actual.numero_exterior;
  else
    v_numero_exterior := nullif(btrim(p_numero_exterior), '');
    if v_numero_exterior is not null and char_length(v_numero_exterior) > 30 then
      raise exception 'El número exterior no debe exceder 30 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_numero_interior is null then
    v_numero_interior := v_actual.numero_interior;
  else
    v_numero_interior := nullif(btrim(p_numero_interior), '');
    if v_numero_interior is not null and char_length(v_numero_interior) > 30 then
      raise exception 'El número interior no debe exceder 30 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_referencias is null then
    v_referencias := v_actual.referencias;
  else
    v_referencias := nullif(btrim(p_referencias), '');
    if v_referencias is not null and char_length(v_referencias) > 250 then
      raise exception 'Las referencias no deben exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_ocupacion_id is not null then
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
    v_ocupacion_id := v_actual.ocupacion_id;
  end if;

  if p_ocupacion_otra is null then
    v_ocupacion_otra := v_actual.ocupacion_otra;
  else
    v_ocupacion_otra := nullif(btrim(p_ocupacion_otra), '');
    if v_ocupacion_otra is not null and char_length(v_ocupacion_otra) > 150 then
      raise exception 'La especificación de ocupación no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_drogas is null then
    v_drogas := v_actual.drogas;
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
    v_especificacion_droga := v_actual.especificacion_droga;
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

  if p_especificacion_arma is null then
    v_especificacion_arma := v_actual.especificacion_arma;
  else
    v_especificacion_arma := nullif(btrim(p_especificacion_arma), '');
    if v_especificacion_arma is not null and char_length(v_especificacion_arma) > 250 then
      raise exception 'La especificación de arma no debe exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_observaciones is null then
    v_observaciones := v_actual.observaciones;
  else
    v_observaciones := nullif(btrim(p_observaciones), '');
    if v_observaciones is not null and char_length(v_observaciones) > 5000 then
      raise exception 'Las observaciones no deben exceder 5000 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_agresor_id is null then
    return query
    insert into public.agresor as ag (
      ficha_id,
      nombres,
      apellido_paterno,
      apellido_materno,
      edad,
      fecha_nacimiento,
      entidad_nacimiento,
      sexo,
      estado_civil,
      curp,
      parentesco_id,
      parentesco_otro,
      asentamiento_id,
      codigo_postal,
      calle,
      numero_exterior,
      numero_interior,
      referencias,
      zona,
      ocupacion_id,
      ocupacion_otra,
      tipo_trabajo,
      drogas,
      especificacion_droga,
      consumo_alcohol,
      especificacion_arma,
      observaciones,
      creado_por
    ) values (
      v_ficha_id,
      v_nombres,
      v_apellido_paterno,
      v_apellido_materno,
      v_edad,
      v_fecha_nacimiento,
      v_entidad_nacimiento,
      p_sexo,
      p_estado_civil,
      v_curp,
      v_parentesco_id,
      v_parentesco_otro,
      v_asentamiento_id,
      v_codigo_postal,
      v_calle,
      v_numero_exterior,
      v_numero_interior,
      v_referencias,
      p_zona,
      v_ocupacion_id,
      v_ocupacion_otra,
      p_tipo_trabajo,
      v_drogas,
      v_especificacion_droga,
      p_consumo_alcohol,
      v_especificacion_arma,
      v_observaciones,
      v_actor_id
    )
    returning ag.id, ag.ficha_id, ag.nombres, ag.apellido_paterno, ag.apellido_materno,
              ag.edad, ag.fecha_nacimiento, ag.entidad_nacimiento, ag.sexo, ag.estado_civil,
              ag.curp, ag.parentesco_id, ag.parentesco_otro, ag.asentamiento_id,
              ag.codigo_postal, ag.calle, ag.numero_exterior, ag.numero_interior,
              ag.referencias, ag.zona, ag.ocupacion_id, ag.ocupacion_otra,
              ag.tipo_trabajo, ag.drogas, ag.especificacion_droga,
              ag.consumo_alcohol, ag.especificacion_arma, ag.observaciones,
              ag.activo, ag.actualizado_en;
  else
    return query
    update public.agresor ag
    set nombres              = v_nombres,
        apellido_paterno     = v_apellido_paterno,
        apellido_materno     = v_apellido_materno,
        edad                 = v_edad,
        fecha_nacimiento     = v_fecha_nacimiento,
        entidad_nacimiento   = v_entidad_nacimiento,
        sexo                 = coalesce(p_sexo, v_actual.sexo),
        estado_civil         = coalesce(p_estado_civil, v_actual.estado_civil),
        curp                 = v_curp,
        parentesco_id        = v_parentesco_id,
        parentesco_otro      = v_parentesco_otro,
        asentamiento_id      = v_asentamiento_id,
        codigo_postal        = v_codigo_postal,
        calle                = v_calle,
        numero_exterior      = v_numero_exterior,
        numero_interior      = v_numero_interior,
        referencias          = v_referencias,
        zona                 = coalesce(p_zona, v_actual.zona),
        ocupacion_id         = v_ocupacion_id,
        ocupacion_otra       = v_ocupacion_otra,
        tipo_trabajo         = coalesce(p_tipo_trabajo, v_actual.tipo_trabajo),
        drogas               = v_drogas,
        especificacion_droga = v_especificacion_droga,
        consumo_alcohol      = coalesce(p_consumo_alcohol, v_actual.consumo_alcohol),
        especificacion_arma  = v_especificacion_arma,
        observaciones        = v_observaciones
    where ag.id = p_agresor_id
    returning ag.id, ag.ficha_id, ag.nombres, ag.apellido_paterno, ag.apellido_materno,
              ag.edad, ag.fecha_nacimiento, ag.entidad_nacimiento, ag.sexo, ag.estado_civil,
              ag.curp, ag.parentesco_id, ag.parentesco_otro, ag.asentamiento_id,
              ag.codigo_postal, ag.calle, ag.numero_exterior, ag.numero_interior,
              ag.referencias, ag.zona, ag.ocupacion_id, ag.ocupacion_otra,
              ag.tipo_trabajo, ag.drogas, ag.especificacion_droga,
              ag.consumo_alcohol, ag.especificacion_arma, ag.observaciones,
              ag.activo, ag.actualizado_en;
  end if;
end;
$$;

revoke all on function public.guardar_agresor(
  uuid, uuid, timestamptz, text, text, text, smallint, date, text,
  public.sexo_biologico, public.estado_civil, text, smallint, text, integer,
  text, text, text, text, text, public.zona_geografica, smallint, text,
  public.tipo_trabajo, public.tipo_droga[], text, public.consumo_alcohol, text, text
) from public, anon;

grant execute on function public.guardar_agresor(
  uuid, uuid, timestamptz, text, text, text, smallint, date, text,
  public.sexo_biologico, public.estado_civil, text, smallint, text, integer,
  text, text, text, text, text, public.zona_geografica, smallint, text,
  public.tipo_trabajo, public.tipo_droga[], text, public.consumo_alcohol, text, text
) to authenticated;
