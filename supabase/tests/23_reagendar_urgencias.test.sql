-- =====================================================================
-- 23_reagendar_urgencias.test.sql (pgTAP)
-- Pruebas de integración para migración 23_rpc_reagendar_y_urgencias.sql:
--   - Seguridad: anon, juridico en get_lista_urgencias, recepcion en cita de juridico (42501)
--   - Reagendamiento atómico: estado 'reagendada', nueva cita con reagendada_de,
--     copia prioridad/recomendada_por, error 23505 al reagendar dos veces,
--     fecha en pasado y cita cancelada (23514)
--   - Lista de urgencias: Recepción ve prioridades 'alta' sin cita futura,
--     excluye quienes tienen cita futura o prioridad media, filtro p_area_id
-- =====================================================================

begin;

select plan(12);

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
  v_area_ts   smallint;
  v_area_psic smallint;
  v_area_jur  smallint;
  v_tipo_ts   smallint;
  v_tipo_psic smallint;
  v_uid_ts    uuid := '92000000-0000-4000-a000-000000000001';
  v_uid_psic  uuid := '92000000-0000-4000-a000-000000000002';
  v_uid_jur   uuid := '92000000-0000-4000-a000-000000000003';
  v_uid_rec   uuid := '92000000-0000-4000-a000-000000000004';
  v_per_1     uuid := '92000000-0000-4000-a000-000000000101'; -- urgente sin cita
  v_per_2     uuid := '92000000-0000-4000-a000-000000000102'; -- alta pero con cita futura
  v_per_3     uuid := '92000000-0000-4000-a000-000000000103'; -- era alta, bajó a media
  v_fic_1     uuid := '92000000-0000-4000-a000-000000000201';
  v_fic_2     uuid := '92000000-0000-4000-a000-000000000202';
  v_fic_3     uuid := '92000000-0000-4000-a000-000000000203';
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';
  select id into v_tipo_ts   from public.cat_tipo_atencion where area_id = v_area_ts limit 1;
  select id into v_tipo_psic from public.cat_tipo_atencion where area_id = v_area_psic limit 1;

  insert into auth.users (id, email) values
    (v_uid_ts,   'reag.ts@semujeres.local'),
    (v_uid_psic, 'reag.psic@semujeres.local'),
    (v_uid_jur,  'reag.jur@semujeres.local'),
    (v_uid_rec,  'reag.rec@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,   'TS Reag',         'trabajo_social', v_area_ts,   true),
    (v_uid_psic, 'Psicologia Reag', 'psicologia',     v_area_psic, true),
    (v_uid_jur,  'Juridico Reag',   'juridico',       v_area_jur,  true),
    (v_uid_rec,  'Recepcion Reag',  'recepcion',      null,        true)
  on conflict (id) do nothing;
  update auth.users u set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true) where exists (select 1 from public.empleado e where e.id = u.id) and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  -- Desactivar urgencias previas en atencion/ficha de pruebas anteriores? Solo marcamos nuevas fichas:
  insert into public.persona (id, curp, nombres, apellido_paterno, celular, creado_por) values
    (v_per_1, 'REAG900101MSLRRR01', 'Carmen', 'Urgente',    '6681111111', v_uid_ts),
    (v_per_2, 'REAG910101MSLRRR02', 'Lucia',  'ConCita',    '6682222222', v_uid_ts),
    (v_per_3, 'REAG920101MSLRRR03', 'Marta',  'PriorMedia', '6683333333', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_1, 'SEM-URG-0001', v_per_1, 'en_seguimiento', now(), v_uid_ts),
    (v_fic_2, 'SEM-URG-0002', v_per_2, 'en_seguimiento', now(), v_uid_ts),
    (v_fic_3, 'SEM-URG-0003', v_per_3, 'en_seguimiento', now(), v_uid_ts);

  -- Citas de prueba
  insert into public.cita (id, persona_id, area_id, programada_en, estado, recomendada_por, creado_por) values
    ('92000000-0000-4000-a000-000000000301', v_per_2, v_area_psic, '2099-07-01T10:00:00-07:00', 'agendada',  'TS', v_uid_rec),
    ('92000000-0000-4000-a000-000000000302', v_per_2, v_area_jur,  '2099-07-02T11:00:00-07:00', 'agendada',  null, v_uid_jur),
    ('92000000-0000-4000-a000-000000000303', v_per_3, v_area_ts,   '2099-07-03T12:00:00-07:00', 'cancelada', null, v_uid_rec);

  -- Atenciones para probar get_lista_urgencias
  insert into public.atencion (ficha_id, area_id, tipo_atencion_id, atendida_en, prioridad, creado_por) values
    (v_fic_1, v_area_ts,   v_tipo_ts,   now() - interval '3 days', 'alta',  v_uid_ts),
    (v_fic_2, v_area_psic, v_tipo_psic, now() - interval '2 days', 'alta',  v_uid_psic),
    (v_fic_3, v_area_ts,   v_tipo_ts,   now() - interval '5 days', 'alta',  v_uid_ts),
    (v_fic_3, v_area_ts,   v_tipo_ts,   now() - interval '1 day',  'media', v_uid_ts);
