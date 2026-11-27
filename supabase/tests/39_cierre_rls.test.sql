-- =====================================================================
-- 39_cierre_rls.test.sql (A-07 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000800_39_cierre_rls_edicion.sql:
--   - INSERT/UPDATE directos en persona, ficha_registro,
--     ficha_servicio_solicitado, agresor, historial_clinico,
--     estudio_socioeconomico y aportante_hogar fallan con 42501 incluso
--     para los roles que antes podían escribir (y DELETE en puente = 0).
--   - SELECT en las 7 tablas permanece intacto.
--   - Las RPCs SECURITY DEFINER siguen funcionando correctamente.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(28);

do $$
declare
  v_uid_ts    uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_psic  uuid := '11111111-1111-4111-8111-111111111104';
  v_uid_jur   uuid := '11111111-1111-4111-8111-111111111105';
  v_per_1     uuid := '99000000-0000-4000-a000-000000000101';
  v_fic_1     uuid := '99000000-0000-4000-a000-000000000201';
  v_est_1     uuid := '99000000-0000-4000-a000-000000000301';
  v_apo_1     uuid := '99000000-0000-4000-a000-000000000401';
  v_agr_1     uuid := '99000000-0000-4000-a000-000000000501';
  v_hc_1      uuid := '99000000-0000-4000-a000-000000000601';
  v_area_ts   smallint;
begin
  select id into v_area_ts from public.cat_area where clave = 'trabajo_social';

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values (v_per_1, 'SANL920415MSLGRN01', 'Rebeca', 'Nunez', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
  values (v_fic_1, 'SEM-S2A7-0001', v_per_1, 'abierto', now(), v_uid_ts);

  insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
  values (v_fic_1, v_area_ts, v_uid_ts);

  insert into public.estudio_socioeconomico (id, ficha_id, fecha_estudio, es_actual, creado_por)
  values (v_est_1, v_fic_1, current_date - 1, true, v_uid_ts);

  insert into public.aportante_hogar (id, estudio_socioeconomico_id, nombre, creado_por)
  values (v_apo_1, v_est_1, 'Aportante Fixture', v_uid_ts);

  insert into public.agresor (id, ficha_id, nombres, creado_por)
  values (v_agr_1, v_fic_1, 'Agresor Fixture', v_uid_jur);

  insert into public.historial_clinico (id, ficha_id, motivo_consulta, creado_por)
  values (v_hc_1, v_fic_1, 'Motivo Fixture', v_uid_psic);
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
grant execute on function pg_temp.set_actor(uuid) to public;

set local role authenticated;

-- 1-11) Trabajo Social bloqueado en INSERT/UPDATE/DELETE directos de las 5 tablas
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select throws_ok(
  $$insert into public.persona (curp, nombres, apellido_paterno) values ('SANC900101MSLRRN02', 'Nueva', 'Directo')$$,
  '42501', null, 'TS no inserta directo en persona'
);
select throws_ok(
  $$update public.persona set celular = '6681112233' where id = '99000000-0000-4000-a000-000000000101'$$,
  '42501', null, 'TS no actualiza directo en persona'
);

select throws_ok(
  $$insert into public.ficha_registro (persona_id, aviso_privacidad_aceptado_en) values ('99000000-0000-4000-a000-000000000101', now())$$,
  '42501', null, 'TS no inserta directo en ficha_registro'
);
select throws_ok(
  $$update public.ficha_registro set tiene_trabajo = true where id = '99000000-0000-4000-a000-000000000201'$$,
  '42501', null, 'TS no actualiza directo en ficha_registro'
);

select throws_ok(
  $$insert into public.ficha_servicio_solicitado (ficha_id, area_id) values ('99000000-0000-4000-a000-000000000201', (select id from public.cat_area where clave = 'psicologia'))$$,
  '42501', null, 'TS no inserta directo en ficha_servicio_solicitado'
);
select throws_ok(
  $$update public.ficha_servicio_solicitado set creado_por = null where ficha_id = '99000000-0000-4000-a000-000000000201'$$,
  '42501', null, 'TS no actualiza directo en ficha_servicio_solicitado'
);
with del as (
  delete from public.ficha_servicio_solicitado
  where ficha_id = '99000000-0000-4000-a000-000000000201'
  returning 1
)
select is((select count(*)::int from del), 0, 'TS no borra directo en ficha_servicio_solicitado');

select throws_ok(
  $$insert into public.estudio_socioeconomico (ficha_id, es_actual) values ('99000000-0000-4000-a000-000000000201', false)$$,
  '42501', null, 'TS no inserta directo en estudio_socioeconomico'
);
select throws_ok(
  $$update public.estudio_socioeconomico set ingreso_mensual_propio = 1000 where id = '99000000-0000-4000-a000-000000000301'$$,
  '42501', null, 'TS no actualiza directo en estudio_socioeconomico'
);

select throws_ok(
  $$insert into public.aportante_hogar (estudio_socioeconomico_id, nombre) values ('99000000-0000-4000-a000-000000000301', 'Directo')$$,
  '42501', null, 'TS no inserta directo en aportante_hogar'
);
select throws_ok(
  $$update public.aportante_hogar set nombre = 'Modificado' where id = '99000000-0000-4000-a000-000000000401'$$,
  '42501', null, 'TS no actualiza directo en aportante_hogar'
);

-- 12-13) Jurídico bloqueado en INSERT/UPDATE directos de agresor
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$insert into public.agresor (ficha_id, nombres) values ('99000000-0000-4000-a000-000000000201', 'Directo')$$,
  '42501', null, 'juridico no inserta directo en agresor'
);
select throws_ok(
  $$update public.agresor set observaciones = 'Directo' where id = '99000000-0000-4000-a000-000000000501'$$,
  '42501', null, 'juridico no actualiza directo en agresor'
);

