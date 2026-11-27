-- =====================================================================
-- 44_tipos_cuenta.test.sql (Tarjeta #92)
-- Verifica separación de cuentas con app_metadata.tipo:
--   - Trigger por defecto tipo = 'usuaria_app' en auth.users.
--   - es_usuaria_app() y es_empleado_activo() por tipo de cuenta.
--   - Cuenta usuaria_app con fila falsa en public.empleado NO pasa
--     es_empleado_activo(), auth_rol() ni tiene_permiso().
--   - anon no tiene EXECUTE sobre es_usuaria_app() ni auth_tipo_cuenta().
-- =====================================================================

begin;

select plan(9);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1) Nuevo usuario en auth.users sin tipo recibe 'usuaria_app' por defecto
insert into auth.users (id, email)
values ('98000000-0000-4000-a000-000000000001', 'nueva.usuaria@test.local');

select is(
  (select raw_app_meta_data ->> 'tipo' from auth.users where id = '98000000-0000-4000-a000-000000000001'),
  'usuaria_app',
  'nuevo auth.users sin tipo recibe tipo = usuaria_app automáticamente'
);

-- 2-3) anon no tiene EXECUTE sobre auth_tipo_cuenta() ni es_usuaria_app()
select is(
  has_function_privilege('anon', 'public.auth_tipo_cuenta()', 'execute'),
  false,
  'anon no tiene EXECUTE sobre auth_tipo_cuenta()'
);

select is(
  has_function_privilege('anon', 'public.es_usuaria_app()', 'execute'),
  false,
  'anon no tiene EXECUTE sobre es_usuaria_app()'
);

-- 4-5) Seeded usuaria_app vs empleado
select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'::uuid); -- usuaria.app
select is(public.es_usuaria_app(), true, 'es_usuaria_app() es true para usuaria de la app');
select is(public.es_empleado_activo(), false, 'es_empleado_activo() es false para usuaria de la app');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(public.es_empleado_activo(), true, 'es_empleado_activo() es true para empleada con tipo = empleado');

-- 6-9) Fila falsa en public.empleado para cuenta usuaria_app NO le da acceso
reset role;
insert into public.empleado (id, nombre, rol, area_id, activo)
values ('98000000-0000-4000-a000-000000000001', 'Cuenta Falsa', 'titular', null, true);

select pg_temp.set_actor('98000000-0000-4000-a000-000000000001'::uuid);
select is(public.es_empleado_activo(), false, 'usuaria_app con fila falsa en empleado NO pasa es_empleado_activo()');
select is(public.auth_rol()::text, null, 'usuaria_app con fila falsa en empleado tiene auth_rol() = null');
select is(public.tiene_permiso('expediente.ver'), false, 'usuaria_app con fila falsa en empleado tiene tiene_permiso() = false');

select * from finish();
rollback;