end $$;

-- 1-2. Seguridad: anon rechazado en ambos RPCs (42501)
set local role anon;
select throws_ok(
  $$select * from public.reagendar_cita('92000000-0000-4000-a000-000000000301', '2099-07-10T10:00:00-07:00')$$,
  '42501',
  null,
  'anon no puede reagendar_cita'
);
select throws_ok(
  $$select * from public.get_lista_urgencias()$$,
  '42501',
  null,
  'anon no puede consultar get_lista_urgencias'
);

-- 3. Seguridad: juridico rechazado en get_lista_urgencias (42501)
select pg_temp.as_user('92000000-0000-4000-a000-000000000003');
select throws_ok(
  $$select * from public.get_lista_urgencias()$$,
  '42501',
  null,
  'juridico no puede consultar get_lista_urgencias'
);

-- 4. Seguridad: recepcion no puede reagendar cita de Juridico (42501)
select pg_temp.as_user('92000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.reagendar_cita('92000000-0000-4000-a000-000000000302', '2099-07-10T10:00:00-07:00')$$,
  '42501',
  null,
  'recepcion no puede reagendar cita de Juridico (42501)'
);

-- 5-7. Camino no feliz reagendar_cita (23514)
select throws_ok(
  $$select * from public.reagendar_cita('92000000-0000-4000-a000-000000000301', now() - interval '1 hour')$$,
  '23514',
  null,
  'reagendar_cita rechaza fecha en el pasado con 23514'
);
select throws_ok(
  $$select * from public.reagendar_cita('92000000-0000-4000-a000-000000000999', '2099-07-10T10:00:00-07:00')$$,
  '23514',
  null,
  'reagendar_cita rechaza id inexistente con 23514'
);
select throws_ok(
  $$select * from public.reagendar_cita('92000000-0000-4000-a000-000000000303', '2099-07-10T10:00:00-07:00')$$,
  '23514',
  null,
  'reagendar_cita rechaza cita en estado cancelada con 23514'
);

-- 8. Camino feliz: reagendar_cita marca la vieja como reagendada y crea la nueva ligada
select * from public.reagendar_cita('92000000-0000-4000-a000-000000000301', '2099-07-10T10:00:00-07:00', '  Cambio de horario  ');
select ok(
  (select old_c.estado = 'reagendada'
      and old_c.motivo_cancelacion = 'Cambio de horario'
      and new_c.estado = 'agendada'
      and new_c.reagendada_de = '92000000-0000-4000-a000-000000000301'
      and new_c.recomendada_por = 'TS'
   from public.cita old_c
   join public.cita new_c on new_c.reagendada_de = old_c.id
   where old_c.id = '92000000-0000-4000-a000-000000000301'),
  'reagendar_cita actualiza cita anterior a reagendada y liga la nueva cita con reagendada_de'
);

-- 9. Duplicado: reagendar dos veces la misma cita da 23505
select throws_ok(
  $$select * from public.reagendar_cita('92000000-0000-4000-a000-000000000301', '2099-07-12T10:00:00-07:00')$$,
  '23505',
  null,
  'reagendar la misma cita dos veces da 23505'
);

-- 10-12. get_lista_urgencias para Recepción
select is(
  (select count(*)::int from public.get_lista_urgencias() where folio like 'SEM-URG-%'),
  1,
  'get_lista_urgencias incluye solo a quien tiene ultima prioridad alta sin cita futura'
);
select is(
  (select area_ultima_prioridad from public.get_lista_urgencias() where folio = 'SEM-URG-0001'),
  'trabajo_social',
  'get_lista_urgencias devuelve folio y area_ultima_prioridad sin CURP'
);
select is(
  (select count(*)::int from public.get_lista_urgencias((select id from public.cat_area where clave = 'psicologia')) where folio like 'SEM-URG-%'),
  0,
  'get_lista_urgencias filtra por p_area_id excluyendo areas sin urgencia pendiente'
);

select * from finish();

rollback;
