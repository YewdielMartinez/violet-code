-- =====================================================================
-- 42_agenda_busqueda_umeca.test.sql
-- Pruebas pgTAP para la migración 20261127001100_42_agenda_busqueda_umeca.sql:
--   - Regla de creación de citas: psicologia solo en su área; titular y
--     subdireccion en cualquier área; trabajo_social ninguna; recepcion en
--     TS/Psicología/Jurídico; juridico solo Jurídico.
--   - buscar_personas_agenda(): permiso agenda.crear (42501), mínimo 3
--     caracteres, sin acentos/mayúsculas, prefijo de CURP enmascarada,
--     exclusión de expedientes archivados / personas inactivas / sin
--     ficha, escape de comodines, límite 1..25 y orden.
--   - get_umeca_citas(): expone area_clave y area_nombre.
-- Usa los usuarios del seed (11111111-1111-4111-8111-1111111111xx).
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(33);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.as_user(uuid) to public;

do $$
declare
  v_uid_jur  uuid := '11111111-1111-4111-8111-111111111105';
  v_area_jur smallint;
begin
  select id into v_area_jur from public.cat_area where clave = 'juridico';

  insert into public.persona (id, curp, nombres, apellido_paterno, apellido_materno, celular, creado_por) values
    ('97000000-0000-4000-a000-000000000101', 'PEPZ900101MSLRRR01', 'Zuleima', 'Peñaloza', 'Ríos', '6681110001', v_uid_jur),
    ('97000000-0000-4000-a000-000000000102', 'ZUPR910202MSLRRR02', 'Zuleima', 'Quintana', null, '6681110002', v_uid_jur),
    ('97000000-0000-4000-a000-000000000103', 'ZUPA920303MSLRRR03', 'Zuleima', 'Archivada', null, '6681110003', v_uid_jur),
    ('97000000-0000-4000-a000-000000000104', 'ZUPB930404MSLRRR04', 'Zuleima', 'Inactiva', null, '6681110004', v_uid_jur),
    ('97000000-0000-4000-a000-000000000105', 'ZUPC940505MSLRRR05', 'Zuleima', 'Sinficha', null, '6681110005', v_uid_jur);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
    ('97000000-0000-4000-a000-000000000201', 'SEM-BAM-0001', '97000000-0000-4000-a000-000000000101', 'abierto',   now(), v_uid_jur),
    ('97000000-0000-4000-a000-000000000202', 'SEM-BAM-0002', '97000000-0000-4000-a000-000000000102', 'abierto',   now(), v_uid_jur),
    ('97000000-0000-4000-a000-000000000203', 'SEM-BAM-0003', '97000000-0000-4000-a000-000000000103', 'archivado', now(), v_uid_jur),
    ('97000000-0000-4000-a000-000000000204', 'SEM-BAM-0004', '97000000-0000-4000-a000-000000000104', 'abierto',   now(), v_uid_jur);

  update public.persona set activo = false where id = '97000000-0000-4000-a000-000000000104';

  insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
  values ('97000000-0000-4000-a000-000000000301', '97000000-0000-4000-a000-000000000101', v_area_jur,
          '2099-08-01T15:00:00-07:00', 'agendada', 'umeca', v_uid_jur);
end $$;

-- 1-3. psicologia: crea en su area, no en juridico ni TS
select pg_temp.as_user('11111111-1111-4111-8111-111111111104'); -- psicologia
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-01T10:00:00-07:00')$$,
  'psicologia crea cita de psicologia'
);
select throws_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'juridico'), '2099-09-02T10:00:00-07:00')$$,
  '42501', null, 'psicologia no crea cita de juridico'
);
select throws_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-03T10:00:00-07:00')$$,
  '42501', null, 'psicologia no crea cita de trabajo_social'
);

-- 4-6. titular crea en cualquier area
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-04T10:00:00-07:00')$$,
  'titular crea cita de trabajo_social'
);
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-05T10:00:00-07:00')$$,
  'titular crea cita de psicologia'
);
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'juridico'), '2099-09-06T10:00:00-07:00')$$,
  'titular crea cita de juridico'
);

-- 7-8. subdireccion crea en cualquier area
select pg_temp.as_user('11111111-1111-4111-8111-111111111102'); -- subdireccion
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-07T10:00:00-07:00')$$,
  'subdireccion crea cita de trabajo_social'
);
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'juridico'), '2099-09-08T10:00:00-07:00')$$,
  'subdireccion crea cita de juridico'
);

