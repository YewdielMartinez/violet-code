-- =====================================================================
-- 75_historial_clinico_autora.sql (Tarjeta #188)
-- Historial clínico visible y editable únicamente para la psicóloga que
-- lo creó (creado_por = auth.uid()).
--
-- Qué contiene:
--   1. tiene_permiso(): redefinida desde 71 conservando todas las claves;
--      historial_clinico.acceder pasa a ser exclusivo de 'psicologia'
--      (Titular y Subdirección dejan de tener acceso).
--   2. Helper es_autora_historial(p_ficha_id): true si no existe
--      historial activo o si creado_por = auth.uid().
--   3. Backfill de creado_por nulo desde versión 1 (si existiera).
--   4. get_historial_clinico, get_historial_clinico_versiones y
--      guardar_historial_clinico: validan autoría (42501 si pertenece a
--      otra psicóloga).
--   5. RLS en historial_clinico (select/update) y
--      historial_clinico_version (select) restringidas a creado_por = auth.uid().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. tiene_permiso(): historial_clinico.acceder solo Psicología
--    (conserva todas las claves de la migración 71).
-- ---------------------------------------------------------------------
create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(case p_permiso
    -- Administración y catálogos
    when 'catalogos.gestionar'        then public.es_direccion()
    when 'directorio.gestionar'       then public.es_direccion()
    when 'cuentas.gestionar'          then public.es_direccion()
    when 'bitacora.ver'               then public.es_direccion()

    -- Expedientes y atención
    when 'expediente.escribir'        then public.es_direccion() or public.auth_rol() = 'trabajo_social'
    when 'expediente.ver'             then public.es_direccion() or public.es_area_atencion()
    when 'expediente.verificar_curp'  then public.es_empleado_activo()
    when 'expediente.reabrir'         then public.es_direccion()
    when 'seguimiento.registrar'      then public.es_area_atencion()
    when 'seguimiento.corregir'       then public.es_direccion() or public.es_area_atencion()
    when 'agresor.acceder'            then public.es_direccion() or public.es_area_atencion()
    when 'historial_clinico.acceder'  then public.auth_rol() = 'psicologia'
    when 'historial_clinico.escribir' then public.auth_rol() = 'psicologia'
    when 'nota_psicologia.acceder'    then public.auth_rol() = 'psicologia'
    when 'orden_proteccion.escribir'  then public.es_direccion() or public.auth_rol() in ('juridico', 'trabajo_social')

    -- Agenda, urgencias y derivaciones (canalizaciones)
    when 'agenda.ver'                 then public.es_empleado_activo()
    when 'agenda.gestionar'           then public.es_empleado_activo()
    when 'agenda.crear'               then public.es_direccion() or public.auth_rol() in ('recepcion', 'juridico', 'psicologia')
    when 'urgencias.ver'              then public.es_direccion() or public.auth_rol() in ('trabajo_social', 'psicologia', 'recepcion')
    when 'derivacion.gestionar'       then public.es_direccion() or public.es_area_atencion()
    when 'canalizacion.crear'         then public.auth_rol() = 'trabajo_social'

    -- Alertas 24/7
    when 'alerta.atender'             then public.es_linea_24_7()
    when 'alerta.ver_cola'            then public.es_linea_24_7() or public.auth_rol() in ('trabajo_social', 'psicologia')

    -- Actividades preventivas e informes
    when 'actividad.ver'              then public.es_empleado_activo()
    when 'actividad.registrar'        then public.es_direccion() or public.es_area_atencion()
    when 'informe.ver'                then public.es_direccion() or public.es_area_atencion()

    else false
  end, false);
$$;

revoke all on function public.tiene_permiso(text) from public, anon;
grant execute on function public.tiene_permiso(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Helper: es_autora_historial(p_ficha_id)
-- ---------------------------------------------------------------------
create or replace function public.es_autora_historial(p_ficha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.historial_clinico hc
    where hc.ficha_id = p_ficha_id
      and hc.activo
  )
  or exists (
    select 1
    from public.historial_clinico hc
    where hc.ficha_id = p_ficha_id
      and hc.activo
      and hc.creado_por = auth.uid()
  );
$$;

revoke all on function public.es_autora_historial(uuid) from public, anon;
grant execute on function public.es_autora_historial(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Backfill de creado_por nulo usando la versión 1 si existe
-- ---------------------------------------------------------------------
update public.historial_clinico hc
set creado_por = v.creado_por
from public.historial_clinico_version v
where v.historial_clinico_id = hc.id
  and v.version = 1
  and hc.creado_por is null
  and v.creado_por is not null;

-- ---------------------------------------------------------------------
-- 4. RPC: public.get_historial_clinico (solo autora)
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
  v_actor_id   uuid := auth.uid();
  v_hc_id      uuid;
  v_creado_por uuid;
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

  select hc.id, hc.creado_por
  into v_hc_id, v_creado_por
  from public.historial_clinico hc
  where hc.ficha_id = p_ficha_id
    and hc.activo
  limit 1;

  if v_hc_id is not null and v_creado_por is distinct from v_actor_id then
    raise exception 'Este historial clínico pertenece a otra psicóloga'
      using errcode = '42501';
  end if;

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
    and hc.activo
    and hc.creado_por = v_actor_id;
end;
$$;

revoke all on function public.get_historial_clinico(uuid) from public, anon;
grant execute on function public.get_historial_clinico(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: public.get_historial_clinico_versiones (solo autora)
-- ---------------------------------------------------------------------
create or replace function public.get_historial_clinico_versiones(p_ficha_id uuid)
returns table (
  id                                uuid,
  historial_clinico_id              uuid,
  ficha_id                          uuid,
  version                           integer,
  antecedentes_familiares           text,
  antecedentes_personales           text,
  motivo_consulta                   text,
  observaciones_iniciales           text,
  tiene_atencion_psicologica_previa boolean,
  campos_modificados                text[],
  creado_por                        uuid,
  creado_por_nombre                 text,
  creado_en                         timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor_id   uuid := auth.uid();
  v_hc_id      uuid;
  v_creado_por uuid;
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

  select hc.id, hc.creado_por
  into v_hc_id, v_creado_por
  from public.historial_clinico hc
  where hc.ficha_id = p_ficha_id
    and hc.activo
  limit 1;

  if v_hc_id is not null and v_creado_por is distinct from v_actor_id then
    raise exception 'Este historial clínico pertenece a otra psicóloga'
      using errcode = '42501';
  end if;

  insert into public.bitacora_acceso (
    empleado_id,
    accion,
    tabla_afectada,
    registro_id
  ) values (
    v_actor_id,
    'ver',
    'historial_clinico_version',
    coalesce(v_hc_id, p_ficha_id)::text
  );

  return query
  select
    v.id,
    v.historial_clinico_id,
    v.ficha_id,
    v.version,
    v.antecedentes_familiares,
    v.antecedentes_personales,
    v.motivo_consulta,
    v.observaciones_iniciales,
    v.tiene_atencion_psicologica_previa,
    v.campos_modificados,
    v.creado_por,
    emp.nombre,
    v.creado_en
  from public.historial_clinico_version v
  join public.historial_clinico hc
    on hc.id = v.historial_clinico_id
   and hc.activo
   and hc.creado_por = v_actor_id
  left join public.empleado emp on emp.id = v.creado_por
  where v.ficha_id = p_ficha_id
  order by v.version desc;
end;
$$;

revoke all on function public.get_historial_clinico_versiones(uuid) from public, anon;
grant execute on function public.get_historial_clinico_versiones(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC: public.guardar_historial_clinico (en UPDATE exige ser autora)
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
  if not public.tiene_permiso('historial_clinico.escribir') then
    raise exception 'Solo Psicología puede registrar o editar el historial clínico'
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

    if v_actual.creado_por is distinct from v_actor_id then
      raise exception 'Este historial clínico pertenece a otra psicóloga'
        using errcode = '42501';
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
-- 7. RLS de historial_clinico y historial_clinico_version (solo autora)
-- ---------------------------------------------------------------------
drop policy if exists historial_clinico_select on public.historial_clinico;

create policy historial_clinico_select on public.historial_clinico
  for select to authenticated
  using (
    (select public.tiene_permiso('historial_clinico.acceder'::text))
    and creado_por = (select auth.uid())
  );

drop policy if exists historial_clinico_update on public.historial_clinico;

create policy historial_clinico_update on public.historial_clinico
  for update to authenticated
  using (
    (select public.tiene_permiso('historial_clinico.escribir'::text))
    and creado_por = (select auth.uid())
  )
  with check (false);

drop policy if exists historial_clinico_version_select on public.historial_clinico_version;

create policy historial_clinico_version_select on public.historial_clinico_version
  for select to authenticated
  using (
    (select public.tiene_permiso('historial_clinico.acceder'::text))
    and exists (
      select 1
      from public.historial_clinico hc
      where hc.id = historial_clinico_version.historial_clinico_id
        and hc.activo
        and hc.creado_por = (select auth.uid())
    )
  );
