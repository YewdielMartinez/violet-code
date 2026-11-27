-- =====================================================================
-- 41_folio_seguimiento.sql (Tarjeta #89)
-- Genera folio único de seguimiento en servidor en public.atencion
-- con formato provisional SEG-AAAA-NNNNN (secuencia propia e inmutable),
-- lo rellena en filas existentes y lo devuelve en registrar_seguimiento().
-- =====================================================================

-- 1) Secuencia propia y función generadora (formato provisional SEG-AAAA-NNNNN)
create sequence if not exists public.seguimiento_folio_seq start 1;

revoke all on sequence public.seguimiento_folio_seq from public, anon;

create or replace function public.generar_folio_seguimiento()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'SEG-'
      || extract(year from (now() at time zone 'America/Mazatlan'))::int::text
      || '-'
      || lpad(nextval('public.seguimiento_folio_seq')::text, 5, '0');
$$;

revoke execute on function public.generar_folio_seguimiento() from public, anon;
grant  execute on function public.generar_folio_seguimiento() to authenticated;

-- 2) Columna en public.atencion + backfill de filas existentes + restricciones
alter table public.atencion
  add column if not exists folio_seguimiento text;

update public.atencion a
set folio_seguimiento = sub.folio
from (
  select
    id,
    'SEG-'
      || extract(year from (creado_en at time zone 'America/Mazatlan'))::int::text
      || '-'
      || lpad(nextval('public.seguimiento_folio_seq')::text, 5, '0') as folio
  from public.atencion
  where folio_seguimiento is null
  order by creado_en, id
) sub
where a.id = sub.id;

alter table public.atencion
  alter column folio_seguimiento set default public.generar_folio_seguimiento(),
  alter column folio_seguimiento set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'atencion_folio_seguimiento_key'
      and conrelid = 'public.atencion'::regclass
  ) then
    alter table public.atencion
      add constraint atencion_folio_seguimiento_key unique (folio_seguimiento);
  end if;
end
$$;

-- 3) Trigger en servidor: el front nunca puede enviar ni alterar folio_seguimiento
create or replace function public.asignar_folio_seguimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.folio_seguimiento := public.generar_folio_seguimiento();
  elsif tg_op = 'UPDATE' and new.folio_seguimiento is distinct from old.folio_seguimiento then
    raise exception 'El folio de seguimiento se genera en servidor y es inmutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists atencion_folio_seguimiento_auto on public.atencion;

create trigger atencion_folio_seguimiento_auto
  before insert or update on public.atencion
  for each row execute function public.asignar_folio_seguimiento();

-- 4) Actualizar registrar_seguimiento() para devolver folio_seguimiento
drop function if exists public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz);

