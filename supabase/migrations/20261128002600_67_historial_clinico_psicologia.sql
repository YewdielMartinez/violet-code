-- =====================================================================
-- 67_historial_clinico_psicologia.sql
-- Historial clínico: solo Psicología escribe + histórico de versiones.
--
-- Qué contiene:
--   1. Permiso nuevo `historial_clinico.escribir` (solo rol `psicologia`).
--      public.tiene_permiso() se redefine partiendo de la definición vigente
--      (migración 42) conservando TODAS las claves. `historial_clinico.acceder`
--      (lectura: titular, subdirección y psicología) no cambia.
--   2. RPC public.guardar_historial_clinico(...): misma firma y mismo
--      comportamiento que la migración 37, pero exige
--      `historial_clinico.escribir` (42501 "Solo Psicología puede registrar o
--      editar el historial clínico"). Dirección y demás roles ya no escriben.
--   3. RLS de public.historial_clinico: UPDATE directo solo con
--      `historial_clinico.escribir` (el INSERT directo sigue cerrado: toda
--      escritura pasa por el RPC; ver migración 39).
--   4. Tabla append-only public.historial_clinico_version: una fila por cada
--      guardado que cambie algún dato (quién, cuándo, snapshot completo y
--      lista de campos modificados). La rellena un trigger AFTER INSERT OR
--      UPDATE sobre historial_clinico, así queda registrada también cualquier
--      escritura que no use el RPC. Un guardado sin cambios no crea versión.
--      Solo SELECT (historial_clinico.acceder); sin INSERT/UPDATE/DELETE
--      directos.
--   5. Backfill: cada historial existente recibe su versión 1 (snapshot del
--      estado actual; creado_en = actualizado_en del historial).
--   6. RPC public.get_historial_clinico_versiones(p_ficha_id): lista las
--      versiones (más reciente primero) con el nombre de quien guardó.
--      Mismo permiso que get_historial_clinico (historial_clinico.acceder) y
--      deja 'ver' en bitacora_acceso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. tiene_permiso(): agrega historial_clinico.escribir (conserva todas
--    las claves de la migración 42).
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
    when 'historial_clinico.acceder'  then public.es_direccion() or public.auth_rol() = 'psicologia'
    when 'historial_clinico.escribir' then public.auth_rol() = 'psicologia'
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
-- 2. RPC: public.guardar_historial_clinico (solo Psicología)
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
-- 3. RLS de historial_clinico: UPDATE directo solo con escribir
--    (INSERT directo sigue cerrado: with check (false), migración 39).
-- ---------------------------------------------------------------------
drop policy if exists historial_clinico_update on public.historial_clinico;

create policy historial_clinico_update on public.historial_clinico
  for update to authenticated
  using ((select public.tiene_permiso('historial_clinico.escribir'::text)))
  with check (false);

-- ---------------------------------------------------------------------
-- 4. Tabla public.historial_clinico_version (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.historial_clinico_version (
  id                                uuid primary key default gen_random_uuid(),
  historial_clinico_id              uuid not null references public.historial_clinico (id) on delete restrict,
  ficha_id                          uuid not null references public.ficha_registro (id) on delete restrict,
  version                           integer not null check (version >= 1),

  -- snapshot completo del historial tras el guardado
  antecedentes_familiares           text,
  antecedentes_personales           text,
  motivo_consulta                   text,
  observaciones_iniciales           text,
  tiene_atencion_psicologica_previa boolean,

  -- nombres de columna que cambiaron respecto de la versión anterior
  campos_modificados                text[] not null default '{}',

  creado_por                        uuid references public.empleado (id) on delete restrict,
  creado_en                         timestamptz not null default now(),

  unique (historial_clinico_id, version)
);

create index if not exists historial_clinico_version_ficha_idx
  on public.historial_clinico_version (ficha_id, version desc);

create index if not exists historial_clinico_version_creado_por_idx
  on public.historial_clinico_version (creado_por);

revoke all on table public.historial_clinico_version from public, anon, authenticated;
grant select on table public.historial_clinico_version to authenticated;

alter table public.historial_clinico_version enable row level security;

drop policy if exists historial_clinico_version_select on public.historial_clinico_version;

create policy historial_clinico_version_select on public.historial_clinico_version
  for select to authenticated
  using ((select public.tiene_permiso('historial_clinico.acceder')));

-- Trigger: registra una versión cuando el historial se crea o cambia.
create or replace function public.historial_clinico_registrar_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campos  text[] := '{}';
  v_version integer;
  v_actor   uuid := (select e.id from public.empleado e where e.id = auth.uid());
begin
  if tg_op = 'INSERT' then
    v_actor := coalesce(v_actor, new.creado_por);

    if new.antecedentes_familiares is not null then
      v_campos := v_campos || 'antecedentes_familiares'::text;
    end if;
    if new.antecedentes_personales is not null then
      v_campos := v_campos || 'antecedentes_personales'::text;
    end if;
    if new.motivo_consulta is not null then
      v_campos := v_campos || 'motivo_consulta'::text;
    end if;
    if new.observaciones_iniciales is not null then
      v_campos := v_campos || 'observaciones_iniciales'::text;
    end if;
    if new.tiene_atencion_psicologica_previa is not null then
      v_campos := v_campos || 'tiene_atencion_psicologica_previa'::text;
    end if;
  else
    if new.antecedentes_familiares is distinct from old.antecedentes_familiares then
      v_campos := v_campos || 'antecedentes_familiares'::text;
    end if;
    if new.antecedentes_personales is distinct from old.antecedentes_personales then
      v_campos := v_campos || 'antecedentes_personales'::text;
    end if;
    if new.motivo_consulta is distinct from old.motivo_consulta then
      v_campos := v_campos || 'motivo_consulta'::text;
    end if;
    if new.observaciones_iniciales is distinct from old.observaciones_iniciales then
      v_campos := v_campos || 'observaciones_iniciales'::text;
    end if;
    if new.tiene_atencion_psicologica_previa is distinct from old.tiene_atencion_psicologica_previa then
      v_campos := v_campos || 'tiene_atencion_psicologica_previa'::text;
    end if;

    -- Guardado sin cambios en datos clínicos: no genera versión.
    if cardinality(v_campos) = 0 then
      return null;
    end if;
  end if;

  select coalesce(max(v.version), 0) + 1
  into v_version
  from public.historial_clinico_version v
  where v.historial_clinico_id = new.id;

  insert into public.historial_clinico_version (
    historial_clinico_id,
    ficha_id,
    version,
    antecedentes_familiares,
    antecedentes_personales,
    motivo_consulta,
    observaciones_iniciales,
    tiene_atencion_psicologica_previa,
    campos_modificados,
    creado_por
  ) values (
    new.id,
    new.ficha_id,
    v_version,
    new.antecedentes_familiares,
    new.antecedentes_personales,
    new.motivo_consulta,
    new.observaciones_iniciales,
    new.tiene_atencion_psicologica_previa,
    v_campos,
    v_actor
  );

  return null;
end;
$$;

revoke all on function public.historial_clinico_registrar_version() from public, anon, authenticated;

drop trigger if exists historial_clinico_version on public.historial_clinico;
create trigger historial_clinico_version
  after insert or update on public.historial_clinico
  for each row execute function public.historial_clinico_registrar_version();

-- ---------------------------------------------------------------------
-- 5. Backfill: versión 1 para cada historial existente
-- ---------------------------------------------------------------------
insert into public.historial_clinico_version (
  historial_clinico_id,
  ficha_id,
  version,
  antecedentes_familiares,
  antecedentes_personales,
  motivo_consulta,
  observaciones_iniciales,
  tiene_atencion_psicologica_previa,
  campos_modificados,
  creado_por,
  creado_en
)
select
  hc.id,
  hc.ficha_id,
  1,
  hc.antecedentes_familiares,
  hc.antecedentes_personales,
  hc.motivo_consulta,
  hc.observaciones_iniciales,
  hc.tiene_atencion_psicologica_previa,
  array_remove(array[
    case when hc.antecedentes_familiares is not null then 'antecedentes_familiares'::text end,
    case when hc.antecedentes_personales is not null then 'antecedentes_personales'::text end,
    case when hc.motivo_consulta is not null then 'motivo_consulta'::text end,
    case when hc.observaciones_iniciales is not null then 'observaciones_iniciales'::text end,
    case when hc.tiene_atencion_psicologica_previa is not null then 'tiene_atencion_psicologica_previa'::text end
  ], null),
  hc.creado_por,
  hc.actualizado_en
from public.historial_clinico hc
where not exists (
  select 1
  from public.historial_clinico_version v
  where v.historial_clinico_id = hc.id
);

-- ---------------------------------------------------------------------
-- 6. RPC: public.get_historial_clinico_versiones
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
  join public.historial_clinico hc on hc.id = v.historial_clinico_id and hc.activo
  left join public.empleado emp on emp.id = v.creado_por
  where v.ficha_id = p_ficha_id
  order by v.version desc;
end;
$$;

revoke all on function public.get_historial_clinico_versiones(uuid) from public, anon;
grant  execute on function public.get_historial_clinico_versiones(uuid) to authenticated;
