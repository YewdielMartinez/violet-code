-- =====================================================================
-- 75_historial_clinico_autora.test.sql (Tarjeta #188)
-- Pruebas pgTAP para migración 20261128003400_75_historial_clinico_autora.sql:
--   1. Solo Psicología tiene historial_clinico.acceder (Titular y
--      Subdirección reciben 42501 en get_historial_clinico y
--      get_historial_clinico_versiones, y 0 filas vía RLS).
--   2. La psicóloga autora ve, lista versiones y actualiza su historial.
--   3. Otra psicóloga recibe 42501 al consultar, listar versiones o
--      guardar sobre un historial ajeno, y ve 0 filas vía RLS; pero sí
--      puede crear un historial nuevo en un expediente sin historial.
-- =====================================================================

begin;

select plan(15);

create or replace function pg_temp.set_actor(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  select set_config('request.jwt.claims', json_build_object('sub', coalesce(p_uid::text, ''), 'role', 'authenticated')::text, true);
$$;

-- Segunda psicóloga sintética para probar aislamiento entre autoras
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '75000000-0000-4000-a000-000000000102',
  'authenticated', 'authenticated',
  'psicologia2.75@demo.violetcode.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"],"tipo":"empleado"}'::jsonb,
  '{"nombre":"Psicóloga Dos Test 75"}'::jsonb, now(), now()
);

insert into public.empleado (id, nombre, rol, area_id, activo, creado_por)
values (
  '75000000-0000-4000-a000-000000000102',
  'Psicóloga Dos Test 75',
  'psicologia',
  (select id from public.cat_area where clave = 'psicologia'),
  true,
  '11111111-1111-4111-8111-111111111101'
);

insert into public.persona (
  id, curp, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, creado_por
) values
  ('75000000-0000-4000-a000-000000000111', 'TEST750101MSLRRN01', 'Ana', 'Aut75', 'Uno', '1992-01-01', '11111111-1111-4111-8111-111111111103'),
  ('75000000-0000-4000-a000-000000000112', 'TEST750202MSLRRN02', 'Bea', 'Aut75', 'Dos', '1993-02-02', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (
  id, persona_id, folio, estado, aviso_privacidad_aceptado_en, creado_por
) values
  ('75000000-0000-4000-a000-000000000201', '75000000-0000-4000-a000-000000000111', 'SEM-2026-7501', 'abierto', now(), '11111111-1111-4111-8111-111111111103'),
  ('75000000-0000-4000-a000-000000000202', '75000000-0000-4000-a000-000000000112', 'SEM-2026-7502', 'abierto', now(), '11111111-1111-4111-8111-111111111103');

-- 1-3) Psicóloga 1 crea, consulta y lista versiones de su historial
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid);

select lives_ok(
  $$select * from public.guardar_historial_clinico(
    '75000000-0000-4000-a000-000000000201', null, 'Fam', 'Per', 'Motivo autora 1', 'Obs', false
  )$$,
  'psicóloga 1 crea historial clínico'
);

select is(
  (select motivo_consulta from public.get_historial_clinico('75000000-0000-4000-a000-000000000201')),
  'Motivo autora 1',
  'psicóloga autora consulta su historial'
);

select is(
  (select count(*)::int from public.get_historial_clinico_versiones('75000000-0000-4000-a000-000000000201')),
  1,
  'psicóloga autora lista versiones de su historial'
);

-- 4-8) Psicóloga 2 no puede leer, ver versiones, editar ni ver por RLS el historial de Psicóloga 1
select pg_temp.set_actor('75000000-0000-4000-a000-000000000102'::uuid);

select throws_ok(
  $$select * from public.get_historial_clinico('75000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'otra psicóloga recibe 42501 en get_historial_clinico'
);

select throws_ok(
  $$select * from public.get_historial_clinico_versiones('75000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'otra psicóloga recibe 42501 en get_historial_clinico_versiones'
);

select throws_ok(
  $$select * from public.guardar_historial_clinico(
    '75000000-0000-4000-a000-000000000201', now(), null, null, 'Intrusión'
  )$$,
  '42501', null,
  'otra psicóloga recibe 42501 al intentar editar historial ajeno'
);

select is(
  (select count(*)::int from public.historial_clinico where ficha_id = '75000000-0000-4000-a000-000000000201'),
  0,
  'otra psicóloga ve 0 filas en historial_clinico por RLS'
);

select is(
  (select count(*)::int from public.historial_clinico_version where ficha_id = '75000000-0000-4000-a000-000000000201'),
  0,
  'otra psicóloga ve 0 filas en historial_clinico_version por RLS'
);

-- 9) Psicóloga 2 sí puede crear un historial nuevo en un expediente sin historial
select lives_ok(
  $$select * from public.guardar_historial_clinico(
    '75000000-0000-4000-a000-000000000202', null, null, null, 'Motivo autora 2'
  )$$,
  'psicóloga 2 puede crear historial en expediente sin historial'
);

-- 10-12) Titular no tiene acceso (ni permiso, ni RPC, ni RLS)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid);

select is(public.tiene_permiso('historial_clinico.acceder'), false, 'titular: historial_clinico.acceder = false');

select throws_ok(
  $$select * from public.get_historial_clinico('75000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'titular recibe 42501 en get_historial_clinico'
);

select is(
  (select count(*)::int from public.historial_clinico where ficha_id = '75000000-0000-4000-a000-000000000201'),
  0,
  'titular ve 0 filas en historial_clinico por RLS'
);

-- 13-15) Subdirección tampoco tiene acceso
select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid);

select is(public.tiene_permiso('historial_clinico.acceder'), false, 'subdireccion: historial_clinico.acceder = false');

select throws_ok(
  $$select * from public.get_historial_clinico_versiones('75000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'subdireccion recibe 42501 en get_historial_clinico_versiones'
);

select is(
  (select count(*)::int from public.historial_clinico_version where ficha_id = '75000000-0000-4000-a000-000000000201'),
  0,
  'subdireccion ve 0 filas en historial_clinico_version por RLS'
);

select * from finish();
rollback;
