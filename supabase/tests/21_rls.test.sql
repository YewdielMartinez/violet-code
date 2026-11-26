-- =====================================================================
-- 21_rls.test.sql (A-06 · Sprint 01)
-- Verifica la matriz de acceso de roles-y-permisos.md §3 para las
-- 13 tablas reescritas en 21_rls_tiene_permiso.sql:
--   domicilio, ficha_registro, ficha_servicio_solicitado,
--   estudio_socioeconomico, aportante_hogar, agresor, orden_proteccion,
--   cita, atencion, nota_area, historial_clinico, derivacion, documento.
-- Además verifica que todas sus políticas usen tiene_permiso y envuelvan
-- los helpers en (select ...) (InitPlan).
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(79);

-- Fixtures deterministas (como superusuario antes de activar authenticated)
do $$
declare
  v_area_ts   smallint;
  v_area_psic smallint;
  v_area_jur  smallint;
  v_ta_ts     smallint;
  v_ta_psic   smallint;
  v_ta_jur    smallint;
  v_tdoc_ine  smallint;
  v_asent_1   integer;
  v_per_1     uuid := '33333333-3333-4333-8333-333333333301';
  v_dom_1     uuid := '44444444-4444-4444-8444-444444444401';
  v_ficha_1   uuid := '55555555-5555-4555-8555-555555555501';
  v_uid_ts    uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_psic  uuid := '11111111-1111-4111-8111-111111111104';
  v_uid_jur   uuid := '11111111-1111-4111-8111-111111111105';
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  select id into v_ta_ts   from public.cat_tipo_atencion where clave = 'entrevista_inicial';
  select id into v_ta_psic from public.cat_tipo_atencion where clave = 'valoracion_inicial';
  select id into v_ta_jur  from public.cat_tipo_atencion where clave = 'asesoria_juridica';

  select id into v_tdoc_ine from public.cat_tipo_documento order by id limit 1;
  select id into v_asent_1  from public.cat_asentamiento order by id limit 1;

  -- Persona adicional sin ficha para probar INSERT en ficha_registro bajo RLS
  insert into public.persona (
    id, curp, nombres, apellido_paterno, apellido_materno, celular, creado_por
  ) values (
    '33333333-2100-4000-8000-000000000091',
    'LOPE920410MSLNGR03', 'Laura', 'López', 'García', '6681000091', v_uid_ts
  )
  on conflict (id) do nothing;

  insert into public.documento (
    id, ficha_id, tipo_documento_id, descripcion, ruta_storage, nombre_archivo, creado_por
  ) values (
    'dddddddd-2100-4000-8000-000000000001',
    v_ficha_1, v_tdoc_ine, 'INE fixture A06', 'ficha-1/ine-a06.pdf', 'ine-a06.pdf', v_uid_ts
  )
  on conflict (id) do nothing;

  -- Citas fijas por área (TS, Psicología, Jurídico)
  insert into public.cita (
    id, persona_id, area_id, programada_en, prioridad, estado, origen, creado_por
  ) values
    ('cccccccc-2100-4000-8000-000000000001', v_per_1, v_area_ts,   now() + interval '10 days', 'media', 'agendada', 'regular', v_uid_ts),
    ('cccccccc-2100-4000-8000-000000000002', v_per_1, v_area_psic, now() + interval '11 days', 'media', 'agendada', 'regular', v_uid_psic),
    ('cccccccc-2100-4000-8000-000000000003', v_per_1, v_area_jur,  now() + interval '12 days', 'media', 'agendada', 'regular', v_uid_jur)
  on conflict (id) do nothing;

  -- Atenciones fijas por área (TS, Psicología, Jurídico)
  insert into public.atencion (
    id, ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
    domicilio_id, acciones_realizadas, prioridad, creado_por
  ) values
    ('eeeeeeee-2100-4000-8000-000000000001', v_ficha_1, v_area_ts,   v_ta_ts,   v_uid_ts,   now() - interval '2 days', v_dom_1, 'Fixture TS A06',   'media', v_uid_ts),
    ('eeeeeeee-2100-4000-8000-000000000002', v_ficha_1, v_area_psic, v_ta_psic, v_uid_psic, now() - interval '2 days', v_dom_1, 'Fixture Psic A06', 'media', v_uid_psic),
    ('eeeeeeee-2100-4000-8000-000000000003', v_ficha_1, v_area_jur,  v_ta_jur,  v_uid_jur,  now() - interval '2 days', v_dom_1, 'Fixture Jur A06',  'media', v_uid_jur)
  on conflict (id) do nothing;

  -- Notas privadas fijas por área (TS, Psicología, Jurídico)
  insert into public.nota_area (id, ficha_id, area_id, contenido, creado_por) values
    ('ffffffff-2100-4000-8000-000000000001', v_ficha_1, v_area_ts,   'Nota privada TS A06',   v_uid_ts),
    ('ffffffff-2100-4000-8000-000000000002', v_ficha_1, v_area_psic, 'Nota privada Psic A06', v_uid_psic),
    ('ffffffff-2100-4000-8000-000000000003', v_ficha_1, v_area_jur,  'Nota privada Jur A06',  v_uid_jur)
  on conflict (id) do nothing;

  -- Derivaciones fijas: TS->Psic, Psic->Jur, TS->externa
  insert into public.derivacion (
    id, ficha_id, area_origen_id, area_destino_id, destino, institucion_otra, motivo, fecha_derivacion, estado, creado_por
  ) values
    ('a1a1a1a1-2100-4000-8000-000000000001', v_ficha_1, v_area_ts,   v_area_psic, 'psicologia',       null,                     'Derivacion fixture TS->Psic', current_date, 'pendiente', v_uid_ts),
    ('a1a1a1a1-2100-4000-8000-000000000002', v_ficha_1, v_area_psic, v_area_jur,  'juridico',         null,                     'Derivacion fixture Psic->Jur', current_date, 'pendiente', v_uid_psic),
    ('a1a1a1a1-2100-4000-8000-000000000003', v_ficha_1, v_area_ts,   null,        'otra_institucion', 'Institucion Fixture A06', 'Derivacion fixture TS->Ext',  current_date, 'pendiente', v_uid_ts)
  on conflict (id) do nothing;
