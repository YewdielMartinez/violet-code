-- =====================================================================
-- 40_agenda_permisos_creacion.test.sql
-- Pruebas pgTAP para la migración 20261127000900_40_agenda_permisos_creacion.sql
-- (con la regla de creación vigente tras 20261127001100_42_agenda_busqueda_umeca.sql):
--   - Clave agenda.crear: recepcion, juridico, psicologia, titular y
--     subdireccion (trabajo_social no).
--   - Crear citas (RPC crear_cita; el insert directo está cerrado desde la 51): recepcion en TS/Psic/Juridico;
--     juridico solo en Juridico; psicologia solo en Psicologia;
--     titular/subdireccion en cualquier area; trabajo_social no puede.
--   - Recepcion ve (get_agenda + SELECT) y gestiona (cambiar_estado_cita,
--     reagendar_cita) citas de Juridico.
--   - reagendar_cita = crear: bloqueado para TS (y para psicologia fuera de
--     su area); permitido para recepcion (3 areas), juridico/psicologia
--     (propia area) y titular/subdireccion.
--   - registrar_seguimiento con proxima cita: permitido a juridico; TS no.
--   - get_umeca_citas() sigue funcionando para UMECA.
-- Usa los usuarios del seed (11111111-1111-4111-8111-1111111111xx).
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(32);

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
  v_area_ts   smallint;
  v_area_psic smallint;
  v_area_jur  smallint;
  v_uid_jur   uuid := '11111111-1111-4111-8111-111111111105';
  v_per       uuid := '96000000-0000-4000-a000-000000000101';
  v_fic       uuid := '96000000-0000-4000-a000-000000000201';
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  insert into public.persona (id, curp, nombres, apellido_paterno, celular, creado_por)
  values (v_per, 'AEGR900101MSLRRR01', 'Agenda', 'Creacion', '6681234567', v_uid_jur);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
  values (v_fic, 'SEM-AGC-0001', v_per, 'abierto', now(), v_uid_jur);

  insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por) values
    ('96000000-0000-4000-a000-000000000301', v_per, v_area_jur,  '2099-08-01T10:00:00-07:00', 'agendada', 'regular', v_uid_jur),
    ('96000000-0000-4000-a000-000000000302', v_per, v_area_jur,  '2099-08-01T11:00:00-07:00', 'agendada', 'regular', v_uid_jur),
    ('96000000-0000-4000-a000-000000000303', v_per, v_area_jur,  '2099-08-01T12:00:00-07:00', 'agendada', 'regular', v_uid_jur),
    ('96000000-0000-4000-a000-000000000304', v_per, v_area_psic, '2099-08-01T13:00:00-07:00', 'agendada', 'regular', v_uid_jur),
    ('96000000-0000-4000-a000-000000000305', v_per, v_area_ts,   '2099-08-01T14:00:00-07:00', 'agendada', 'regular', v_uid_jur),
    ('96000000-0000-4000-a000-000000000306', v_per, v_area_jur,  '2099-08-01T15:00:00-07:00', 'agendada', 'umeca',   v_uid_jur);

  -- Citas de hoy para registrar_seguimiento (desde la 54 exige la cita del día).
  insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por) values
    ('96000000-0000-4000-a000-000000000307', v_per, v_area_jur, ((now() at time zone 'America/Mazatlan')::date + time '12:00') at time zone 'America/Mazatlan', 'agendada', 'regular', v_uid_jur),
    ('96000000-0000-4000-a000-000000000308', v_per, v_area_ts,  ((now() at time zone 'America/Mazatlan')::date + time '13:00') at time zone 'America/Mazatlan', 'agendada', 'regular', v_uid_jur);
end $$;

