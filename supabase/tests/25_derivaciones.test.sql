-- =====================================================================
-- 25_derivaciones.test.sql (pgTAP)
-- Pruebas de integración para migración 25_rpc_derivaciones.sql:
--   - Camino feliz, camino no feliz y edge cases (pruebas.md)
--   - RN-01: menor de edad hacia Psicología/Jurídico -> 23514
--   - area_origen_id autocompletado con auth_area_id()
--   - Aislamiento por área en get_derivaciones y cambiar_estado_derivacion
--   - Transiciones de estado válidas e inválidas
--   - Seguridad: anon, recepcion y empleado inactivo rechazados con 42501
-- =====================================================================

begin;

select plan(16);

-- Helper para simular JWT autenticado en pgTAP
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

-- Crear datos de prueba aislados dentro de la transacción (rollback al final)
do $$
declare
  v_area_ts    smallint;
  v_area_psic  smallint;
  v_area_jur   smallint;
  v_uid_ts     uuid := '90000000-0000-4000-a000-000000000001';
  v_uid_psic   uuid := '90000000-0000-4000-a000-000000000002';
  v_uid_jur    uuid := '90000000-0000-4000-a000-000000000003';
  v_uid_rec    uuid := '90000000-0000-4000-a000-000000000004';
  v_uid_inact  uuid := '90000000-0000-4000-a000-000000000005';
  v_per_adult  uuid := '90000000-0000-4000-a000-000000000101';
  v_per_minor  uuid := '90000000-0000-4000-a000-000000000102';
  v_fic_adult  uuid := '90000000-0000-4000-a000-000000000201';
  v_fic_minor  uuid := '90000000-0000-4000-a000-000000000202';
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  insert into auth.users (id, email) values
    (v_uid_ts,    'test.ts@semujeres.local'),
    (v_uid_psic,  'test.psic@semujeres.local'),
    (v_uid_jur,   'test.jur@semujeres.local'),
    (v_uid_rec,   'test.rec@semujeres.local'),
    (v_uid_inact, 'test.inact@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,    'TS Prueba',         'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psicologia Prueba', 'psicologia',     v_area_psic, true),
    (v_uid_jur,   'Juridico Prueba',   'juridico',       v_area_jur,  true),
    (v_uid_rec,   'Recepcion Prueba',  'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Prueba',   'trabajo_social', v_area_ts,   false)
  on conflict (id) do nothing;
  update auth.users u set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true) where exists (select 1 from public.empleado e where e.id = u.id) and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  -- Adulta (nacida 1995-05-12) y menor (nacida 2015-05-12 -> pos 17 letra = siglo 2000, < 18 años)
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_adult, 'TEST950512MSLRRR01', 'Ana',   'Adulta', v_uid_ts),
    (v_per_minor, 'TEST150512MSLRRRA2', 'Sofia', 'Menor',  v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_adult, 'SEM-TEST-9001', v_per_adult, now(), v_uid_ts),
    (v_fic_minor, 'SEM-TEST-9002', v_per_minor, now(), v_uid_ts);
end $$;

-- 1-2. Seguridad: usuario anon sin permiso para ejecutar RPCs
set local role anon;
select throws_ok(
  $$select * from public.get_derivaciones()$$,
  '42501',
  null,
  'anon no puede ejecutar get_derivaciones'
);
select throws_ok(
  $$select * from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000999', 'en_proceso')$$,
  '42501',
  null,
  'anon no puede ejecutar cambiar_estado_derivacion'
);

-- 3. Seguridad: recepcion rechazado con 42501
select pg_temp.as_user('90000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.get_derivaciones()$$,
  '42501',
  null,
  'recepcion no puede consultar get_derivaciones'
);

-- 4. Edge case seguridad: empleado inactivo rechazado con 42501
select pg_temp.as_user('90000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_derivaciones()$$,
  '42501',
  null,
  'empleado inactivo no puede consultar get_derivaciones'
);

-- 5. Trigger RN-01 vía crear_canalizacion(): menor de edad derivada a Psicología -> 23514
select pg_temp.as_user('90000000-0000-4000-a000-000000000001');
select throws_ok(
  $$
    select * from public.crear_canalizacion(
      '90000000-0000-4000-a000-000000000202',
      'psicologia',
      (select id from public.cat_area where clave = 'psicologia'),
      null,
      null,
      'Intento menor en psicologia'
    )
  $$,
  '23514',
  null,
  'RN-01 rechaza derivar menor de 18 años a Psicología con 23514'
);

