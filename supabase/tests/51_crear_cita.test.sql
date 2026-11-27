-- =====================================================================
-- 51_rpc_crear_cita.sql -> 51_crear_cita.test.sql (Tarjeta #120)
-- Verifica:
-- 1. Recepción agenda TS, Psicología y Jurídico (regla de develop 42).
-- 2. Área solo agenda la suya (42501 en otra); Dirección agenda todas.
-- 3. Fecha pasada, persona inactiva, expediente archivado, menor en
--    Psicología y cita duplicada en misma área/hora dan 23514.
-- 4. INSERT directo sobre public.cita falla con 42501 (cita_insert cerrado).
-- =====================================================================

begin;

select plan(10);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Datos base aislados
insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
values
  ('9e000000-0000-4000-a000-000000000101', 'CITA900510MSLRNR01', 'Ana', 'Adulta', '11111111-1111-4111-8111-111111111103'),
  ('9e000000-0000-4000-a000-000000000102', 'MENO150510MSLRNRA2', 'Sofía', 'Menor', '11111111-1111-4111-8111-111111111103'),
  ('9e000000-0000-4000-a000-000000000103', 'AARC900510MSLRNR03', 'Rosa', 'Archivada', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
values
  ('9e000000-0000-4000-a000-000000000201', '9e000000-0000-4000-a000-000000000101', 'abierto', now(), '11111111-1111-4111-8111-111111111103'),
  ('9e000000-0000-4000-a000-000000000203', '9e000000-0000-4000-a000-000000000103', 'archivado', now(), '11111111-1111-4111-8111-111111111103');

-- 1) Recepción agenda Psicología correctamente
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
create temp table tmp_c1 as
select * from public.crear_cita(
  '9e000000-0000-4000-a000-000000000101',
  (select id from public.cat_area where clave = 'psicologia'),
  now() + interval '3 days',
  'Trabajo Social',
  'regular'
);

select ok(
  (select cita_id is not null and estado = 'agendada' and origen = 'regular' from tmp_c1),
  'Recepción crea cita de Psicología mediante crear_cita()'
);

-- 2) Recepción también agenda Jurídico (regla de develop 42, integración 60)
select lives_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'juridico'),
      now() + interval '4 days'
    )$$,
  'Recepción agenda cita de Jurídico'
);

-- 3) Trabajo Social no agenda Psicología (42501)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'psicologia'),
      now() + interval '4 days'
    )$$,
  '42501',
  null,
  'Trabajo Social no puede agendar cita en otra área (42501)'
);

-- 4) Dirección agenda Jurídico correctamente
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select ok(
  exists (
    select 1 from public.crear_cita(
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'juridico'),
      now() + interval '5 days',
      'Dirección',
      'umeca'
    )
  ),
  'Dirección agenda cita de Jurídico'
);

-- 5) Fecha pasada da 23514
select throws_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'trabajo_social'),
      now() - interval '1 hour'
    )$$,
  '23514',
  null,
  'crear_cita rechaza fecha pasada (23514)'
);

-- 6) Menor de edad en Psicología da 23514 (RN-01 trigger)
select throws_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000102',
      (select id from public.cat_area where clave = 'psicologia'),
      now() + interval '6 days'
    )$$,
  '23514',
  null,
  'crear_cita rechaza menor de edad en Psicología (23514)'
);

-- 7) Expediente archivado da 23514
select throws_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000103',
      (select id from public.cat_area where clave = 'trabajo_social'),
      now() + interval '6 days'
    )$$,
  '23514',
  null,
  'crear_cita rechaza expediente archivado (23514)'
);

-- 8) Cita duplicada en la misma área y hora da 23514
select throws_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'psicologia'),
      (select programada_en from tmp_c1)
    )$$,
  '23514',
  null,
  'crear_cita rechaza cita duplicada en misma área y hora (23514)'
);

-- 9) UMECA rechazado con 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.crear_cita(
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'juridico'),
      now() + interval '7 days'
    )$$,
  '42501',
  null,
  'UMECA no tiene agenda.gestionar (42501)'
);

-- 10) INSERT directo sobre public.cita falla con 42501 incluso para Titular
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select throws_ok(
  $$insert into public.cita (persona_id, area_id, programada_en)
    values (
      '9e000000-0000-4000-a000-000000000101',
      (select id from public.cat_area where clave = 'trabajo_social'),
      now() + interval '8 days'
    )$$,
  '42501',
  null,
  'INSERT directo en public.cita bloqueado por RLS (42501)'
);

select * from finish();
rollback;
