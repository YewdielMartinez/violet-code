-- =====================================================================
-- 22_agenda.test.sql (pgTAP)
-- Pruebas de integración para migración 22_rpc_agenda.sql:
--   - Seguridad: anon y empleado inactivo rechazados con 42501
--   - Aislamiento por rol/área: Recepción solo TS/Psicología (nunca Jurídico);
--     Psicología solo Psicología
--   - Validaciones de rango (31 días, p_hasta <= p_desde, p_limite = 0)
--   - Transiciones válidas e inválidas en cambiar_estado_cita
-- =====================================================================

begin;

select plan(17);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;
-- Desde la migración 31, las funciones nuevas no tienen EXECUTE para PUBLIC por defecto.
grant execute on function pg_temp.as_user(uuid) to public;

do $$
declare
  v_area_ts    smallint;
  v_area_psic  smallint;
  v_area_jur   smallint;
  v_uid_ts     uuid := '91000000-0000-4000-a000-000000000001';
  v_uid_psic   uuid := '91000000-0000-4000-a000-000000000002';
  v_uid_jur    uuid := '91000000-0000-4000-a000-000000000003';
  v_uid_rec    uuid := '91000000-0000-4000-a000-000000000004';
  v_uid_inact  uuid := '91000000-0000-4000-a000-000000000005';
  v_per_adult  uuid := '91000000-0000-4000-a000-000000000101';
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  insert into auth.users (id, email) values
    (v_uid_ts,    'agenda.ts@semujeres.local'),
    (v_uid_psic,  'agenda.psic@semujeres.local'),
    (v_uid_jur,   'agenda.jur@semujeres.local'),
    (v_uid_rec,   'agenda.rec@semujeres.local'),
    (v_uid_inact, 'agenda.inact@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,    'TS Agenda',         'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psicologia Agenda', 'psicologia',     v_area_psic, true),
    (v_uid_jur,   'Juridico Agenda',   'juridico',       v_area_jur,  true),
    (v_uid_rec,   'Recepcion Agenda',  'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Agenda',   'recepcion',      null,        false)
  on conflict (id) do nothing;
  update auth.users u set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true) where exists (select 1 from public.empleado e where e.id = u.id) and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  insert into public.persona (id, curp, nombres, apellido_paterno, celular, creado_por) values
    (v_per_adult, 'ROEL950512MSLRRR01', 'Elena', 'Rojas', '6681234567', v_uid_ts);

  insert into public.cita (id, persona_id, area_id, programada_en, estado, creado_por) values
    ('91000000-0000-4000-a000-000000000301', v_per_adult, v_area_ts,   '2099-06-15T09:00:00-07:00', 'agendada', v_uid_ts),
    ('91000000-0000-4000-a000-000000000302', v_per_adult, v_area_psic, '2099-06-15T10:00:00-07:00', 'agendada', v_uid_rec),
    ('91000000-0000-4000-a000-000000000303', v_per_adult, v_area_jur,  '2099-06-15T11:00:00-07:00', 'agendada', v_uid_jur);
end $$;

-- 1-2. Seguridad: anon rechazado en ambos RPCs
set local role anon;
select throws_ok(
  $$select * from public.get_agenda('2099-06-15T00:00:00-07:00', '2099-06-16T00:00:00-07:00')$$,
  '42501',
  null,
  'anon no puede consultar get_agenda'
);
select throws_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000301', 'confirmada')$$,
  '42501',
  null,
  'anon no puede ejecutar cambiar_estado_cita'
);

-- 3. Edge case seguridad: empleado inactivo rechazado con 42501
select pg_temp.as_user('91000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_agenda('2099-06-15T00:00:00-07:00', '2099-06-16T00:00:00-07:00')$$,
  '42501',
  null,
  'empleado inactivo no puede consultar get_agenda'
);

-- 4-5. Recepción ve y gestiona las 3 áreas (TS, Psicología y Jurídico) desde la migración 39
select pg_temp.as_user('91000000-0000-4000-a000-000000000004');
select is(
  (select count(*)::int from public.get_agenda('2099-06-15T00:00:00-07:00', '2099-06-16T00:00:00-07:00')),
  3,
  'recepcion ve citas de TS, Psicologia y Juridico'
);
select lives_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000303', 'confirmada')$$,
  'recepcion puede cambiar estado de cita de Juridico'
);

-- 6-7. Aislamiento Psicología: ve solo su área (1) y no puede cambiar cita de TS
select pg_temp.as_user('91000000-0000-4000-a000-000000000002');
select is(
  (select count(*)::int from public.get_agenda('2099-06-15T00:00:00-07:00', '2099-06-16T00:00:00-07:00')),
  1,
  'psicologia solo ve sus citas'
);
select throws_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000301', 'confirmada')$$,
  '42501',
  null,
  'psicologia no puede cambiar cita de Trabajo Social (42501)'
);

-- 8-11. Edge cases y validaciones de parámetros (23514)
select pg_temp.as_user('91000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.get_agenda('2099-06-01T00:00:00-07:00', '2099-07-05T00:00:00-07:00')$$,
  '23514',
  null,
  'get_agenda rechaza rango mayor a 31 dias con 23514'
);
select throws_ok(
  $$select * from public.get_agenda('2099-06-16T00:00:00-07:00', '2099-06-15T00:00:00-07:00')$$,
  '23514',
  null,
  'get_agenda rechaza p_hasta <= p_desde con 23514'
);
select throws_ok(
  $$select * from public.get_agenda('2099-06-15T00:00:00-07:00', '2099-06-16T00:00:00-07:00', null, null, 0)$$,
  '23514',
  null,
  'get_agenda rechaza p_limite = 0 con 23514'
);
select throws_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000999', 'confirmada')$$,
  '23514',
  null,
  'cambiar_estado_cita rechaza id inexistente con 23514'
);

-- 12. Estado asistio rechazado en cambiar_estado_cita (23514)
select throws_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000302', 'asistio')$$,
  '23514',
  null,
  'cambiar_estado_cita rechaza estado asistio con 23514'
);

-- 13. Camino feliz: agendada -> confirmada (llena confirmada_en)
select ok(
  (select estado = 'confirmada' and confirmada_en is not null
   from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000302', 'confirmada')),
  'confirmar cita cambia estado a confirmada y registra confirmada_en'
);

-- 14. Camino no feliz: confirmada -> confirmada rechazada
select throws_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000302', 'confirmada')$$,
  '23514',
  null,
  'reconfirmar cita ya confirmada da 23514'
);

-- 15. Camino feliz: confirmada -> cancelada con motivo (ejecutar RPC y verificar en sentencia siguiente)
select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000302', 'cancelada', '  Motivo familiar  ');
select is(
  (select motivo_cancelacion from public.cita where id = '91000000-0000-4000-a000-000000000302'),
  'Motivo familiar',
  'cancelar cita guarda motivo_cancelacion limpio'
);

-- 16. Transición desde terminal cancelada -> no_asistio rechazada (23514)
select throws_ok(
  $$select * from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000302', 'no_asistio')$$,
  '23514',
  null,
  'transicion desde terminal cancelada da 23514'
);

-- 17. Camino feliz: agendada -> no_asistio
select is(
  (select estado from public.cambiar_estado_cita('91000000-0000-4000-a000-000000000301', 'no_asistio')),
  'no_asistio'::public.estado_cita,
  'recepcion marca cita de TS como no_asistio'
);

select * from finish();

rollback;
