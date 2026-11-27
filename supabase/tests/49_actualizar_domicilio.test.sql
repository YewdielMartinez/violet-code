-- =====================================================================
-- 49_actualizar_domicilio.test.sql (Tarjeta #112)
-- Verifica:
--   - Psicología / anon / recepcion rechazados con 42501.
--   - Expediente archivado -> 23514.
--   - Asentamiento + CP juntos o CP != 5 dígitos -> 23514.
--   - Fecha p_actualizado_en vieja -> 23505.
--   - Éxito crea nuevo domicilio como es_actual = true y deja el anterior
--     en es_actual = false (solo un domicilio actual).
--   - INSERT/UPDATE directos en domicilio bloqueados (42501).
-- =====================================================================

begin;

select plan(11);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Personas y fichas aisladas: una activa con domicilio actual, otra archivada
insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
  ('9d000000-0000-4000-a000-000000000101', 'DOMI900510MSLRNR01', 'Rosa', 'Domicilio', '11111111-1111-4111-8111-111111111103'),
  ('9d000000-0000-4000-a000-000000000102', 'AACH900510MSLRNR02', 'Inés', 'Archivada', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
  ('9d000000-0000-4000-a000-000000000201', '9d000000-0000-4000-a000-000000000101', 'abierto', now(), '11111111-1111-4111-8111-111111111103'),
  ('9d000000-0000-4000-a000-000000000202', '9d000000-0000-4000-a000-000000000102', 'archivado', now(), '11111111-1111-4111-8111-111111111103');

insert into public.domicilio (id, persona_id, calle, codigo_postal, es_actual, creado_por)
values ('9d000000-0000-4000-a000-000000000301', '9d000000-0000-4000-a000-000000000101', 'Calle Vieja 10', '81200', true, '11111111-1111-4111-8111-111111111103');

-- 1-2) anon y Psicología -> 42501
select is(has_function_privilege('anon', 'public.actualizar_domicilio(uuid, timestamptz, integer, text, text, text, text, text, public.zona_geografica)', 'execute'), false, 'anon sin EXECUTE en actualizar_domicilio');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.actualizar_domicilio('9d000000-0000-4000-a000-000000000101', now(), null, 'Calle Nueva')$$,
  '42501',
  null,
  'Psicología recibe 42501 en actualizar_domicilio'
);

-- 3-4) INSERT y UPDATE directos en domicilio fallan con 42501 para trabajo_social
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$insert into public.domicilio (persona_id, calle) values ('9d000000-0000-4000-a000-000000000101', 'Directa')$$,
  '42501',
  null,
  'INSERT directo en domicilio falla con 42501'
);

select throws_ok(
  $$update public.domicilio set calle = 'Directa' where id = '9d000000-0000-4000-a000-000000000301'$$,
  '42501',
  null,
  'UPDATE directo en domicilio falla con 42501'
);

-- 5) Expediente archivado -> 23514
select throws_ok(
  $$select * from public.actualizar_domicilio('9d000000-0000-4000-a000-000000000102', null, null, 'Calle Archivada')$$,
  '23514',
  null,
  'expediente archivado lanza 23514'
);

-- 6-7) Asentamiento + CP juntos o CP inválido -> 23514
select throws_ok(
  $$select * from public.actualizar_domicilio('9d000000-0000-4000-a000-000000000101', (select actualizado_en from public.domicilio where id = '9d000000-0000-4000-a000-000000000301'), (select id from public.cat_asentamiento limit 1), 'Calle', null, null, null, '81200')$$,
  '23514',
  null,
  'asentamiento y código postal juntos lanza 23514'
);

select throws_ok(
  $$select * from public.actualizar_domicilio('9d000000-0000-4000-a000-000000000101', (select actualizado_en from public.domicilio where id = '9d000000-0000-4000-a000-000000000301'), null, 'Calle', null, null, null, '123')$$,
  '23514',
  null,
  'código postal distinto de 5 dígitos lanza 23514'
);

-- 8) Fecha p_actualizado_en vieja -> 23505
select throws_ok(
  $$select * from public.actualizar_domicilio('9d000000-0000-4000-a000-000000000101', now() - interval '1 hour', null, 'Calle Concurrencia', null, null, null, '81210')$$,
  '23505',
  null,
  'p_actualizado_en vieja lanza 23505'
);

-- 9-11) Actualización exitosa: nuevo domicilio actual, anterior en false, solo 1 actual
select * from public.actualizar_domicilio(
  '9d000000-0000-4000-a000-000000000101',
  (select actualizado_en from public.domicilio where id = '9d000000-0000-4000-a000-000000000301'),
  null,
  'Calle Nueva 200',
  '200',
  null,
  'Frente al parque',
  '81210',
  'urbana'
);

select is(
  (select es_actual from public.domicilio where id = '9d000000-0000-4000-a000-000000000301'),
  false,
  'domicilio anterior pasa a es_actual = false'
);

select is(
  (select count(*)::integer from public.domicilio where persona_id = '9d000000-0000-4000-a000-000000000101' and activo and es_actual),
  1,
  'queda exactamente un domicilio actual activo'
);

select is(
  (select calle from public.domicilio where persona_id = '9d000000-0000-4000-a000-000000000101' and activo and es_actual),
  'Calle Nueva 200',
  'el domicilio actual corresponde al recién registrado'
);

select * from finish();
rollback;