-- 14-15) Psicología bloqueado en INSERT/UPDATE directos de historial_clinico
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$insert into public.historial_clinico (ficha_id, motivo_consulta) values ('99000000-0000-4000-a000-000000000201', 'Directo')$$,
  '42501', null, 'psicologia no inserta directo en historial_clinico'
);
select throws_ok(
  $$update public.historial_clinico set motivo_consulta = 'Directo' where id = '99000000-0000-4000-a000-000000000601'$$,
  '42501', null, 'psicologia no actualiza directo en historial_clinico'
);

-- 16-22) SELECT sigue abierto en las 7 tablas
select ok((select count(*) >= 1 from public.historial_clinico where id = '99000000-0000-4000-a000-000000000601'), 'psicologia sigue leyendo historial_clinico');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select ok((select count(*) >= 1 from public.persona where id = '99000000-0000-4000-a000-000000000101'), 'TS sigue leyendo persona');
select ok((select count(*) >= 1 from public.ficha_registro where id = '99000000-0000-4000-a000-000000000201'), 'TS sigue leyendo ficha_registro');
select ok((select count(*) >= 1 from public.ficha_servicio_solicitado where ficha_id = '99000000-0000-4000-a000-000000000201'), 'TS sigue leyendo ficha_servicio_solicitado');
select ok((select count(*) >= 1 from public.estudio_socioeconomico where id = '99000000-0000-4000-a000-000000000301'), 'TS sigue leyendo estudio_socioeconomico');
select ok((select count(*) >= 1 from public.aportante_hogar where id = '99000000-0000-4000-a000-000000000401'), 'TS sigue leyendo aportante_hogar');
select ok((select count(*) >= 1 from public.agresor where id = '99000000-0000-4000-a000-000000000501'), 'TS sigue leyendo agresor');

-- 23-28) Todas las RPCs del expediente siguen funcionando con RLS cerrado
select is(
  (
    select nombres
    from public.actualizar_persona(
      '99000000-0000-4000-a000-000000000101',
      (select actualizado_en from public.persona where id = '99000000-0000-4000-a000-000000000101'),
      'Rebeca Editada'
    )
  ),
  'Rebeca Editada',
  'RPC actualizar_persona sigue funcionando con RLS cerrado'
);

select is(
  (
    select estado_civil::text
    from public.actualizar_ficha(
      '99000000-0000-4000-a000-000000000201',
      (select actualizado_en from public.ficha_registro where id = '99000000-0000-4000-a000-000000000201'),
      'divorciado'::public.estado_civil
    )
  ),
  'divorciado',
  'RPC actualizar_ficha sigue funcionando con RLS cerrado'
);

select is(
  (select es_actual from public.registrar_estudio_socioeconomico('99000000-0000-4000-a000-000000000201', 6000)),
  true,
  'RPC registrar_estudio_socioeconomico sigue funcionando con RLS cerrado'
);

select lives_ok(
  $$select * from public.crear_ficha_completa(
    jsonb_build_object(
      'identidad', jsonb_build_object(
        'curp', 'SANC930510MSLRRN05',
        'nombres', 'Clara',
        'apellidoPaterno', 'Nunez',
        'avisoPrivacidadAceptado', true,
        'serviciosSolicitadosAreaIds', jsonb_build_array((select id from public.cat_area where clave = 'trabajo_social'))
      ),
      'domicilio', jsonb_build_object('zona', 'urbana'),
      'estudio', jsonb_build_object()
    )
  )$$,
  'RPC crear_ficha_completa sigue funcionando con RLS cerrado'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is(
  (
    select nombres
    from public.guardar_agresor(
      '99000000-0000-4000-a000-000000000501',
      null,
      (select actualizado_en from public.agresor where id = '99000000-0000-4000-a000-000000000501'),
      'Agresor RPC'
    )
  ),
  'Agresor RPC',
  'RPC guardar_agresor sigue funcionando con RLS cerrado'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (
    select motivo_consulta
    from public.guardar_historial_clinico(
      '99000000-0000-4000-a000-000000000201',
      (select actualizado_en from public.historial_clinico where id = '99000000-0000-4000-a000-000000000601'),
      null, null, 'Motivo RPC'
    )
  ),
  'Motivo RPC',
  'RPC guardar_historial_clinico sigue funcionando con RLS cerrado'
);

reset role;

select * from finish();
rollback;