-- 1-6. Clave agenda.crear por rol
select pg_temp.as_user('11111111-1111-4111-8111-111111111106'); -- recepcion
select is(public.tiene_permiso('agenda.crear'), true, 'recepcion: agenda.crear = true');
select pg_temp.as_user('11111111-1111-4111-8111-111111111105'); -- juridico
select is(public.tiene_permiso('agenda.crear'), true, 'juridico: agenda.crear = true');
select pg_temp.as_user('11111111-1111-4111-8111-111111111103'); -- trabajo_social
select is(public.tiene_permiso('agenda.crear'), false, 'trabajo_social: agenda.crear = false');
select pg_temp.as_user('11111111-1111-4111-8111-111111111104'); -- psicologia
select is(public.tiene_permiso('agenda.crear'), true, 'psicologia: agenda.crear = true');
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select is(public.tiene_permiso('agenda.crear'), true, 'titular: agenda.crear = true');
select pg_temp.as_user('11111111-1111-4111-8111-111111111102'); -- subdireccion
select is(public.tiene_permiso('agenda.crear'), true, 'subdireccion: agenda.crear = true');

-- 7-9. recepcion crea en las 3 areas
select pg_temp.as_user('11111111-1111-4111-8111-111111111106'); -- recepcion
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-01T10:00:00-07:00')$$,
  'recepcion crea cita de trabajo_social'
);
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-02T10:00:00-07:00')$$,
  'recepcion crea cita de psicologia'
);
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'juridico'), '2099-09-03T10:00:00-07:00')$$,
  'recepcion crea cita de juridico'
);

-- 10-12. juridico: crea en su area, no en psicologia ni TS
select pg_temp.as_user('11111111-1111-4111-8111-111111111105'); -- juridico
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'juridico'), '2099-09-04T10:00:00-07:00')$$,
  'juridico crea cita de juridico'
);
select throws_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-05T10:00:00-07:00')$$,
  '42501', null, 'juridico no crea cita de psicologia'
);
select throws_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-06T10:00:00-07:00')$$,
  '42501', null, 'juridico no crea cita de trabajo_social'
);

-- 13-16. psicologia crea solo en su area; trabajo_social no crea; direccion crea en cualquiera
select pg_temp.as_user('11111111-1111-4111-8111-111111111104'); -- psicologia
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-07T10:00:00-07:00')$$,
  'psicologia crea cita de psicologia'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111103'); -- trabajo_social
select throws_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'trabajo_social'), '2099-09-08T10:00:00-07:00')$$,
  '42501', null, 'trabajo_social no crea cita (ni en su propia area)'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'juridico'), '2099-09-09T10:00:00-07:00')$$,
  'titular crea cita de juridico'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111102'); -- subdireccion
select lives_ok(
  $$select * from public.crear_cita('96000000-0000-4000-a000-000000000101', (select id from public.cat_area where clave = 'psicologia'), '2099-09-10T10:00:00-07:00')$$,
  'subdireccion crea cita de psicologia'
);

-- 17-19. recepcion ve y gestiona citas de Juridico
select pg_temp.as_user('11111111-1111-4111-8111-111111111106'); -- recepcion
select is(
  (select count(*)::int from public.cita where id in ('96000000-0000-4000-a000-000000000301','96000000-0000-4000-a000-000000000304','96000000-0000-4000-a000-000000000305')),
  3,
  'recepcion ve por SELECT citas de juridico, psicologia y trabajo_social'
);
select is(
  (select count(*)::int from public.get_agenda('2099-08-01T00:00:00-07:00', '2099-08-02T00:00:00-07:00') where area_clave = 'juridico'),
  4,
  'recepcion ve citas de juridico en get_agenda'
);
select lives_ok(
  $$select * from public.cambiar_estado_cita('96000000-0000-4000-a000-000000000301', 'confirmada')$$,
  'recepcion confirma cita de juridico con cambiar_estado_cita'
);

-- 20-21. recepcion reagenda juridico (y otra area) = crea cita nueva
select is(
  (select count(*)::int from public.reagendar_cita('96000000-0000-4000-a000-000000000302', '2099-10-01T10:00:00-07:00', 'Reagendada por recepcion')),
  1,
  'recepcion reagenda cita de juridico'
);
select is(
  (select count(*)::int from public.cita where reagendada_de = '96000000-0000-4000-a000-000000000302' and estado = 'agendada'),
  1,
  'el reagendado de juridico crea la cita nueva ligada'
);

