-- =====================================================================
-- 20_linea_tiempo.test.sql (pgTAP · A-05 · RF-25, RN-18 · SF-14)
-- Pruebas de integración para migración 20_rpc_linea_tiempo.sql:
--   - Seguridad RBAC: anon, inactivo, recepcion y UMECA rechazados (42501)
--   - Entrada inválida: p_ficha_id nulo o inexistente -> 23514
--   - Visibilidad por rol: Dirección ve todos los detalles; cada área solo
--     ve títulos/estados de todo y el detalle de lo propio
--   - Privacidad: nunca incluye nota_area
-- =====================================================================

begin;

select plan(13);

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
  v_area_jur   smallint;
  v_tipo_ts    smallint;
  v_tipo_psic  smallint;
  v_uid_dir    uuid := '92000000-0000-4000-a000-000000000001';
  v_uid_ts     uuid := '92000000-0000-4000-a000-000000000002';
  v_uid_psic   uuid := '92000000-0000-4000-a000-000000000003';
  v_uid_jur    uuid := '92000000-0000-4000-a000-000000000004';
  v_uid_rec    uuid := '92000000-0000-4000-a000-000000000005';
  v_uid_inact  uuid := '92000000-0000-4000-a000-000000000006';
  v_uid_umeca  uuid := '92000000-0000-4000-a000-000000000007';
  v_per_1      uuid := '92000000-0000-4000-a000-000000000101';
  v_fic_1      uuid := '92000000-0000-4000-a000-000000000201';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';
  select ca.id into v_area_jur  from public.cat_area ca where ca.clave = 'juridico';

  select cta.id into v_tipo_ts   from public.cat_tipo_atencion cta where cta.area_id = v_area_ts   order by cta.id limit 1;
  select cta.id into v_tipo_psic from public.cat_tipo_atencion cta where cta.area_id = v_area_psic order by cta.id limit 1;

  insert into auth.users (id, email) values
    (v_uid_dir,   'test20.dir@semujeres.local'),
    (v_uid_ts,    'test20.ts@semujeres.local'),
    (v_uid_psic,  'test20.psic@semujeres.local'),
    (v_uid_jur,   'test20.jur@semujeres.local'),
    (v_uid_rec,   'test20.rec@semujeres.local'),
    (v_uid_inact, 'test20.inact@semujeres.local'),
    (v_uid_umeca, 'test20.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_dir,   'Titular LT Test',    'titular',        null,        true),
    (v_uid_ts,    'TS LT Test',         'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psicologia LT Test', 'psicologia',     v_area_psic, true),
    (v_uid_jur,   'Juridico LT Test',   'juridico',       v_area_jur,  true),
    (v_uid_rec,   'Recepcion LT Test',  'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo LT Test',   'trabajo_social', v_area_ts,   false)
  on conflict (id) do nothing;

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umeca, 'UMECA LT Test', 'umeca', true)
  on conflict (id) do nothing;

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_1, 'TETE920510MSLRRR01', 'Valeria', 'Luna', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_1, 'SEM-TEST20-01', v_per_1, now(), v_uid_ts);

  -- 6 tipos de evento para la ficha
  insert into public.cita (persona_id, area_id, programada_en, estado, motivo_cancelacion, prioridad, origen, creado_por) values
    (v_per_1, v_area_ts, now() - interval '3 days', 'cancelada', 'SECRETO_CITA_TS', 'media', 'regular', v_uid_rec);

  insert into public.atencion (ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en, acciones_realizadas, creado_por) values
    (v_fic_1, v_area_ts,   v_tipo_ts,   v_uid_ts,   now() - interval '2 days', 'SECRETO_ATENCION_TS',   v_uid_ts),
    (v_fic_1, v_area_psic, v_tipo_psic, v_uid_psic, now() - interval '1 day',  'SECRETO_ATENCION_PSIC', v_uid_psic);

  insert into public.derivacion (ficha_id, area_origen_id, destino, area_destino_id, motivo, creado_por) values
    (v_fic_1, v_area_ts, 'juridico', v_area_jur, 'SECRETO_DERIVACION_TS_JUR', v_uid_ts);

  insert into public.orden_proteccion (ficha_id, numero_oficio, autoridad_emisora, fecha_emision, estado, creado_por) values
    (v_fic_1, 'OF-2026-88', 'Juzgado Familiar', current_date, 'vigente', v_uid_jur);

  insert into public.alerta (persona_id, origen, prioridad, estado, tomada_en, atendida_en, atendida_por, observaciones, creado_por) values
    (v_per_1, 'app_movil', 'alta', 'atendida', now() - interval '4 hours', now() - interval '3 hours', v_uid_dir, 'SECRETO_ALERTA_24_7', v_uid_dir);

  -- Nota privada de área que NUNCA debe salir en get_linea_tiempo
  insert into public.nota_area (ficha_id, area_id, contenido, creado_por) values
    (v_fic_1, v_area_ts, 'SECRETO_NOTA_PRIVADA_NO_TIMELINE', v_uid_ts);
