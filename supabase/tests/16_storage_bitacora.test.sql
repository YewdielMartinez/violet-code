-- =====================================================================
-- 16_storage_bitacora.test.sql (A-01 · Sprint 01)
-- Verifica:
--   1. registrar_consulta() rechaza sin sesión e inactivos con 42501.
--   2. registrar_consulta() rechaza p_tabla inválida o p_registro_id vacío con 23514.
--   3. registrar_consulta() registra 'ver' para empleado activo y UMECA.
--   4. storage.objects DELETE en 'documentos' bloquea rol sin permiso
--      (recepcion) y a otro usuario distinto del dueño (psicologia),
--      y permite borrar solo al dueño con expediente.ver (trabajo_social).
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

-- Sembrar empleado inactivo temporal y un objeto de prueba en storage.objects
do $$
declare
  v_uid_inactivo uuid := '11111111-1111-4111-8111-111111111199';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_uid_inactivo, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'inactivo.a01@demo.violetcode.local',
    extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo)
  values (v_uid_inactivo, 'Empleada Inactiva A01', 'titular', null, false)
  on conflict (id) do update set activo = false, rol = 'titular';

  insert into storage.objects (id, bucket_id, name, owner_id)
  values (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'documentos',
    'ficha-test/ine.pdf',
    '11111111-1111-4111-8111-111111111103'
  )
  on conflict (id) do update set owner_id = excluded.owner_id;
end;
$$;

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
  end if;
end;
$$;

-- 1) Sin sesión -> 42501
select pg_temp.set_actor(null);
select throws_ok(
  $$select public.registrar_consulta('ficha_registro', '55555555-5555-4555-8555-555555555501')$$,
  '42501',
  'Sin permiso para registrar consultas',
  'registrar_consulta sin sesion lanza 42501'
);

-- 2) Empleado inactivo -> 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111199'::uuid);
select throws_ok(
  $$select public.registrar_consulta('ficha_registro', '55555555-5555-4555-8555-555555555501')$$,
  '42501',
  'Sin permiso para registrar consultas',
  'registrar_consulta empleado inactivo lanza 42501'
);

-- 3) p_tabla fuera de lista permitida -> 23514
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid);
select throws_ok(
  $$select public.registrar_consulta('empleado', '11111111-1111-4111-8111-111111111103')$$,
  '23514',
  'Tabla no permitida para registro de consulta',
  'registrar_consulta rechaza p_tabla fuera de lista permitida'
);

-- 4) p_registro_id vacío -> 23514
select throws_ok(
  $$select public.registrar_consulta('ficha_registro', '   ')$$,
  '23514',
  'El identificador de registro es obligatorio',
  'registrar_consulta rechaza p_registro_id vacio'
);

-- 5) Empleado activo registra 'ver' en bitacora_acceso
select lives_ok(
  $$select public.registrar_consulta('agresor', '77777777-7777-4777-8777-777777777701')$$,
  'registrar_consulta empleado activo ejecuta sin error'
);

select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.empleado_id = '11111111-1111-4111-8111-111111111103'::uuid
      and b.accion = 'ver'
      and b.tabla_afectada = 'agresor'
      and b.registro_id = '77777777-7777-4777-8777-777777777701'
  ),
  1,
  'registrar_consulta inserta registro ver para empleado activo'
);

-- 6) UMECA activo registra 'ver' en bitacora_acceso
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid);
select lives_ok(
  $$select public.registrar_consulta('cita', '99999999-9999-4999-8999-999999999904')$$,
  'registrar_consulta UMECA activo ejecuta sin error'
);

-- 7) Storage DELETE bajo RLS (rol authenticated)
--    Recepción (sin expediente.ver) no puede borrar el objeto
set local role authenticated;
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid);

with deleted as (
  delete from storage.objects
  where id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
  returning id
)
select is(
  (select count(*)::int from deleted),
  0,
  'recepcion (sin expediente.ver) no borra objetos en bucket documentos'
);

--    Psicología (con expediente.ver pero NO es owner_id) tampoco puede borrar
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid);

with deleted as (
  delete from storage.objects
  where id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
  returning id
)
select is(
  (select count(*)::int from deleted),
  0,
  'psicologia (con expediente.ver pero distinto owner_id) no borra objeto ajeno'
);

--    Trabajo Social (con expediente.ver y owner_id = auth.uid()) sí puede borrar
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid);

with deleted as (
  delete from storage.objects
  where id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
  returning id
)
select is(
  (select count(*)::int from deleted),
  1,
  'trabajo_social (con expediente.ver) si borra objetos en bucket documentos'
);

reset role;

select * from finish();
rollback;