create or replace function public.registrar_seguimiento(
  p_ficha_id            uuid,
  p_cita_id             uuid default null,
  p_tipo_atencion_id    smallint default null,
  p_acciones_realizadas text default null,
  p_proxima_accion      text default null,
  p_prioridad           public.prioridad_nivel default null,
  p_observaciones       text default null,
  p_proxima_cita_en     timestamptz default null
)
returns table (
  atencion_id             uuid,
  folio_seguimiento       text,
  cita_proxima_id         uuid,
  es_primera_vez_area     boolean,
  tiene_historial_clinico boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id              uuid := auth.uid();
  v_area_id               smallint;
  v_ficha                 record;
  v_cita                  record;
  v_celular               text;
  v_domicilio_id          uuid;
  v_es_primera_vez        boolean;
  v_tiene_historial       boolean;
  v_atencion_id           uuid;
  v_folio_seguimiento     text;
  v_cita_proxima_id       uuid;
  v_hoy_mazatlan          date := (now() at time zone 'America/Mazatlan')::date;
begin
  if not public.tiene_permiso('seguimiento.registrar') then
    raise exception 'Sin permiso para registrar seguimiento' using errcode = '42501';
  end if;

  v_area_id := public.auth_area_id();
  if v_area_id is null then
    raise exception 'El actor no tiene área asignada' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  select f.id, f.persona_id, f.estado, f.estado_civil, f.ocupacion_id, f.ocupacion_otra
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if p_tipo_atencion_id is null or not exists (
    select 1
    from public.cat_tipo_atencion ta
    where ta.id = p_tipo_atencion_id
      and ta.area_id = v_area_id
  ) then
    raise exception 'El tipo de atención no corresponde al área del actor' using errcode = '23514';
  end if;

  -- Regla #88: la cita del día es obligatoria para registrar el seguimiento
  if p_cita_id is null then
    raise exception 'La cita del día (p_cita_id) es obligatoria para registrar el seguimiento'
      using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, c.estado, c.programada_en
  into v_cita
  from public.cita c
  where c.id = p_cita_id
    and c.activo
  for update;

  if not found then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.atencion a
    where a.cita_id = p_cita_id
  ) then
    raise exception 'Esta cita ya cuenta con una hoja de seguimiento registrada' using errcode = '23505';
  end if;

  if v_cita.persona_id <> v_ficha.persona_id then
    raise exception 'La cita no pertenece a la persona de este expediente' using errcode = '23514';
  end if;

  if v_cita.area_id <> v_area_id then
    raise exception 'La cita no pertenece al área del actor' using errcode = '23514';
  end if;

  if v_cita.estado not in ('agendada', 'confirmada') then
    raise exception 'Solo se puede registrar seguimiento sobre citas agendadas o confirmadas' using errcode = '23514';
  end if;

  if (v_cita.programada_en at time zone 'America/Mazatlan')::date <> v_hoy_mazatlan then
    raise exception 'Solo se puede registrar seguimiento sobre una cita programada para el día de hoy'
      using errcode = '23514';
  end if;

  if p_proxima_cita_en is not null and p_proxima_cita_en <= now() then
    raise exception 'La fecha de la próxima cita debe ser futura' using errcode = '23514';
  end if;

  -- Evaluar antes de insertar la nueva atención (RN-19)
  v_es_primera_vez := not exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.area_id = v_area_id
      and a.activo
  );

  update public.cita c
  set estado = 'asistio'
  where c.id = p_cita_id;

  select p.celular
  into v_celular
  from public.persona p
  where p.id = v_ficha.persona_id;

  select d.id
  into v_domicilio_id
  from public.domicilio d
  where d.persona_id = v_ficha.persona_id
    and d.activo
    and d.es_actual
  limit 1;

  insert into public.atencion (
    ficha_id,
    cita_id,
    area_id,
    tipo_atencion_id,
    atendida_por,
    estado_civil,
    ocupacion_id,
    ocupacion_otra,
    celular,
    domicilio_id,
    acciones_realizadas,
    proxima_accion,
    prioridad,
    observaciones,
    creado_por
  ) values (
    v_ficha.id,
    p_cita_id,
    v_area_id,
    p_tipo_atencion_id,
    v_actor_id,
    v_ficha.estado_civil,
    v_ficha.ocupacion_id,
    v_ficha.ocupacion_otra,
    v_celular,
    v_domicilio_id,
    nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    p_prioridad,
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_actor_id
  )
  returning id, atencion.folio_seguimiento into v_atencion_id, v_folio_seguimiento;

  if v_ficha.estado = 'abierto' then
    update public.ficha_registro f
    set estado = 'en_seguimiento'
    where f.id = v_ficha.id;
  end if;

  if p_proxima_cita_en is not null then
    insert into public.cita (
      persona_id,
      area_id,
      programada_en,
      estado,
      origen,
      creado_por
    ) values (
      v_ficha.persona_id,
      v_area_id,
      p_proxima_cita_en,
      'agendada',
      'regular',
      v_actor_id
    )
    returning id into v_cita_proxima_id;
  end if;

  v_tiene_historial := exists (
    select 1
    from public.historial_clinico hc
    where hc.ficha_id = v_ficha.id
      and hc.activo
  );

  return query select v_atencion_id, v_folio_seguimiento, v_cita_proxima_id, v_es_primera_vez, v_tiene_historial;
end;
$$;

revoke execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) from public, anon;
grant  execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) to authenticated;