end;
$$;

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
end;
$$;

set local role authenticated;

-- =====================================================================
-- 1. domicilio, documento, agresor
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select ok((select count(*) >= 1 from public.domicilio), 'titular lee domicilio');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select lives_ok(
  $$insert into public.domicilio (id, persona_id, calle, es_actual) values ('44444444-2100-4000-8000-000000000091', '33333333-3333-4333-8333-333333333301', 'Calle A06', false)$$,
  'trabajo_social inserta domicilio'
);
select lives_ok(
  $$update public.domicilio set referencias = 'Ref A06' where id = '44444444-2100-4000-8000-000000000091'$$,
  'trabajo_social actualiza domicilio'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select lives_ok(
  $$insert into public.documento (ficha_id, tipo_documento_id, ruta_storage, nombre_archivo) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_tipo_documento order by id limit 1), 'ficha-1/psic-a06.pdf', 'psic-a06.pdf')$$,
  'psicologia inserta documento'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select lives_ok(
  $$update public.agresor set observaciones = 'Act A06' where id = '77777777-7777-4777-8777-777777777701'$$,
  'juridico actualiza agresor'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.domicilio), 0, 'recepcion no lee domicilio');
select is((select count(*)::int from public.documento), 0, 'recepcion no lee documento');
select is((select count(*)::int from public.agresor), 0, 'recepcion no lee agresor');
select throws_ok(
  $$insert into public.domicilio (persona_id, calle) values ('33333333-3333-4333-8333-333333333301', 'X')$$,
  '42501', null, 'recepcion no inserta domicilio'
);
select throws_ok(
  $$insert into public.documento (ficha_id, tipo_documento_id, ruta_storage, nombre_archivo) values ('55555555-5555-4555-8555-555555555501', 1, 'x/x.pdf', 'x.pdf')$$,
  '42501', null, 'recepcion no inserta documento'
);
select throws_ok(
  $$insert into public.agresor (ficha_id, nombres) values ('55555555-5555-4555-8555-555555555501', 'Agresor X')$$,
  '42501', null, 'recepcion no inserta agresor'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select is((select count(*)::int from public.domicilio), 0, 'umeca no lee domicilio');
select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'::uuid); -- usuaria.app
select throws_ok(
  $$insert into public.agresor (ficha_id, nombres) values ('55555555-5555-4555-8555-555555555501', 'Agresor App')$$,
  '42501', null, 'usuaria app no inserta agresor'
);

-- =====================================================================
-- 2. ficha_registro, ficha_servicio_solicitado, estudio_socioeconomico, aportante_hogar
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select lives_ok(
  $$insert into public.ficha_registro (id, persona_id, aviso_privacidad_aceptado_en) values ('55555555-2100-4000-8000-000000000091', '33333333-2100-4000-8000-000000000091', now())$$,
  'titular inserta ficha_registro'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select lives_ok(
  $$update public.ficha_registro set tiene_trabajo = false where id = '55555555-2100-4000-8000-000000000091'$$,
  'trabajo_social actualiza ficha_registro'
);
select lives_ok(
  $$insert into public.ficha_servicio_solicitado (ficha_id, area_id) values ('55555555-2100-4000-8000-000000000091', (select id from public.cat_area where clave = 'trabajo_social'))$$,
  'trabajo_social inserta ficha_servicio_solicitado'
);
select lives_ok(
  $$delete from public.ficha_servicio_solicitado where ficha_id = '55555555-2100-4000-8000-000000000091'$$,
  'trabajo_social borra ficha_servicio_solicitado'
);
select lives_ok(
  $$insert into public.estudio_socioeconomico (id, ficha_id, es_actual) values ('66666666-2100-4000-8000-000000000091', '55555555-2100-4000-8000-000000000091', false)$$,
  'trabajo_social inserta estudio_socioeconomico'
);
select lives_ok(
  $$insert into public.aportante_hogar (estudio_socioeconomico_id, nombre) values ('66666666-2100-4000-8000-000000000091', 'Aportante A06')$$,
  'trabajo_social inserta aportante_hogar'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select ok((select count(*) >= 1 from public.ficha_registro), 'psicologia lee ficha_registro');
select ok((select count(*) >= 1 from public.estudio_socioeconomico), 'psicologia lee estudio_socioeconomico');
select throws_ok(
  $$insert into public.ficha_registro (persona_id, aviso_privacidad_aceptado_en) values ('33333333-3333-4333-8333-333333333301', now())$$,
  '42501', null, 'psicologia no inserta ficha_registro'
);
select throws_ok(
  $$insert into public.ficha_servicio_solicitado (ficha_id, area_id) values ('55555555-5555-4555-8555-555555555502', (select id from public.cat_area where clave = 'juridico'))$$,
  '42501', null, 'psicologia no inserta ficha_servicio_solicitado'
);
select throws_ok(
  $$insert into public.estudio_socioeconomico (ficha_id, es_actual) values ('55555555-5555-4555-8555-555555555501', false)$$,
  '42501', null, 'psicologia no inserta estudio_socioeconomico'
);
select throws_ok(
  $$insert into public.aportante_hogar (estudio_socioeconomico_id, nombre) values ('66666666-6666-4666-8666-666666666601', 'X')$$,
  '42501', null, 'psicologia no inserta aportante_hogar'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
with del as (
  delete from public.ficha_servicio_solicitado
  where ficha_id = '55555555-5555-4555-8555-555555555501'
  returning 1
)
select is((select count(*)::int from del), 0, 'juridico no borra ficha_servicio_solicitado');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.ficha_registro), 0, 'recepcion no lee ficha_registro');
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select is((select count(*)::int from public.ficha_registro), 0, 'umeca no lee ficha_registro');

-- =====================================================================
-- 3. orden_proteccion
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select lives_ok(
  $$insert into public.orden_proteccion (id, ficha_id, fecha_emision) values ('88888888-2100-4000-8000-000000000091', '55555555-5555-4555-8555-555555555501', current_date)$$,
  'juridico inserta orden_proteccion'
);
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select lives_ok(
  $$update public.orden_proteccion set autoridad_emisora = 'Juzgado A06' where id = '88888888-2100-4000-8000-000000000091'$$,
  'trabajo_social actualiza orden_proteccion'
);
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select ok((select count(*) >= 1 from public.orden_proteccion), 'psicologia lee orden_proteccion');
select throws_ok(
  $$insert into public.orden_proteccion (ficha_id, fecha_emision) values ('55555555-5555-4555-8555-555555555501', current_date)$$,
  '42501', null, 'psicologia no inserta orden_proteccion'
);
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.orden_proteccion), 0, 'recepcion no lee orden_proteccion');

