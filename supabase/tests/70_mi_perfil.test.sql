-- =====================================================================
-- 70_mi_perfil.test.sql (Tarjeta #159)
-- Verifica public.get_mi_perfil():
--   1. Empleado activo recibe perfil completo, email y permisos efectivos.
--   2. Psicología recibe historial_clinico.escribir y no recibe cuentas.gestionar.
--   3. Empleado inactivo recibe activo = false y permisos vacíos.
--   4. Usuario externo UMECA recibe tipo = 'externo', rol = 'umeca',
--      area_clave = 'umeca', area_nombre = 'UMECA' y permisos vacíos.
--   5. Usuario sin perfil (ni empleado ni externo UMECA) recibe 0 filas.
--   6. anon es rechazado con 42501.
-- =====================================================================

begin;

select plan(6);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Usuarios aislados para probar inactivo y sin perfil
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
values
  ('9a000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactivo.perfil@semujeres.local', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdu', now(), '{"tipo":"empleado"}'::jsonb, now(), now()),
  ('9a000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sin.perfil@semujeres.local', '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdu', now(), '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.empleado (id, nombre, rol, area_id, activo)
values ('9a000000-0000-4000-a000-000000000001', 'Empleado Inactivo Perfil', 'trabajo_social', (select id from public.cat_area where clave = 'trabajo_social'), false)
on conflict (id) do nothing;

-- 1) Empleado activo (titular) recibe perfil y permisos de dirección
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select ok(
  exists (
    select 1
    from public.get_mi_perfil() p
    where p.id = '11111111-1111-4111-8111-111111111101'::uuid
      and p.tipo = 'empleado'
      and p.rol = 'titular'
      and p.activo = true
      and p.dependencia is null
      and 'cuentas.gestionar' = any(p.permisos)
      and 'expediente.ver' = any(p.permisos)
      and not ('historial_clinico.escribir' = any(p.permisos))
  ),
  'empleado activo (titular) recibe perfil y permisos efectivos'
);

-- 2) Psicología recibe historial_clinico.escribir y no cuentas.gestionar
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select ok(
  exists (
    select 1
    from public.get_mi_perfil() p
    where p.tipo = 'empleado'
      and p.rol = 'psicologia'
      and p.area_clave = 'psicologia'
      and 'historial_clinico.escribir' = any(p.permisos)
      and not ('cuentas.gestionar' = any(p.permisos))
  ),
  'psicologia recibe historial_clinico.escribir en permisos'
);

-- 3) Empleado inactivo recibe activo = false y permisos vacíos
select pg_temp.set_actor('9a000000-0000-4000-a000-000000000001'::uuid);
select ok(
  exists (
    select 1
    from public.get_mi_perfil() p
    where p.id = '9a000000-0000-4000-a000-000000000001'::uuid
      and p.email = 'inactivo.perfil@semujeres.local'
      and p.activo = false
      and cardinality(p.permisos) = 0
  ),
  'empleado inactivo recibe activo = false y permisos vacíos'
);

-- 4) UMECA externo recibe rol/area umeca y permisos vacíos
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select ok(
  exists (
    select 1
    from public.get_mi_perfil() p
    where p.id = '11111111-1111-4111-8111-111111111107'::uuid
      and p.tipo = 'externo'
      and p.rol = 'umeca'
      and p.area_clave = 'umeca'
      and p.area_nombre = 'UMECA'
      and p.dependencia = 'umeca'
      and p.activo = true
      and cardinality(p.permisos) = 0
  ),
  'UMECA recibe tipo externo, rol umeca y area UMECA'
);

-- 5) Usuario sin perfil recibe 0 filas (sin lanzar error)
select pg_temp.set_actor('9a000000-0000-4000-a000-000000000002'::uuid);
select is(
  (select count(*)::int from public.get_mi_perfil()),
  0,
  'usuario sin perfil recibe 0 filas'
);

-- 6) anon rechazado con 42501
set local role anon;
select throws_ok(
  $$select * from public.get_mi_perfil()$$,
  '42501',
  null,
  'anon no puede ejecutar get_mi_perfil()'
);

select * from finish();
rollback;
