-- =====================================================================
-- 06_reglas_negocio.sql
-- Qué contiene:
--   1. Folio automático de expediente en ficha_registro (RF-02, RN-12):
--      formato 'SEM-<AAAA>-<NNNN>', permitiendo también folio explícito
--      cuando se importen registros históricos (RF-23).
--   2. Validación de mayoría de edad (>= 18 años) para Psicología y
--      Jurídico en cita y atencion usando fecha_nacimiento calculada de
--      CURP (RN-01). Trabajo Social sí atiende menores de edad.
--   3. Columnas calculadas desde CURP en pre_registro (RF-33).
--   4. RPC buscar_pre_registro_por_curp() para avisar/precargar datos de
--      app móvil en la Ficha Única (RF-34).
-- Depende de: 01_base.sql, 02_atencion.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Folio automático en ficha_registro (RF-02, RN-12)
-- ---------------------------------------------------------------------
create sequence if not exists public.ficha_folio_seq start 1;

revoke all on sequence public.ficha_folio_seq from public, anon;

create or replace function public.generar_folio_ficha()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'SEM-'
      || extract(year from (now() at time zone 'America/Mazatlan'))::int::text
      || '-'
      || lpad(nextval('public.ficha_folio_seq')::text, 4, '0');
$$;

revoke execute on function public.generar_folio_ficha() from public, anon;
grant  execute on function public.generar_folio_ficha() to authenticated;

alter table public.ficha_registro
  alter column folio set default public.generar_folio_ficha();

create or replace function public.asignar_folio_ficha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folio is null or btrim(new.folio) = '' then
    new.folio := public.generar_folio_ficha();
  else
    new.folio := btrim(new.folio);
  end if;
  return new;
end;
$$;

create trigger ficha_registro_folio_auto
  before insert on public.ficha_registro
  for each row execute function public.asignar_folio_ficha();

-- ---------------------------------------------------------------------
-- 2. Validación de mayoría de edad (>= 18 años) en Psicología y
--    Jurídico (RN-01) usando persona.fecha_nacimiento (calculada de CURP)
-- ---------------------------------------------------------------------
create or replace function public.validar_mayoria_edad_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave     text;
  v_fecha_nac date;
  v_fecha_hoy date;
begin
  select a.clave into v_clave
  from public.cat_area a
  where a.id = new.area_id;

  if v_clave in ('psicologia', 'juridico') then
    if tg_table_name = 'cita' then
      select p.fecha_nacimiento into v_fecha_nac
      from public.persona p
      where p.id = new.persona_id;
    elsif tg_table_name = 'atencion' then
      select p.fecha_nacimiento into v_fecha_nac
      from public.ficha_registro f
      join public.persona p on p.id = f.persona_id
      where f.id = new.ficha_id;
    end if;

    v_fecha_hoy := (now() at time zone 'America/Mazatlan')::date;

    if v_fecha_nac is not null
       and v_fecha_nac > (v_fecha_hoy - interval '18 years')::date then
      raise exception 'Psicología y Jurídico solo atienden a personas mayores de 18 años (RN-01)'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger cita_validar_mayoria_edad
  before insert or update of persona_id, area_id on public.cita
  for each row execute function public.validar_mayoria_edad_area();

create trigger atencion_validar_mayoria_edad
  before insert or update of ficha_id, area_id on public.atencion
  for each row execute function public.validar_mayoria_edad_area();

-- ---------------------------------------------------------------------
-- 3. Columnas calculadas desde CURP en pre_registro (RF-33)
-- ---------------------------------------------------------------------
alter table public.pre_registro
  add column if not exists sexo text not null
    generated always as (substr(curp, 11, 1)) stored,
  add column if not exists fecha_nacimiento date not null
    generated always as (
      make_date(
        case when substr(curp, 17, 1) ~ '[0-9]' then 1900 else 2000 end
          + substr(curp, 5, 2)::int,
        substr(curp, 7, 2)::int,
        substr(curp, 9, 2)::int
      )
    ) stored,
  add column if not exists entidad_nacimiento text not null
    generated always as (substr(curp, 12, 2)) stored;

-- ---------------------------------------------------------------------
-- 4. buscar_pre_registro_por_curp() (RF-34): permite a Trabajo Social
--    y Dirección precargar datos de un pre_registro móvil activo por
--    CURP sin exponer registros de otras usuarias en consultas abiertas.
-- ---------------------------------------------------------------------
create or replace function public.buscar_pre_registro_por_curp(p_curp text)
returns table (
  pre_registro_id    uuid,
  curp               text,
  nombres            text,
  apellido_paterno   text,
  apellido_materno   text,
  sexo               text,
  fecha_nacimiento   date,
  entidad_nacimiento text,
  celular            text,
  persona_id         uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_curp text;
begin
  if not exists (
    select 1
    from public.empleado e
    where e.id = auth.uid()
      and e.activo
      and e.rol in ('titular', 'subdireccion', 'trabajo_social')
  ) then
    raise exception 'Sin permiso para consultar pre-registros por CURP' using errcode = '42501';
  end if;

  v_curp := upper(btrim(coalesce(p_curp, '')));

  return query
  select pr.id as pre_registro_id,
         pr.curp,
         pr.nombres,
         pr.apellido_paterno,
         pr.apellido_materno,
         pr.sexo,
         pr.fecha_nacimiento,
         pr.entidad_nacimiento,
         pr.celular,
         pr.persona_id
  from public.pre_registro pr
  where pr.activo
    and pr.curp = v_curp
  limit 1;
end;
$$;

revoke execute on function public.buscar_pre_registro_por_curp(text) from public, anon;
grant  execute on function public.buscar_pre_registro_por_curp(text) to authenticated;
