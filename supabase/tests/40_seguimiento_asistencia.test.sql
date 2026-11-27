-- =====================================================================
-- 40_seguimiento_asistencia.test.sql (pgTAP · Tarjeta #88)
-- Verifica que registrar_seguimiento() exija p_cita_id obligatorio
-- y perteneciente al día de hoy (America/Mazatlan):
--   - anon / recepcion rechazados con 42501
--   - sin cita (null), cita inexistente, de ayer, de mañana, de otra
--     área, de otra persona o cancelada -> 23514
--   - cita válida de hoy ('agendada') -> éxito y pasa a 'asistio'
--   - misma cita dos veces -> 23505
-- =====================================================================

begin;

select plan(11);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

do $$
declare
  v_area_ts    smallint;
  v_area_psic  smallint;
  v_uid_ts     uuid := '94000000-0000-4000-a000-000000000001';
  v_uid_rec    uuid := '94000000-0000-4000-a000-000000000002';
  v_per_1      uuid := '94000000-0000-4000-a000-000000000101';
  v_per_2      uuid := '94000000-0000-4000-a000-000000000102';
  v_fic_1      uuid := '94000000-0000-4000-a000-000000000201';
  v_hoy_noon   timestamptz := (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '12 hours';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';

  insert into auth.users (id, email) values
    (v_uid_ts,  'test40.ts@semujeres.local'),
    (v_uid_rec, 'test40.rec@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,  'TS Asistencia Test',        'trabajo_social', v_area_ts, true),
    (v_uid_rec, 'Recepcion Asistencia Test', 'recepcion',      null,      true)
  on conflict (id) do nothing;

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_1, 'TETE910412MSLRRR01', 'Patricia', 'Vega',  v_uid_ts),
    (v_per_2, 'TATO920618MSLRRR02', 'Carmen',   'Solis', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_1, 'SEM-TEST40-01', v_per_1, now(), v_uid_ts);

  -- Citas de prueba: ayer, mañana, otra área (psicología hoy), otra persona hoy, cancelada hoy y válida hoy
  insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por) values
    ('94000000-0000-4000-a000-000000000301', v_per_1, v_area_ts,   v_hoy_noon - interval '1 day', 'agendada',  'regular', v_uid_rec),
    ('94000000-0000-4000-a000-000000000302', v_per_1, v_area_ts,   v_hoy_noon + interval '1 day', 'agendada',  'regular', v_uid_rec),
    ('94000000-0000-4000-a000-000000000303', v_per_1, v_area_psic, v_hoy_noon,                    'agendada',  'regular', v_uid_rec),
    ('94000000-0000-4000-a000-000000000304', v_per_2, v_area_ts,   v_hoy_noon,                    'agendada',  'regular', v_uid_rec),
    ('94000000-0000-4000-a000-000000000305', v_per_1, v_area_ts,   v_hoy_noon,                    'cancelada', 'regular', v_uid_rec),
    ('94000000-0000-4000-a000-000000000306', v_per_1, v_area_ts,   v_hoy_noon,                    'agendada',  'regular', v_uid_rec);
end $$;

-- 1-2. Seguridad: anon y recepcion -> 42501
set local role anon;
select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000306', 1::smallint)$$,
  '42501',
  null,
  'anon no puede ejecutar registrar_seguimiento'
);

select pg_temp.as_user('94000000-0000-4000-a000-000000000002');
select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000306', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '42501',
  null,
  'recepcion no puede ejecutar registrar_seguimiento'
);

-- 3-9. Validaciones 23514
select pg_temp.as_user('94000000-0000-4000-a000-000000000001');

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', null, (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'registrar_seguimiento sin p_cita_id (null) lanza 23514'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000999', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'cita inexistente lanza 23514'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000301', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'cita de ayer lanza 23514'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000302', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'cita de mañana lanza 23514'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000303', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'cita de otra área lanza 23514'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000304', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'cita de otra persona lanza 23514'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000305', (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '23514',
  null,
  'cita cancelada lanza 23514'
);

-- 10-11. Cita válida de hoy pasa a 'asistio' y rechaza duplicado con 23505
select * from public.registrar_seguimiento(
  '94000000-0000-4000-a000-000000000201',
  '94000000-0000-4000-a000-000000000306',
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  'Atención con cita del día.'
);

select is(
  (
    select c.estado::text
    from public.cita c
    where c.id = '94000000-0000-4000-a000-000000000306'
  ),
  'asistio',
  'cita válida de hoy pasa a estado asistio tras registrar seguimiento'
);

select throws_ok(
  $$select * from public.registrar_seguimiento('94000000-0000-4000-a000-000000000201', '94000000-0000-4000-a000-000000000306', (select id from public.cat_tipo_atencion where clave = 'orientacion'))$$,
  '23505',
  null,
  'misma cita dos veces lanza 23505'
);

select * from finish();

rollback;
