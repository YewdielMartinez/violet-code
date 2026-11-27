-- =====================================================================
-- 37_rpc_historial_clinico_y_estudio.sql (A-05 · Sprint 02)
-- Qué contiene:
--   1. RPC public.guardar_historial_clinico(p_ficha_id, p_actualizado_en, ...):
--      - Permiso 'historial_clinico.acceder' (42501).
--      - Valida expediente activo y no archivado (23514), y mayoría de edad
--        >= 18 años en America/Mazatlan (RN-01, 23514).
--      - Crea si no existe; si existe exige p_actualizado_en coincidente
--        (23505) y aplica null = no cambiar / '' = borrar opcional.
--   2. RPC public.get_historial_clinico(p_ficha_id):
--      - Permiso 'historial_clinico.acceder' (42501).
--      - Registra 'ver' en public.bitacora_acceso ('historial_clinico').
--   3. RPC public.registrar_estudio_socioeconomico(p_ficha_id, ..., p_aportantes):
--      - Permiso 'expediente.escribir' (42501).
--      - Si ya existe estudio actual de hoy (America/Mazatlan) creado por
--        el mismo actor (auth.uid()), lo corrige en lugar de crear otro y
--        reemplaza (desactiva) sus aportantes; en otro caso desmarca el
--        anterior (es_actual = false) y crea una nueva versión con sus
--        aportantes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RPC: public.guardar_historial_clinico
-- ---------------------------------------------------------------------
create or replace function public.guardar_historial_clinico(
  p_ficha_id                          uuid,
  p_actualizado_en                    timestamptz default null,
  p_antecedentes_familiares           text default null,
  p_antecedentes_personales           text default null,
  p_motivo_consulta                   text default null,
  p_observaciones_iniciales           text default null,
  p_tiene_atencion_psicologica_previa boolean default null
)
returns table (
  id                                uuid,
  ficha_id                          uuid,
  antecedentes_familiares           text,
  antecedentes_personales           text,
  motivo_consulta                   text,
  observaciones_iniciales           text,
  tiene_atencion_psicologica_previa boolean,
  actualizado_en                    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id                uuid := auth.uid();
  v_ficha                   record;
  v_actual                  public.historial_clinico%rowtype;
  v_fecha_hoy               date;
  v_antecedentes_fam        text;
  v_antecedentes_per        text;
  v_motivo_consulta         text;
  v_observaciones_iniciales text;
begin
  if not public.tiene_permiso('historial_clinico.acceder') then
    raise exception 'Sin permiso para guardar historial clínico'
      using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente (p_ficha_id) es obligatorio'
      using errcode = '23514';
  end if;

  select fr.id, fr.estado, p.fecha_nacimiento
  into v_ficha
  from public.ficha_registro fr
  join public.persona p on p.id = fr.persona_id
  where fr.id = p_ficha_id
    and fr.activo
    and p.activo
  for update of fr;

  if v_ficha.id is null then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  v_fecha_hoy := (now() at time zone 'America/Mazatlan')::date;
  if v_ficha.fecha_nacimiento is not null
     and v_ficha.fecha_nacimiento > (v_fecha_hoy - interval '18 years')::date then
    raise exception 'Psicología solo atiende a personas mayores de 18 años (RN-01)'
      using errcode = '23514';
  end if;

  select hc.*
  into v_actual
  from public.historial_clinico hc
  where hc.ficha_id = p_ficha_id
  for update;

  if v_actual.id is not null then
    if not v_actual.activo then
      raise exception 'El historial clínico del expediente está inactivo'
        using errcode = '23514';
    end if;

    if p_actualizado_en is null or v_actual.actualizado_en is distinct from p_actualizado_en then
      raise exception 'Este registro fue modificado por otra persona. Recarga los datos.'
        using errcode = '23505';
    end if;
  end if;

  if p_antecedentes_familiares is null then
    v_antecedentes_fam := v_actual.antecedentes_familiares;
  else
    v_antecedentes_fam := nullif(btrim(p_antecedentes_familiares), '');
    if v_antecedentes_fam is not null and char_length(v_antecedentes_fam) > 5000 then
      raise exception 'Los antecedentes familiares no deben exceder 5000 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_antecedentes_personales is null then
    v_antecedentes_per := v_actual.antecedentes_personales;
  else
    v_antecedentes_per := nullif(btrim(p_antecedentes_personales), '');
    if v_antecedentes_per is not null and char_length(v_antecedentes_per) > 5000 then
      raise exception 'Los antecedentes personales no deben exceder 5000 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_motivo_consulta is null then
    v_motivo_consulta := v_actual.motivo_consulta;
  else
    v_motivo_consulta := nullif(btrim(p_motivo_consulta), '');
    if v_motivo_consulta is not null and char_length(v_motivo_consulta) > 5000 then
      raise exception 'El motivo de consulta no debe exceder 5000 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_observaciones_iniciales is null then
    v_observaciones_iniciales := v_actual.observaciones_iniciales;
  else
    v_observaciones_iniciales := nullif(btrim(p_observaciones_iniciales), '');
    if v_observaciones_iniciales is not null and char_length(v_observaciones_iniciales) > 5000 then
      raise exception 'Las observaciones iniciales no deben exceder 5000 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_actual.id is null then
    return query
    insert into public.historial_clinico as hc (
      ficha_id,
      antecedentes_familiares,
      antecedentes_personales,
      motivo_consulta,
      observaciones_iniciales,
      tiene_atencion_psicologica_previa,
      creado_por
    ) values (
      p_ficha_id,
      v_antecedentes_fam,
      v_antecedentes_per,
      v_motivo_consulta,
      v_observaciones_iniciales,
      p_tiene_atencion_psicologica_previa,
      v_actor_id
    )
    returning hc.id,
              hc.ficha_id,
              hc.antecedentes_familiares,
              hc.antecedentes_personales,
              hc.motivo_consulta,
              hc.observaciones_iniciales,
              hc.tiene_atencion_psicologica_previa,
              hc.actualizado_en;
  else
    return query
    update public.historial_clinico hc
    set antecedentes_familiares           = v_antecedentes_fam,
        antecedentes_personales           = v_antecedentes_per,
        motivo_consulta                   = v_motivo_consulta,
        observaciones_iniciales           = v_observaciones_iniciales,
        tiene_atencion_psicologica_previa = coalesce(
          p_tiene_atencion_psicologica_previa,
          v_actual.tiene_atencion_psicologica_previa
        )
    where hc.id = v_actual.id
    returning hc.id,
              hc.ficha_id,
              hc.antecedentes_familiares,
              hc.antecedentes_personales,
              hc.motivo_consulta,
              hc.observaciones_iniciales,
              hc.tiene_atencion_psicologica_previa,
              hc.actualizado_en;
  end if;
end;
$$;

revoke all on function public.guardar_historial_clinico(
  uuid, timestamptz, text, text, text, text, boolean
) from public, anon;

grant execute on function public.guardar_historial_clinico(
  uuid, timestamptz, text, text, text, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC: public.get_historial_clinico
-- ---------------------------------------------------------------------
create or replace function public.get_historial_clinico(p_ficha_id uuid)
returns table (
  id                                uuid,
  ficha_id                          uuid,
  antecedentes_familiares           text,
  antecedentes_personales           text,
  motivo_consulta                   text,
  observaciones_iniciales           text,
  tiene_atencion_psicologica_previa boolean,
  creado_en                         timestamptz,
  actualizado_en                    timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_hc_id    uuid;
begin
  if not public.tiene_permiso('historial_clinico.acceder') then
    raise exception 'Sin permiso para consultar historial clínico'
      using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente (p_ficha_id) es obligatorio'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.ficha_registro fr
    where fr.id = p_ficha_id
      and fr.activo
  ) then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  select hc.id
  into v_hc_id
  from public.historial_clinico hc
  where hc.ficha_id = p_ficha_id
    and hc.activo
  limit 1;

  insert into public.bitacora_acceso (
    empleado_id,
    accion,
    tabla_afectada,
    registro_id
  ) values (
    v_actor_id,
    'ver',
    'historial_clinico',
    coalesce(v_hc_id, p_ficha_id)::text
  );

  return query
  select
    hc.id,
    hc.ficha_id,
    hc.antecedentes_familiares,
    hc.antecedentes_personales,
    hc.motivo_consulta,
    hc.observaciones_iniciales,
    hc.tiene_atencion_psicologica_previa,
    hc.creado_en,
    hc.actualizado_en
  from public.historial_clinico hc
  where hc.ficha_id = p_ficha_id
    and hc.activo;
end;
$$;

revoke all on function public.get_historial_clinico(uuid) from public, anon;
grant  execute on function public.get_historial_clinico(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC: public.registrar_estudio_socioeconomico
-- ---------------------------------------------------------------------
create or replace function public.registrar_estudio_socioeconomico(
  p_ficha_id               uuid,
  p_ingreso_mensual_propio numeric default null,
  p_numero_dependientes    smallint default null,
  p_tiene_apoyo            boolean default false,
  p_especificacion_apoyo   text default null,
  p_tipo_vivienda          public.tipo_vivienda default null,
  p_material               public.material_vivienda default null,
  p_material_otro          text default null,
  p_servicios              public.servicio_vivienda[] default null,
  p_bienes                 public.bien_vivienda[] default null,
  p_aportantes             jsonb default '[]'::jsonb
)
returns table (
  estudio_id     uuid,
  ficha_id       uuid,
  fecha_estudio  date,
  es_actual      boolean,
  fue_correccion boolean,
  actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_ficha_estado         public.estado_ficha;
  v_hoy                  date := (now() at time zone 'America/Mazatlan')::date;
  v_tiene_apoyo          boolean := coalesce(p_tiene_apoyo, false);
  v_especificacion_apoyo text;
  v_material_otro        text;
  v_servicios            public.servicio_vivienda[];
  v_bienes               public.bien_vivienda[];
  v_estudio_actual       public.estudio_socioeconomico%rowtype;
  v_estudio_id           uuid;
  v_actualizado_en       timestamptz;
  v_fue_correccion       boolean := false;
  v_aportante            jsonb;
  v_ap_nombre            text;
  v_ap_parentesco_id     smallint;
  v_ap_parentesco_otro   text;
  v_ap_ocupacion_id      smallint;
  v_ap_ocupacion_otra    text;
  v_ap_tipo_trabajo      public.tipo_trabajo;
  v_ap_monto             numeric(10, 2);
  v_ap_frecuencia        public.frecuencia_ingreso;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para registrar estudio socioeconómico'
      using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente (p_ficha_id) es obligatorio'
      using errcode = '23514';
  end if;

  select fr.estado
  into v_ficha_estado
  from public.ficha_registro fr
  where fr.id = p_ficha_id
    and fr.activo
  for update;

  if v_ficha_estado is null then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  if v_ficha_estado = 'archivado' then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  if p_ingreso_mensual_propio is not null
     and (p_ingreso_mensual_propio < 0 or p_ingreso_mensual_propio > 9999999.99) then
    raise exception 'El ingreso mensual propio debe estar entre 0 y 9999999.99'
      using errcode = '23514';
  end if;

  if p_numero_dependientes is not null
     and (p_numero_dependientes < 0 or p_numero_dependientes > 30) then
    raise exception 'El número de dependientes debe estar entre 0 y 30'
      using errcode = '23514';
  end if;

  v_especificacion_apoyo := nullif(btrim(coalesce(p_especificacion_apoyo, '')), '');
  if v_especificacion_apoyo is not null and char_length(v_especificacion_apoyo) > 250 then
    raise exception 'La especificación de apoyo no debe exceder 250 caracteres'
      using errcode = '23514';
  end if;
  if not v_tiene_apoyo and v_especificacion_apoyo is not null then
    raise exception 'No puedes especificar apoyo cuando tiene_apoyo es falso'
      using errcode = '23514';
  end if;

  v_material_otro := nullif(btrim(coalesce(p_material_otro, '')), '');
  if v_material_otro is not null and char_length(v_material_otro) > 120 then
    raise exception 'La especificación de material no debe exceder 120 caracteres'
      using errcode = '23514';
  end if;
  if p_material is distinct from 'otro'::public.material_vivienda and v_material_otro is not null then
    raise exception 'Solo especifica otro material cuando el material sea "otro"'
      using errcode = '23514';
  end if;

  if p_aportantes is not null and jsonb_typeof(p_aportantes) <> 'array' then
    raise exception 'p_aportantes debe ser un arreglo JSON'
      using errcode = '23514';
  end if;

  if p_servicios is not null then
    select array_agg(s_item order by idx)
    into v_servicios
    from (
      select distinct on (elem) elem as s_item, min(ord) as idx
      from unnest(p_servicios) with ordinality as u(elem, ord)
      where elem is not null
      group by elem
    ) s;
  end if;

  if p_bienes is not null then
    select array_agg(b_item order by idx)
    into v_bienes
    from (
      select distinct on (elem) elem as b_item, min(ord) as idx
      from unnest(p_bienes) with ordinality as u(elem, ord)
      where elem is not null
      group by elem
    ) s;
  end if;

  select es.*
  into v_estudio_actual
  from public.estudio_socioeconomico es
  where es.ficha_id = p_ficha_id
    and es.activo
    and es.es_actual
  for update;

  if v_estudio_actual.id is not null
     and v_estudio_actual.fecha_estudio = v_hoy
     and v_estudio_actual.creado_por is not distinct from v_actor_id then
    -- Corrección del estudio creado hoy por la misma persona
    v_fue_correccion := true;

    update public.estudio_socioeconomico es
    set ingreso_mensual_propio = round(p_ingreso_mensual_propio, 2),
        numero_dependientes    = p_numero_dependientes,
        tiene_apoyo            = v_tiene_apoyo,
        especificacion_apoyo   = v_especificacion_apoyo,
        tipo_vivienda          = p_tipo_vivienda,
        material               = p_material,
        material_otro          = v_material_otro,
        servicios              = case when coalesce(cardinality(v_servicios), 0) > 0 then v_servicios else null end,
        bienes                 = case when coalesce(cardinality(v_bienes), 0) > 0 then v_bienes else null end
    where es.id = v_estudio_actual.id
    returning es.id, es.actualizado_en
    into v_estudio_id, v_actualizado_en;

    update public.aportante_hogar ah
    set activo = false
    where ah.estudio_socioeconomico_id = v_estudio_id
      and ah.activo;
  else
    -- Nueva versión histórica: desmarca el estudio actual previo
    if v_estudio_actual.id is not null then
      update public.estudio_socioeconomico es
      set es_actual = false
      where es.id = v_estudio_actual.id;
    end if;

    insert into public.estudio_socioeconomico as es (
      ficha_id,
      fecha_estudio,
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
      p_ficha_id,
      v_hoy,
      true,
      round(p_ingreso_mensual_propio, 2),
      p_numero_dependientes,
      v_tiene_apoyo,
      v_especificacion_apoyo,
      p_tipo_vivienda,
      p_material,
      v_material_otro,
      case when coalesce(cardinality(v_servicios), 0) > 0 then v_servicios else null end,
      case when coalesce(cardinality(v_bienes), 0) > 0 then v_bienes else null end,
      v_actor_id
    )
    returning es.id, es.actualizado_en
    into v_estudio_id, v_actualizado_en;
  end if;

  for v_aportante in
    select value from jsonb_array_elements(coalesce(p_aportantes, '[]'::jsonb))
  loop
    v_ap_nombre := btrim(coalesce(v_aportante ->> 'nombre', ''));
    if char_length(v_ap_nombre) < 1 or char_length(v_ap_nombre) > 150 then
      raise exception 'Cada aportante debe tener un nombre entre 1 y 150 caracteres'
        using errcode = '23514';
    end if;

    v_ap_parentesco_id := nullif(btrim(coalesce(v_aportante ->> 'parentesco_id', v_aportante ->> 'parentescoId', '')), '')::smallint;
    if v_ap_parentesco_id is not null and not exists (select 1 from public.cat_parentesco cp where cp.id = v_ap_parentesco_id) then
      raise exception 'Parentesco de aportante no encontrado en catálogo' using errcode = '23514';
    end if;

    v_ap_parentesco_otro := nullif(btrim(coalesce(v_aportante ->> 'parentesco_otro', v_aportante ->> 'parentescoOtro', '')), '');
    if v_ap_parentesco_otro is not null and char_length(v_ap_parentesco_otro) > 120 then
      raise exception 'El parentesco específico del aportante no debe exceder 120 caracteres' using errcode = '23514';
    end if;

    v_ap_ocupacion_id := nullif(btrim(coalesce(v_aportante ->> 'ocupacion_id', v_aportante ->> 'ocupacionId', '')), '')::smallint;
    if v_ap_ocupacion_id is not null and not exists (select 1 from public.cat_ocupacion co where co.id = v_ap_ocupacion_id) then
      raise exception 'Ocupación de aportante no encontrada en catálogo' using errcode = '23514';
    end if;

    v_ap_ocupacion_otra := nullif(btrim(coalesce(v_aportante ->> 'ocupacion_otra', v_aportante ->> 'ocupacionOtra', '')), '');
    if v_ap_ocupacion_otra is not null and char_length(v_ap_ocupacion_otra) > 150 then
      raise exception 'La ocupación específica del aportante no debe exceder 150 caracteres' using errcode = '23514';
    end if;

    v_ap_tipo_trabajo := nullif(btrim(coalesce(v_aportante ->> 'tipo_trabajo', v_aportante ->> 'tipoTrabajo', '')), '')::public.tipo_trabajo;
    v_ap_monto        := nullif(btrim(coalesce(v_aportante ->> 'monto', '')), '')::numeric(10, 2);
    if v_ap_monto is not null and (v_ap_monto < 0 or v_ap_monto > 9999999.99) then
      raise exception 'El monto del aportante debe estar entre 0 y 9999999.99' using errcode = '23514';
    end if;
    v_ap_frecuencia := nullif(btrim(coalesce(v_aportante ->> 'frecuencia', '')), '')::public.frecuencia_ingreso;

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
      v_ap_nombre,
      v_ap_parentesco_id,
      v_ap_parentesco_otro,
      v_ap_ocupacion_id,
      v_ap_ocupacion_otra,
      v_ap_tipo_trabajo,
      v_ap_monto,
      v_ap_frecuencia,
      v_actor_id
    );
  end loop;

  return query select v_estudio_id, p_ficha_id, v_hoy, true, v_fue_correccion, v_actualizado_en;
end;
$$;

revoke all on function public.registrar_estudio_socioeconomico(
  uuid, numeric, smallint, boolean, text, public.tipo_vivienda,
  public.material_vivienda, text, public.servicio_vivienda[], public.bien_vivienda[], jsonb
) from public, anon;

grant execute on function public.registrar_estudio_socioeconomico(
  uuid, numeric, smallint, boolean, text, public.tipo_vivienda,
  public.material_vivienda, text, public.servicio_vivienda[], public.bien_vivienda[], jsonb
) to authenticated;