-- =====================================================================
-- 4. cita (ABAC por área y rol)
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  (select count(*)::int from public.cita where id in ('cccccccc-2100-4000-8000-000000000001','cccccccc-2100-4000-8000-000000000002','cccccccc-2100-4000-8000-000000000003')),
  3, 'titular ve citas de todas las areas'
);
select lives_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'juridico'), now() + interval '20 days')$$,
  'titular inserta cita de juridico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is(
  (select count(*)::int from public.cita where id in ('cccccccc-2100-4000-8000-000000000001','cccccccc-2100-4000-8000-000000000002','cccccccc-2100-4000-8000-000000000003')),
  2, 'recepcion ve citas de TS y Psic, no Jur'
);
select lives_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'psicologia'), now() + interval '21 days')$$,
  'recepcion agenda cita de psicologia'
);
select throws_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'juridico'), now() + interval '22 days')$$,
  '42501', null, 'recepcion no agenda cita de juridico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (select count(*)::int from public.cita where id in ('cccccccc-2100-4000-8000-000000000001','cccccccc-2100-4000-8000-000000000002','cccccccc-2100-4000-8000-000000000003')),
  2, 'trabajo_social ve citas de TS y Psic, no Jur'
);
select lives_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'trabajo_social'), now() + interval '23 days')$$,
  'trabajo_social inserta cita en su area'
);
select throws_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'psicologia'), now() + interval '24 days')$$,
  '42501', null, 'trabajo_social no inserta cita de psicologia'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select count(*)::int from public.cita where id in ('cccccccc-2100-4000-8000-000000000001','cccccccc-2100-4000-8000-000000000002','cccccccc-2100-4000-8000-000000000003')),
  1, 'psicologia solo ve su cita'
);
select throws_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'trabajo_social'), now() + interval '25 days')$$,
  '42501', null, 'psicologia no inserta cita de TS'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is(
  (select count(*)::int from public.cita where id in ('cccccccc-2100-4000-8000-000000000001','cccccccc-2100-4000-8000-000000000002','cccccccc-2100-4000-8000-000000000003')),
  1, 'juridico solo ve su cita'
);
select lives_ok(
  $$insert into public.cita (persona_id, area_id, programada_en) values ('33333333-3333-4333-8333-333333333301', (select id from public.cat_area where clave = 'juridico'), now() + interval '26 days')$$,
  'juridico inserta cita en su area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select is((select count(*)::int from public.cita), 0, 'umeca no lee cita directo');
select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'::uuid); -- usuaria.app
select is((select count(*)::int from public.cita), 0, 'usuaria app no lee cita');

-- =====================================================================
-- 5. atencion (ABAC por área; Dirección global)
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  (select count(*)::int from public.atencion where id in ('eeeeeeee-2100-4000-8000-000000000001','eeeeeeee-2100-4000-8000-000000000002','eeeeeeee-2100-4000-8000-000000000003')),
  3, 'titular ve atenciones de todas las areas'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (select count(*)::int from public.atencion where id in ('eeeeeeee-2100-4000-8000-000000000001','eeeeeeee-2100-4000-8000-000000000002','eeeeeeee-2100-4000-8000-000000000003')),
  1, 'trabajo_social solo ve su atencion'
);
select throws_ok(
  $$insert into public.atencion (ficha_id, area_id, tipo_atencion_id) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'psicologia'), (select id from public.cat_tipo_atencion where clave = 'valoracion_inicial'))$$,
  '42501', null, 'trabajo_social no inserta atencion de otra area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