-- 22. juridico reagenda su propia cita
select pg_temp.as_user('11111111-1111-4111-8111-111111111105'); -- juridico
select is(
  (select count(*)::int from public.reagendar_cita('96000000-0000-4000-a000-000000000303', '2099-10-02T10:00:00-07:00')),
  1,
  'juridico reagenda su propia cita'
);
-- 23. juridico no reagenda citas de otra area (no puede crear ahi)
select throws_ok(
  $$select * from public.reagendar_cita('96000000-0000-4000-a000-000000000304', '2099-10-03T10:00:00-07:00')$$,
  '42501', null, 'juridico no reagenda cita de psicologia'
);

-- 24-27. reagendar = crear: direccion en cualquier area; psicologia solo su area; TS no
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select is(
  (select count(*)::int from public.reagendar_cita('96000000-0000-4000-a000-000000000305', '2099-10-04T10:00:00-07:00')),
  1,
  'titular reagenda cita de trabajo_social (direccion crea en cualquier area)'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111102'); -- subdireccion
select is(
  (select count(*)::int from public.reagendar_cita('96000000-0000-4000-a000-000000000304', '2099-10-04T10:00:00-07:00')),
  1,
  'subdireccion reagenda cita de psicologia'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111104'); -- psicologia
select throws_ok(
  $$select * from public.reagendar_cita('96000000-0000-4000-a000-000000000306', '2099-10-04T10:00:00-07:00')$$,
  '42501', null, 'psicologia no puede reagendar citas de otra area (juridico)'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111103'); -- trabajo_social
select throws_ok(
  $$select * from public.reagendar_cita('96000000-0000-4000-a000-000000000306', '2099-10-04T10:00:00-07:00')$$,
  '42501', null, 'trabajo_social no puede reagendar (reagendar = crear)'
);

-- 28. Dirección y areas conservan cancelar/confirmar (no es crear)
select pg_temp.as_user('11111111-1111-4111-8111-111111111101'); -- titular
select lives_ok(
  $$select * from public.cambiar_estado_cita('96000000-0000-4000-a000-000000000306', 'cancelada', 'Solicitud de la usuaria')$$,
  'titular conserva cambiar_estado_cita (cancelar)'
);

-- 29-30. registrar_seguimiento: proxima cita solo con agenda.crear
select pg_temp.as_user('11111111-1111-4111-8111-111111111105'); -- juridico
select is(
  (select count(*)::int
   from public.registrar_seguimiento(
     '96000000-0000-4000-a000-000000000201'::uuid,
     '96000000-0000-4000-a000-000000000307'::uuid,
     (select t.id from public.cat_tipo_atencion t join public.cat_area a on a.id = t.area_id where a.clave = 'juridico' limit 1),
     'Asesoria juridica inicial.',
     null,
     'media',
     null,
     now() + interval '10 days'
   ) where cita_proxima_id is not null),
  1,
  'juridico agenda la proxima cita desde registrar_seguimiento'
);
select pg_temp.as_user('11111111-1111-4111-8111-111111111103'); -- trabajo_social
select throws_ok(
  $$select * from public.registrar_seguimiento(
      '96000000-0000-4000-a000-000000000201'::uuid,
      '96000000-0000-4000-a000-000000000308'::uuid,
      (select t.id from public.cat_tipo_atencion t join public.cat_area a on a.id = t.area_id where a.clave = 'trabajo_social' limit 1),
      'Valoracion.', null, 'media', null, now() + interval '10 days'
    )$$,
  '42501',
  'Sin permiso para agendar la próxima cita; solicítela a Recepción',
  'trabajo_social no agenda proxima cita desde registrar_seguimiento'
);

-- 31-32. UMECA: get_umeca_citas sigue funcionando y no lee cita directo
select pg_temp.as_user('11111111-1111-4111-8111-111111111107'); -- umeca
select ok(
  exists (select 1 from public.get_umeca_citas() where cita_id = '96000000-0000-4000-a000-000000000306'),
  'umeca sigue viendo sus citas con get_umeca_citas()'
);
select is(
  (select count(*)::int from public.cita),
  0,
  'umeca no lee cita directo'
);

select * from finish();
rollback;
