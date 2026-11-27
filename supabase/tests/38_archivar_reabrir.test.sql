-- =====================================================================
-- 38_archivar_reabrir.test.sql (A-06 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000700_38_archivar_y_reabrir.sql:
--   - archivar_ficha exige p_motivo no vacío (23514) y persiste
--     motivo_archivo, archivada_en y archivada_por.
--   - reabrir_ficha rechaza con 42501 a trabajo_social, psicologia,
--     juridico, recepcion, umeca y sin sesión.
--   - reabrir_ficha rechaza motivo vacío y expedientes no archivados (23514).
--   - reabrir_ficha pasa a 'abierto' sin atenciones o a 'en_seguimiento'
--     con atenciones activas, guardando motivo_reapertura, reabierta_en y
--     reabierta_por.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(16);

do $$
declare
  v_uid_ts     uuid := '11111111-1111-4111-8111-111111111103';
  v_per_1      uuid := '98000000-0000-4000-a000-000000000101';
  v_per_2      uuid := '98000000-0000-4000-a000-000000000102';
  v_per_3      uuid := '98000000-0000-4000-a000-000000000103';
  v_fic_sin    uuid := '98000000-0000-4000-a000-000000000201';
  v_fic_con    uuid := '98000000-0000-4000-a000-000000000202';
  v_fic_abiert uuid := '98000000-0000-4000-a000-000000000203';
  v_area_ts    smallint;
  v_ta_ts      smallint;
begin
  select id into v_area_ts from public.cat_area where clave = 'trabajo_social';
  select id into v_ta_ts   from public.cat_tipo_atencion where clave = 'entrevista_inicial';

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_1, 'SAOA920415MSLGRN01', 'Patricia', 'Mora',  v_uid_ts),
    (v_per_2, 'SAOB880620MSLRRN02', 'Carmen',   'Ibarra', v_uid_ts),
    (v_per_3, 'SAOC900101MSLRRN03', 'Nora',     'Navarro', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en,
    motivo_archivo, archivada_en, archivada_por, creado_por
  ) values
    (v_fic_sin,    'SEM-S2A6-0001', v_per_1, 'abierto',   now(), null, null, null, v_uid_ts),
    (v_fic_con,    'SEM-S2A6-0002', v_per_2, 'archivado', now(), 'Conclusion previa', now() - interval '5 days', v_uid_ts, v_uid_ts),
    (v_fic_abiert, 'SEM-S2A6-0003', v_per_3, 'abierto',   now(), null, null, null, v_uid_ts);

  insert into public.atencion (ficha_id, area_id, tipo_atencion_id, atendida_por, acciones_realizadas, creado_por)
  values (v_fic_con, v_area_ts, v_ta_ts, v_uid_ts, 'Entrevista inicial', v_uid_ts);
end;
$$;

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
  end if;
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

set local role authenticated;

-- 1-4) archivar_ficha exige p_motivo y guarda motivo_archivo, archivada_en, archivada_por
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select throws_ok(
  $$select * from public.archivar_ficha('98000000-0000-4000-a000-000000000201', null)$$,
  '23514', null, 'archivar_ficha con p_motivo null lanza 23514'
);

select throws_ok(
  $$select * from public.archivar_ficha('98000000-0000-4000-a000-000000000201', '   ')$$,
  '23514', null, 'archivar_ficha con p_motivo vacio lanza 23514'
);

select is(
  (select estado::text from public.archivar_ficha('98000000-0000-4000-a000-000000000201', 'Usuaria concluyo proceso')),
  'archivado',
  'archivar_ficha con motivo valido archiva el expediente'
);

select is(
  (
    select (
      f.motivo_archivo = 'Usuaria concluyo proceso'
      and f.archivada_en is not null
      and f.archivada_por = '11111111-1111-4111-8111-111111111103'::uuid
    )
    from public.ficha_registro f
    where f.id = '98000000-0000-4000-a000-000000000201'
  ),
  true,
  'archivar_ficha guarda motivo_archivo, archivada_en y archivada_por'
);

-- 5-10) reabrir_ficha rechaza con 42501 fuera de Dirección
select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Intento TS')$$,
  '42501', null, 'trabajo_social recibe 42501 al reabrir expediente'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Intento Psic')$$,
  '42501', null, 'psicologia recibe 42501 al reabrir expediente'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Intento Jur')$$,
  '42501', null, 'juridico recibe 42501 al reabrir expediente'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Intento Rec')$$,
  '42501', null, 'recepcion recibe 42501 al reabrir expediente'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Intento UMECA')$$,
  '42501', null, 'umeca recibe 42501 al reabrir expediente'
);

select pg_temp.set_actor(null); -- sin sesion
select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Sin sesion')$$,
  '42501', null, 'sin sesion recibe 42501 al reabrir expediente'
);

-- 11-16) reabrir_ficha como Titular y Subdirección
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular

select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', '  ')$$,
  '23514', null, 'reabrir_ficha con motivo vacio lanza 23514'
);

select throws_ok(
  $$select * from public.reabrir_ficha('98000000-0000-4000-a000-000000000203', 'No estaba archivado')$$,
  '23514', null, 'reabrir_ficha rechaza expediente no archivado con 23514'
);

select is(
  (select estado::text from public.reabrir_ficha('98000000-0000-4000-a000-000000000201', 'Usuaria solicito reingreso')),
  'abierto',
  'titular reabre expediente sin atenciones y pasa a abierto'
);

select is(
  (
    select (
      f.motivo_reapertura = 'Usuaria solicito reingreso'
      and f.reabierta_en is not null
      and f.reabierta_por = '11111111-1111-4111-8111-111111111101'::uuid
      and f.motivo_archivo = 'Usuaria concluyo proceso'
    )
    from public.ficha_registro f
    where f.id = '98000000-0000-4000-a000-000000000201'
  ),
  true,
  'reabrir_ficha guarda motivo_reapertura, reabierta_en y reabierta_por conservando motivo_archivo'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid); -- subdireccion
select is(
  (select estado::text from public.reabrir_ficha('98000000-0000-4000-a000-000000000202', 'Nueva situacion de riesgo')),
  'en_seguimiento',
  'subdireccion reabre expediente con atenciones y pasa a en_seguimiento'
);

select is(
  (
    select (
      f.motivo_reapertura = 'Nueva situacion de riesgo'
      and f.reabierta_en is not null
      and f.reabierta_por = '11111111-1111-4111-8111-111111111102'::uuid
    )
    from public.ficha_registro f
    where f.id = '98000000-0000-4000-a000-000000000202'
  ),
  true,
  'subdireccion registra datos completos de reapertura'
);

reset role;

select * from finish();
rollback;