with upd as (
  update public.atencion set observaciones = 'Act Psic'
  where id = 'eeeeeeee-2100-4000-8000-000000000002'
  returning 1
)
select is((select count(*)::int from upd), 1, 'psicologia actualiza su atencion');
with upd as (
  update public.atencion set observaciones = 'Act TS'
  where id = 'eeeeeeee-2100-4000-8000-000000000001'
  returning 1
)
select is((select count(*)::int from upd), 0, 'psicologia no actualiza atencion de TS');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select lives_ok(
  $$insert into public.atencion (ficha_id, area_id, tipo_atencion_id) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'juridico'), (select id from public.cat_tipo_atencion where clave = 'asesoria_juridica'))$$,
  'juridico inserta atencion en su area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.atencion), 0, 'recepcion no lee atencion');

-- =====================================================================
-- 6. nota_area (privada por área; Dirección sin acceso)
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is((select count(*)::int from public.nota_area), 0, 'titular no lee nota_area');
select throws_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'trabajo_social'), 'Nota titular')$$,
  '42501', null, 'titular no inserta nota_area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (select count(*)::int from public.nota_area where id in ('ffffffff-2100-4000-8000-000000000001','ffffffff-2100-4000-8000-000000000002','ffffffff-2100-4000-8000-000000000003')),
  1, 'trabajo_social solo ve su nota_area'
);
select throws_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'psicologia'), 'Nota ajena')$$,
  '42501', null, 'trabajo_social no inserta nota_area de otra area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select count(*)::int from public.nota_area where id in ('ffffffff-2100-4000-8000-000000000001','ffffffff-2100-4000-8000-000000000002','ffffffff-2100-4000-8000-000000000003')),
  1, 'psicologia solo ve su nota_area'
);
select lives_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'psicologia'), 'Nota nueva Psic')$$,
  'psicologia inserta su nota_area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is(
  (select count(*)::int from public.nota_area where id in ('ffffffff-2100-4000-8000-000000000001','ffffffff-2100-4000-8000-000000000002','ffffffff-2100-4000-8000-000000000003')),
  1, 'juridico solo ve su nota_area'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.nota_area), 0, 'recepcion no lee nota_area');