end $$;

-- 1-4. Seguridad RBAC: anon, inactivo, recepcion y UMECA rechazados con 42501
set local role anon;
select throws_ok(
  $$select * from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201')$$,
  '42501',
  null,
  'anon no puede consultar get_linea_tiempo'
);

select pg_temp.as_user('92000000-0000-4000-a000-000000000006');
select throws_ok(
  $$select * from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201')$$,
  '42501',
  null,
  'empleado inactivo no puede consultar get_linea_tiempo'
);

select pg_temp.as_user('92000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201')$$,
  '42501',
  null,
  'recepcion no puede consultar get_linea_tiempo'
);

select pg_temp.as_user('92000000-0000-4000-a000-000000000007');
select throws_ok(
  $$select * from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201')$$,
  '42501',
  null,
  'UMECA no puede consultar get_linea_tiempo'
);

-- 5-6. Validación de parámetro p_ficha_id (23514)
select pg_temp.as_user('92000000-0000-4000-a000-000000000001');
select throws_ok(
  $$select * from public.get_linea_tiempo(null)$$,
  '23514',
  null,
  'p_ficha_id nulo lanza 23514'
);

select throws_ok(
  $$select * from public.get_linea_tiempo('92000000-0000-4000-a000-000000000999')$$,
  '23514',
  null,
  'p_ficha_id inexistente lanza 23514'
);

-- 7-9. Dirección ve los 6 tipos, todos los detalles y cero notas privadas
select is(
  (select count(distinct lt.tipo)::integer from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt),
  6,
  'Dirección recibe los 6 tipos de evento de la línea de tiempo'
);

select ok(
  exists (select 1 from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt where lt.detalle = 'SECRETO_ATENCION_TS')
  and exists (select 1 from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt where lt.detalle = 'SECRETO_ATENCION_PSIC')
  and exists (select 1 from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt where lt.detalle like 'OF-2026-88%')
  and exists (select 1 from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt where lt.detalle = 'SECRETO_ALERTA_24_7'),
  'Dirección ve los detalles de todas las áreas, órdenes y alertas'
);

select ok(
  not exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.titulo like '%SECRETO_NOTA_PRIVADA%'
       or coalesce(lt.detalle, '') like '%SECRETO_NOTA_PRIVADA%'
  ),
  'get_linea_tiempo nunca expone notas privadas de nota_area'
);

-- 10-11. Psicología: ve títulos de todo, detalle solo de Psicología y NULL en TS/alerta
select pg_temp.as_user('92000000-0000-4000-a000-000000000003');
select is(
  (select count(distinct lt.tipo)::integer from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt),
  6,
  'Psicología ve los títulos de los 6 tipos de evento del caso'
);

select ok(
  exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion' and lt.area = 'Psicología' and lt.detalle = 'SECRETO_ATENCION_PSIC'
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion' and lt.area = 'Trabajo Social' and lt.detalle is null
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'alerta' and lt.detalle is null
  ),
  'Psicología ve su detalle propio pero detalle NULL en atenciones de TS y alertas'
);

-- 12. Trabajo Social: ve detalle de TS y derivación, pero detalle NULL en Psicología
select pg_temp.as_user('92000000-0000-4000-a000-000000000002');
select ok(
  exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion' and lt.area = 'Trabajo Social' and lt.detalle = 'SECRETO_ATENCION_TS'
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'derivacion' and lt.detalle = 'SECRETO_DERIVACION_TS_JUR'
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion' and lt.area = 'Psicología' and lt.detalle is null
  ),
  'Trabajo Social ve su detalle y su derivación, pero detalle NULL en Psicología'
);

-- 13. Jurídico: ve detalle de derivación destino, orden y alerta, pero detalle NULL en atención TS
select pg_temp.as_user('92000000-0000-4000-a000-000000000004');
select ok(
  exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'derivacion' and lt.detalle = 'SECRETO_DERIVACION_TS_JUR'
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'orden_proteccion' and lt.detalle like 'OF-2026-88%'
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'alerta' and lt.detalle = 'SECRETO_ALERTA_24_7'
  )
  and exists (
    select 1
    from public.get_linea_tiempo('92000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion' and lt.area = 'Trabajo Social' and lt.detalle is null
  ),
  'Jurídico ve derivación destino, orden y alerta, pero detalle NULL en atención de TS'
);

select * from finish();

rollback;