-- 9-10. trabajo_social no crea (ni en su area ni en otra)
select pg_temp.as_user('11111111-1111-4111-8111-111111111103'); -- trabajo_social
select throws_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-09T10:00:00-07:00')$$,
  '42501', null, 'trabajo_social no crea cita de trabajo_social'
);
select throws_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-10T10:00:00-07:00')$$,
  '42501', null, 'trabajo_social no crea cita de psicologia'
);

-- 11-12. recepcion crea; juridico no crea en psicologia
select pg_temp.as_user('11111111-1111-4111-8111-111111111106'); -- recepcion
select lives_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-11T10:00:00-07:00')$$,
  'recepcion crea cita de psicologia'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111105'); -- juridico
select throws_ok(
  $$select * from public.crear_cita('97000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-12T10:00:00-07:00')$$,
  '42501', null, 'juridico no crea cita de psicologia'
);

-- 13. area nula nunca es creable
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select is(public.puede_crear_cita_en_area(null), false, 'puede_crear_cita_en_area(null) = false');

-- 14-15. buscar_personas_agenda: permiso
select pg_temp.as_user('11111111-1111-4111-8111-111111111103'); -- trabajo_social
select throws_ok(
  $$select * from public.buscar_personas_agenda('zuleima')$$,
  '42501', null, 'trabajo_social no puede buscar personas para agenda (42501)'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111107'); -- umeca
select throws_ok(
  $$select * from public.buscar_personas_agenda('zuleima')$$,
  '42501', null, 'umeca no puede buscar personas para agenda (42501)'
);

-- 16-26. buscar_personas_agenda: comportamiento (recepcion)
select pg_temp.as_user('11111111-1111-4111-8111-111111111106'); -- recepcion
select is(
  (select count(*)::int from public.buscar_personas_agenda('zu')),
  0,
  'menos de 3 caracteres devuelve vacio'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('  ZULEIMA ')),
  2,
  'busca por nombre sin distinguir mayusculas; excluye archivado, inactivo y sin ficha'
);
select is(
  (select nombre_completo from public.buscar_personas_agenda('PENALOZA')),
  'Zuleima Peñaloza Ríos',
  'busqueda sin acentos (PENALOZA encuentra Peñaloza)'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('zuleima rios')),
  1,
  'varios terminos: todos deben coincidir'
);
select is(
  (select curp_enmascarada from public.buscar_personas_agenda('pepz9')),
  'PEPZ******01',
  'busqueda por prefijo de CURP (minusculas) y CURP enmascarada'
);
select is(
  (select folio from public.buscar_personas_agenda('pepz9')),
  'SEM-BAM-0001',
  'devuelve el folio del expediente'
);
select is(
  (select ficha_id from public.buscar_personas_agenda('pepz9')),
  '97000000-0000-4000-a000-000000000201'::uuid,
  'devuelve ficha_id del expediente'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('archivada')),
  0,
  'excluye personas con expediente archivado'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('inactiva')),
  0,
  'excluye personas inactivas'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('sinficha')),
  0,
  'excluye personas sin expediente'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('%%%')),
  0,
  'los comodines de LIKE se escapan'
);

-- 27-29. limite y orden
select is(
  (select count(*)::int from public.buscar_personas_agenda('zuleima', 1)),
  1,
  'p_limite = 1 devuelve una fila'
);
select is(
  (select count(*)::int from public.buscar_personas_agenda('zuleima', 0)),
  1,
  'p_limite < 1 se acota a 1'
);
select is(
  (select nombre_completo from public.buscar_personas_agenda('zuleima') limit 1),
  'Zuleima Peñaloza Ríos',
  'ordena por nombre cuando el rango de coincidencia es igual'
);

-- 30-31. otros roles con agenda.crear pueden buscar
select pg_temp.as_user('11111111-1111-4111-8111-111111111104'); -- psicologia
select is(
  (select count(*)::int from public.buscar_personas_agenda('zuleima')),
  2,
  'psicologia puede buscar personas'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select is(
  (select count(*)::int from public.buscar_personas_agenda('zuleima')),
  2,
  'titular puede buscar personas'
);

-- 32-33. get_umeca_citas expone el area
select pg_temp.as_user('11111111-1111-4111-8111-111111111107'); -- umeca
select is(
  (select area_clave from public.get_umeca_citas() where cita_id = '97000000-0000-4000-a000-000000000301'),
  'juridico',
  'get_umeca_citas expone area_clave'
);
select is(
  (select area_nombre from public.get_umeca_citas() where cita_id = '97000000-0000-4000-a000-000000000301'),
  (select nombre from public.cat_area where clave = 'juridico'),
  'get_umeca_citas expone area_nombre'
);

select * from finish();
rollback;