-- =====================================================================
-- 7. historial_clinico
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select ok((select count(*) >= 1 from public.historial_clinico), 'titular lee historial_clinico');
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select lives_ok(
  $$insert into public.historial_clinico (ficha_id, motivo_consulta) values ('55555555-5555-4555-8555-555555555502', 'Motivo A06')$$,
  'psicologia inserta historial_clinico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is((select count(*)::int from public.historial_clinico), 0, 'trabajo_social no lee historial_clinico');
select throws_ok(
  $$insert into public.historial_clinico (ficha_id, motivo_consulta) values ('55555555-5555-4555-8555-555555555502', 'X')$$,
  '42501', null, 'trabajo_social no inserta historial_clinico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is((select count(*)::int from public.historial_clinico), 0, 'juridico no lee historial_clinico');
select throws_ok(
  $$insert into public.historial_clinico (ficha_id, motivo_consulta) values ('55555555-5555-4555-8555-555555555502', 'X')$$,
  '42501', null, 'juridico no inserta historial_clinico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.historial_clinico), 0, 'recepcion no lee historial_clinico');

-- =====================================================================
-- 8. derivacion
-- =====================================================================
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  (select count(*)::int from public.derivacion where id in ('a1a1a1a1-2100-4000-8000-000000000001','a1a1a1a1-2100-4000-8000-000000000002','a1a1a1a1-2100-4000-8000-000000000003')),
  3, 'titular ve todas las derivaciones'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (select count(*)::int from public.derivacion where id in ('a1a1a1a1-2100-4000-8000-000000000001','a1a1a1a1-2100-4000-8000-000000000002','a1a1a1a1-2100-4000-8000-000000000003')),
  3, 'trabajo_social ve todas las derivaciones'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select count(*)::int from public.derivacion where id in ('a1a1a1a1-2100-4000-8000-000000000001','a1a1a1a1-2100-4000-8000-000000000002','a1a1a1a1-2100-4000-8000-000000000003')),
  2, 'psicologia solo ve derivaciones donde es origen o destino'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is(
  (select count(*)::int from public.derivacion where id in ('a1a1a1a1-2100-4000-8000-000000000001','a1a1a1a1-2100-4000-8000-000000000002','a1a1a1a1-2100-4000-8000-000000000003')),
  1, 'juridico solo ve derivaciones donde es origen o destino'
);
select lives_ok(
  $$insert into public.derivacion (ficha_id, area_origen_id, destino, institucion_otra, motivo) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'juridico'), 'otra_institucion', 'Fiscalia A06', 'Prueba Jur')$$,
  'juridico inserta derivacion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is((select count(*)::int from public.derivacion), 0, 'recepcion no lee derivacion');
select throws_ok(
  $$insert into public.derivacion (ficha_id, area_origen_id, destino, institucion_otra, motivo) values ('55555555-5555-4555-8555-555555555501', (select id from public.cat_area where clave = 'trabajo_social'), 'otra_institucion', 'X', 'X')$$,
  '42501', null, 'recepcion no inserta derivacion'
);

-- =====================================================================
-- 9. Verificación estructural en pg_policies (40 políticas con tiene_permiso y (select ...))
-- =====================================================================
reset role;

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'domicilio','ficha_registro','ficha_servicio_solicitado',
        'estudio_socioeconomico','aportante_hogar','agresor','orden_proteccion',
        'cita','atencion','nota_area','historial_clinico','derivacion','documento'
      )
  ),
  40,
  'existen exactamente 40 politicas RLS en las 13 tablas de A-06'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'domicilio','ficha_registro','ficha_servicio_solicitado',
        'estudio_socioeconomico','aportante_hogar','agresor','orden_proteccion',
        'cita','atencion','nota_area','historial_clinico','derivacion','documento'
      )
      and coalesce(qual, '') || ' ' || coalesce(with_check, '') not like '%tiene_permiso(%'
  ),
  0,
  'todas las politicas de las 13 tablas usan tiene_permiso()'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'domicilio','ficha_registro','ficha_servicio_solicitado',
        'estudio_socioeconomico','aportante_hogar','agresor','orden_proteccion',
        'cita','atencion','nota_area','historial_clinico','derivacion','documento'
      )
      and (
        regexp_replace(
          coalesce(qual, '') || ' ' || coalesce(with_check, ''),
          '\(\s*SELECT\s+(?:public\.)?(?:tiene_permiso|auth_rol|auth_area_id|es_direccion|es_area_atencion|area_id_por_clave)\s*\(',
          '(',
          'gi'
        ) ~* '(tiene_permiso|auth_rol|auth_area_id|es_direccion|es_area_atencion|area_id_por_clave)\s*\('
      )
  ),
  0,
  'ninguna politica de las 13 tablas llama helpers RLS fuera de (select ...)'
);

select * from finish();
rollback;