-- 6. Trigger RN-01 vía crear_canalizacion(): menor de edad derivada a Jurídico -> 23514
select throws_ok(
  $$
    select * from public.crear_canalizacion(
      '90000000-0000-4000-a000-000000000202',
      'juridico',
      (select id from public.cat_area where clave = 'juridico'),
      null,
      null,
      'Intento menor en juridico'
    )
  $$,
  '23514',
  null,
  'RN-01 rechaza derivar menor de 18 años a Jurídico con 23514'
);

-- 7. Camino feliz + area_origen_id autocompletado en INSERT cuando viene NULL
--    (derivacion_insert se cerró en Sprint 02 A-01; se siembran los fixtures
--     conservando el claim JWT de TS para verificar validar_derivacion_area).
reset role;
insert into public.derivacion (id, ficha_id, destino, area_destino_id, motivo)
values (
  '90000000-0000-4000-a000-000000000301',
  '90000000-0000-4000-a000-000000000201',
  'juridico',
  (select id from public.cat_area where clave = 'juridico'),
  'Derivacion TS a Juridico'
);

select is(
  (select area_origen_id from public.derivacion where id = '90000000-0000-4000-a000-000000000301'),
  (select id from public.cat_area where clave = 'trabajo_social'),
  'trigger llena area_origen_id automaticamente con auth_area_id()'
);

-- Crear segunda derivacion hacia Psicologia
insert into public.derivacion (id, ficha_id, destino, area_destino_id, motivo)
values (
  '90000000-0000-4000-a000-000000000302',
  '90000000-0000-4000-a000-000000000201',
  'psicologia',
  (select id from public.cat_area where clave = 'psicologia'),
  'Derivacion TS a Psicologia'
);
set local role authenticated;

-- 8. get_derivaciones: Trabajo Social ve ambas derivaciones de la ficha
select is(
  (select count(*)::int from public.get_derivaciones('90000000-0000-4000-a000-000000000201')),
  2,
  'trabajo_social ve todas las derivaciones de la ficha'
);

-- 9. Aislamiento por área: Psicología NO ve la derivación TS -> Jurídico
select pg_temp.as_user('90000000-0000-4000-a000-000000000002');
select is(
  (select count(*)::int from public.get_derivaciones('90000000-0000-4000-a000-000000000201')),
  1,
  'psicologia solo ve su propia derivacion y no la de juridico'
);

-- 10. Aislamiento en mutación: Psicología no puede cambiar estado de derivación de Jurídico (42501)
select throws_ok(
  $$select * from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000301', 'en_proceso')$$,
  '42501',
  null,
  'psicologia no puede modificar derivacion ajena (42501)'
);

-- 11. Edge case: p_limite fuera de rango -> 23514
select throws_ok(
  $$select * from public.get_derivaciones(null, null, 0)$$,
  '23514',
  null,
  'get_derivaciones rechaza p_limite = 0 con 23514'
);

-- 12. Edge case: p_derivacion_id inexistente -> 23514
select throws_ok(
  $$select * from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000999', 'en_proceso')$$,
  '23514',
  null,
  'cambiar_estado_derivacion rechaza id inexistente con 23514'
);

-- 13. Transición inválida: pendiente -> concluida directo -> 23514
select throws_ok(
  $$select * from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000302', 'concluida')$$,
  '23514',
  null,
  'transicion pendiente -> concluida directa rechazada con 23514'
);

-- 14. Camino feliz: pendiente -> en_proceso
select is(
  (select estado from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000302', 'en_proceso')),
  'en_proceso'::public.estado_derivacion,
  'psicologia avanza su derivacion de pendiente a en_proceso'
);

-- 15. Camino feliz: en_proceso -> concluida (nota obligatoria desde A-02 S2)
select is(
  (select estado from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000302', 'concluida', 'Valoración psicológica concluida')),
  'concluida'::public.estado_derivacion,
  'psicologia concluye su derivacion de en_proceso a concluida'
);

-- 16. Transición inválida desde estado terminal: concluida -> en_proceso -> 23514
select throws_ok(
  $$select * from public.cambiar_estado_derivacion('90000000-0000-4000-a000-000000000302', 'en_proceso')$$,
  '23514',
  null,
  'transicion desde estado terminal concluida rechazada con 23514'
);

select * from finish();

rollback;
