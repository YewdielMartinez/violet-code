-- =====================================================================
-- 44_tipos_de_cuenta.sql (Tarjeta #92)
-- Separa cuentas de empleadas ('empleado'), externos ('externo') y
-- usuarias de la app móvil ('usuaria_app') usando auth.users.raw_app_meta_data:
--   1. Trigger BEFORE INSERT en auth.users: tipo = 'usuaria_app' por defecto.
--   2. Backfill de cuentas existentes según public.empleado / usuario_externo.
--   3. auth_tipo_cuenta() y es_usuaria_app().
--   4. auth_rol(), es_empleado_activo() y es_umeca() exigen el tipo correcto
--      (una cuenta usuaria_app con fila falsa en empleado nunca pasa).
-- =====================================================================

-- 1) Trigger en auth.users para asignar tipo = 'usuaria_app' por defecto
create or replace function public.asignar_tipo_cuenta_por_defecto()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if nullif(btrim(coalesce(new.raw_app_meta_data ->> 'tipo', '')), '') is null then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{tipo}',
      '"usuaria_app"'::jsonb,
      true
    );
  end if;
  return new;
end;
$$;

revoke all on function public.asignar_tipo_cuenta_por_defecto() from public, anon, authenticated;

drop trigger if exists auth_users_tipo_cuenta_default on auth.users;

create trigger auth_users_tipo_cuenta_default
  before insert on auth.users
  for each row execute function public.asignar_tipo_cuenta_por_defecto();

-- 2) Backfill de cuentas existentes
update auth.users u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{tipo}',
  '"empleado"'::jsonb,
  true
)
where exists (select 1 from public.empleado e where e.id = u.id)
  and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

update auth.users u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{tipo}',
  '"externo"'::jsonb,
  true
)
where exists (select 1 from public.usuario_externo ue where ue.id = u.id)
  and not exists (select 1 from public.empleado e where e.id = u.id)
  and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'externo';

update auth.users u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{tipo}',
  '"usuaria_app"'::jsonb,
  true
)
where nullif(btrim(coalesce(u.raw_app_meta_data ->> 'tipo', '')), '') is null;

-- 3) Helpers de tipo de cuenta
create or replace function public.auth_tipo_cuenta()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    nullif(btrim(auth.jwt() -> 'app_metadata' ->> 'tipo'), ''),
    (
      select nullif(btrim(u.raw_app_meta_data ->> 'tipo'), '')
      from auth.users u
      where u.id = auth.uid()
    )
  );
$$;

revoke all on function public.auth_tipo_cuenta() from public, anon;
grant  execute on function public.auth_tipo_cuenta() to authenticated;

create or replace function public.es_usuaria_app()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
     and public.auth_tipo_cuenta() = 'usuaria_app';
$$;

revoke all on function public.es_usuaria_app() from public, anon;
grant  execute on function public.es_usuaria_app() to authenticated;

-- 4) Endurecer auth_rol(), es_empleado_activo() y es_umeca()
create or replace function public.auth_rol()
returns public.rol_empleado
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.rol
  from public.empleado e
  where e.id = auth.uid()
    and e.activo
    and public.auth_tipo_cuenta() = 'empleado';
$$;

create or replace function public.es_empleado_activo()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.auth_rol() is not null
     and public.auth_tipo_cuenta() = 'empleado';
$$;

create or replace function public.es_umeca()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.usuario_externo ue
    where ue.id = auth.uid()
      and ue.activo
      and ue.dependencia = 'umeca'
  )
  and public.auth_tipo_cuenta() = 'externo';
$$;
