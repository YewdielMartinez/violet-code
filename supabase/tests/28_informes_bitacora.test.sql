-- =====================================================================
-- 28_informes_bitacora.test.sql (pgTAP · B-07 · RF-13, RF-22, RNF-02)
-- Pruebas de integración para migración 28_rpc_informes_y_bitacora.sql:
--   - RBAC: anon, inactivo, recepcion y UMECA rechazados (42501)
--   - RBAC: solo Dirección lee get_bitacora (TS y Psicología rechazados)
--   - ABAC get_informe: TS solo ve Trabajo Social y nunca Psicología
--   - Informe mensual, anual (p_mes null), sin datos (0 filas) y sin CURP/nombres
--   - get_bitacora: actor_nombre (empleado y UMECA), filtros y validaciones 23514
-- =====================================================================

begin;

select plan(23);

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
  v_tipo_ts    smallint;
  v_tipo_psic  smallint;
  v_uid_dir    uuid := '98000000-0000-4000-a000-000000000001';
  v_uid_ts     uuid := '98000000-0000-4000-a000-000000000002';
  v_uid_psic   uuid := '98000000-0000-4000-a000-000000000003';
  v_uid_rec    uuid := '98000000-0000-4000-a000-000000000004';
  v_uid_inact  uuid := '98000000-0000-4000-a000-000000000005';
  v_uid_umeca  uuid := '98000000-0000-4000-a000-000000000006';
  v_per_1      uuid := '98000000-0000-4000-a000-000000000101';
  v_per_2      uuid := '98000000-0000-4000-a000-000000000102';
  v_fic_1      uuid := '98000000-0000-4000-a000-000000000201';
  v_fic_2      uuid := '98000000-0000-4000-a000-000000000202';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';

  select cta.id into v_tipo_ts
  from public.cat_tipo_atencion cta
  where cta.area_id = v_area_ts
  order by cta.id
  limit 1;

  select cta.id into v_tipo_psic
  from public.cat_tipo_atencion cta
  where cta.area_id = v_area_psic
  order by cta.id
  limit 1;

  insert into auth.users (id, email) values
    (v_uid_dir,   'test28.dir@semujeres.local'),
    (v_uid_ts,    'test28.ts@semujeres.local'),
    (v_uid_psic,  'test28.psic@semujeres.local'),
    (v_uid_rec,   'test28.rec@semujeres.local'),
    (v_uid_inact, 'test28.inact@semujeres.local'),
    (v_uid_umeca, 'test28.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_dir,   'Titular Bitacora Test',    'titular',        null,        true),
    (v_uid_ts,    'TS Bitacora Test',         'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psicologia Bitacora Test', 'psicologia',     v_area_psic, true),
    (v_uid_rec,   'Recepcion Bitacora Test',  'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Bitacora Test',   'titular',        null,        false)
  on conflict (id) do nothing;

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umeca, 'UMECA Bitacora Test', 'umeca', true)
  on conflict (id) do nothing;

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_1, 'TETE930410MSLRRR01', 'Lucia',  'Perez', v_uid_ts),
    (v_per_2, 'TATO910615HSLRRR02', 'Carlos', 'Gomez', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_1, 'SEM-TEST28-01', v_per_1, now(), v_uid_ts),
    (v_fic_2, 'SEM-TEST28-02', v_per_2, now(), v_uid_ts);

  -- Atenciones en julio 2025 (una en TS y otra en Psicología)
  insert into public.atencion (ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en, creado_por) values
    (v_fic_1, v_area_ts,   v_tipo_ts,   v_uid_ts,   '2025-07-10T18:00:00Z'::timestamptz, v_uid_ts),
    (v_fic_2, v_area_psic, v_tipo_psic, v_uid_psic, '2025-07-12T18:00:00Z'::timestamptz, v_uid_psic);
end $$;

-- 1-2. anon rechazado en ambos RPCs
set local role anon;
select throws_ok(
  $$select * from public.get_informe(2025, 7, null)$$,
  '42501',
  null,
  'anon no puede consultar get_informe'
);
select throws_ok(
  $$select * from public.get_bitacora()$$,
  '42501',
  null,
  'anon no puede consultar get_bitacora'
);

-- 3-4. empleado inactivo rechazado en ambos RPCs
select pg_temp.as_user('98000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_informe(2025, 7, null)$$,
  '42501',
  null,
  'empleado inactivo no puede consultar get_informe'
);
select throws_ok(
  $$select * from public.get_bitacora()$$,
  '42501',
  null,
  'empleado inactivo no puede consultar get_bitacora'
);

-- 5-6. recepcion rechazado en ambos RPCs
select pg_temp.as_user('98000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.get_informe(2025, 7, null)$$,
  '42501',
  null,
  'recepcion no puede consultar get_informe'
);
select throws_ok(
  $$select * from public.get_bitacora()$$,
  '42501',
  null,
  'recepcion no puede consultar get_bitacora'
);

-- 7-8. UMECA rechazado en ambos RPCs
select pg_temp.as_user('98000000-0000-4000-a000-000000000006');
select throws_ok(
  $$select * from public.get_informe(2025, 7, null)$$,
  '42501',
  null,
  'UMECA no puede consultar get_informe'
);
select throws_ok(
  $$select * from public.get_bitacora()$$,
  '42501',
  null,
  'UMECA no puede consultar get_bitacora'
);

-- 9-12. TS y Psicología rechazados en get_bitacora; TS solo ve su área en get_informe
select pg_temp.as_user('98000000-0000-4000-a000-000000000002');
select throws_ok(
  $$select * from public.get_bitacora()$$,
  '42501',
  null,
  'trabajo_social no puede consultar get_bitacora'
);

select pg_temp.as_user('98000000-0000-4000-a000-000000000003');
select throws_ok(
  $$select * from public.get_bitacora()$$,
  '42501',
  null,
  'psicologia no puede consultar get_bitacora'
);

select pg_temp.as_user('98000000-0000-4000-a000-000000000002');
select ok(
  exists (select 1 from public.get_informe(2025, 7, null) gi where gi.area = 'Trabajo Social')
  and not exists (select 1 from public.get_informe(2025, 7, null) gi where gi.area <> 'Trabajo Social'),
  'trabajo_social solo ve filas de Trabajo Social en get_informe'
);

select is(
  (
    select count(*)::integer
    from public.get_informe(
      2025,
      7,
      (select ca.id from public.cat_area ca where ca.clave = 'psicologia')
    )
  ),
  0,
  'trabajo_social recibe 0 filas si filtra por el área de Psicología'
);

-- Registrar lecturas en bitácora por TS y UMECA antes de probar Dirección
select public.registrar_consulta('agresor', '98000000-0000-4000-a000-000000000901');
select pg_temp.as_user('98000000-0000-4000-a000-000000000006');
select public.registrar_consulta('cita', '98000000-0000-4000-a000-000000000902');

-- 13-18. Dirección (titular) en get_informe
select pg_temp.as_user('98000000-0000-4000-a000-000000000001');
select ok(
  exists (select 1 from public.get_informe(2025, 7, null) gi where gi.area = 'Trabajo Social' and gi.mujeres = 1)
  and exists (select 1 from public.get_informe(2025, 7, null) gi where gi.area = 'Psicología' and gi.hombres = 1),
  'Dirección ve todas las áreas y conteos por sexo en get_informe mensual'
);

select ok(
  exists (select 1 from public.get_informe(2025, null, null) gi where gi.mes is null and gi.area = 'Trabajo Social'),
  'get_informe con p_mes = null devuelve informe anual con mes nulo'
);

select is(
  (select count(*)::integer from public.get_informe(2020, 1, null)),
  0,
  'get_informe sin datos devuelve 0 filas y no error'
);

select throws_ok(
  $$select * from public.get_informe(null, null, null)$$,
  '23514',
  null,
  'p_anio nulo lanza 23514'
);

select throws_ok(
  $$select * from public.get_informe(2025, 13, null)$$,
  '23514',
  null,
  'p_mes fuera de rango (13) lanza 23514'
);

select ok(
  not exists (
    select 1
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.specific_name like 'get_informe%'
      and p.parameter_mode = 'OUT'
      and p.parameter_name in ('curp', 'nombres', 'apellido_paterno')
  ),
  'get_informe no expone CURP ni nombres en su salida'
);

-- 19-23. Dirección (titular) en get_bitacora y validaciones 23514
select ok(
  exists (
    select 1
    from public.get_bitacora(null, null, 'agresor', '98000000-0000-4000-a000-000000000002', 50) gb
    where gb.actor_tipo = 'empleado'
      and gb.actor_nombre = 'TS Bitacora Test'
      and gb.actor_rol = 'trabajo_social'
      and gb.registro_id = '98000000-0000-4000-a000-000000000901'
  ),
  'get_bitacora devuelve eventos de empleado con actor_nombre y actor_rol'
);

select ok(
  exists (
    select 1
    from public.get_bitacora(null, null, 'cita', null, 50) gb
    where gb.actor_tipo = 'usuario_externo'
      and gb.actor_nombre = 'UMECA Bitacora Test'
      and gb.actor_rol = 'umeca'
      and gb.registro_id = '98000000-0000-4000-a000-000000000902'
  ),
  'get_bitacora devuelve eventos de UMECA con nombre y dependencia'
);

select ok(
  (select count(*) <= 2 from public.get_bitacora(null, null, null, null, 2)),
  'get_bitacora respeta el parámetro p_limite'
);

select throws_ok(
  $$
    select * from public.get_bitacora(
      '2026-12-10T00:00:00Z'::timestamptz,
      '2026-11-01T00:00:00Z'::timestamptz,
      null,
      null,
      50
    )
  $$,
  '23514',
  null,
  'get_bitacora con p_desde > p_hasta lanza 23514'
);

select throws_ok(
  $$select * from public.get_bitacora(null, null, null, null, 0)$$,
  '23514',
  null,
  'get_bitacora con p_limite = 0 lanza 23514'
);

select * from finish();

rollback;
