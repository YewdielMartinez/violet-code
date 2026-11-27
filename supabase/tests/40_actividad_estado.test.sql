-- =====================================================================
-- 40_actividad_estado.test.sql (pgTAP · Sprint 02 · RF-16)
-- Pruebas para migración 20261127000900_40_actividad_estado.sql:
--   - Default 'pendiente' y backfill (programada_en < now() => 'realizada').
--   - Constraint estado = 'realizada' => realizada_en not null.
--   - actualizar_estado_actividad: transiciones válidas, mismo estado (22023),
--     realizada <-> cancelada directo (22023), validaciones (23514), P0002.
--   - Permisos: recepcion, umeca y anon rechazados (42501).
--   - get_actividades_preventivas: filtro p_estado y nuevas columnas.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(24);

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
  v_area_ts  smallint;
  v_uid_ts   uuid := '97000000-0000-4000-a000-000000000001';
  v_uid_rec  uuid := '97000000-0000-4000-a000-000000000003';
  v_uid_umec uuid := '97000000-0000-4000-a000-000000000005';
  v_tipo     smallint;
begin
  select ca.id into v_area_ts from public.cat_area ca where ca.clave = 'trabajo_social';
  select cta.id into v_tipo from public.cat_tipo_actividad cta where cta.clave = 'taller';

  insert into auth.users (id, email) values
    (v_uid_ts,   'test40.ts@semujeres.local'),
    (v_uid_rec,  'test40.rec@semujeres.local'),
    (v_uid_umec, 'test40.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,  'TS Estado Test',        'trabajo_social', v_area_ts, true),
    (v_uid_rec, 'Recepción Estado Test', 'recepcion',      null,      true)
  on conflict (id) do nothing;

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umec, 'UMECA Estado Test', 'umeca', true)
  on conflict (id) do nothing;

  -- A: pasada, B: futura, C: futura, D: inactiva
  insert into public.actividad_preventiva
    (id, titulo, tipo_actividad_id, tipo_institucion, sede, programada_en, activo)
  values
    ('97000000-0000-4000-a000-0000000000a1', 'TEST40 Pasada',  v_tipo, 'comunidad', 'Sede A', now() - interval '30 days', true),
    ('97000000-0000-4000-a000-0000000000b1', 'TEST40 Futura B', v_tipo, 'comunidad', 'Sede B', now() + interval '30 days', true),
    ('97000000-0000-4000-a000-0000000000c1', 'TEST40 Futura C', v_tipo, 'comunidad', 'Sede C', now() + interval '31 days', true),
    ('97000000-0000-4000-a000-0000000000d1', 'TEST40 Inactiva', v_tipo, 'comunidad', 'Sede D', now() + interval '32 days', false);
end $$;

-- 1. Default 'pendiente' (antes del backfill, incluso para fecha pasada)
select is(
  (select ap.estado::text from public.actividad_preventiva ap
   where ap.id = '97000000-0000-4000-a000-0000000000a1'),
  'pendiente',
  'una actividad nueva queda en estado pendiente por defecto'
);

-- Backfill: misma lógica que la migración
update public.actividad_preventiva ap
set estado = 'realizada', realizada_en = ap.programada_en
where ap.estado = 'pendiente'
  and ap.realizada_en is null
  and ap.programada_en < now()
  and ap.titulo like 'TEST40%';

-- 2-4. Backfill
select is(
  (select ap.estado::text from public.actividad_preventiva ap
   where ap.id = '97000000-0000-4000-a000-0000000000a1'),
  'realizada',
  'backfill: actividad pasada queda realizada'
);
select ok(
  (select ap.realizada_en = ap.programada_en from public.actividad_preventiva ap
   where ap.id = '97000000-0000-4000-a000-0000000000a1'),
  'backfill: realizada_en = programada_en'
);
select is(
  (select ap.estado::text from public.actividad_preventiva ap
   where ap.id = '97000000-0000-4000-a000-0000000000b1'),
  'pendiente',
  'backfill: actividad futura sigue pendiente'
);

-- 5. Constraint realizada => realizada_en
select throws_ok(
  $$update public.actividad_preventiva set estado = 'realizada', realizada_en = null
    where id = '97000000-0000-4000-a000-0000000000c1'$$,
  '23514',
  null,
  'estado realizada sin realizada_en viola el check'
);

-- 6-7. Permisos rechazados: anon
set local role anon;
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000b1', 'realizada')$$,
  '42501',
  null,
  'anon no puede actualizar estado de actividad'
);
reset role;

-- recepcion
select pg_temp.as_user('97000000-0000-4000-a000-000000000003');
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000b1', 'realizada')$$,
  '42501',
  'Sin permiso para actualizar actividades',
  'recepcion no puede actualizar estado de actividad'
);
select ok(
  (select count(*) >= 1 from public.get_actividades_preventivas(null, null, 100, 'realizada')),
  'recepcion sí puede listar actividades filtrando por estado'
);
reset role;

-- umeca
select pg_temp.as_user('97000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000b1', 'realizada')$$,
  '42501',
  null,
  'umeca no puede actualizar estado de actividad'
);
reset role;

-- trabajo social (actividad.registrar)
select pg_temp.as_user('97000000-0000-4000-a000-000000000001');

-- 10. pendiente -> realizada
select is(
  (select r.estado::text
   from public.actualizar_estado_actividad(
     '97000000-0000-4000-a000-0000000000b1', 'realizada', 45, '  Sesión completa  ', 'ignorado') r),
  'realizada',
  'pendiente -> realizada devuelve estado realizada'
);
select ok(
  (select ap.realizada_en is not null
          and ap.numero_asistentes = 45
          and ap.observaciones_cierre = 'Sesión completa'
          and ap.cancelada_motivo is null
   from public.actividad_preventiva ap
   where ap.id = '97000000-0000-4000-a000-0000000000b1'),
  'realizada guarda realizada_en, asistentes y observaciones (trim); ignora motivo'
);

-- 12. mismo estado
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000b1', 'realizada')$$,
  '22023',
  'La actividad ya está en ese estado',
  'mismo estado lanza 22023'
);
-- 13. realizada -> cancelada directo
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000b1', 'cancelada')$$,
  '22023',
  null,
  'realizada -> cancelada directo lanza 22023 (reabrir primero)'
);

-- 14. realizada -> pendiente limpia datos de cierre
select is(
  (select r.realizada_en::text
   from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000b1', 'pendiente') r),
  null,
  'reabrir (realizada -> pendiente) devuelve realizada_en nulo'
);
select ok(
  (select ap.estado = 'pendiente' and ap.realizada_en is null and ap.observaciones_cierre is null
   from public.actividad_preventiva ap
   where ap.id = '97000000-0000-4000-a000-0000000000b1'),
  'reabrir limpia realizada_en y observaciones_cierre'
);

-- 16. pendiente -> cancelada con motivo; cancelada -> pendiente limpia motivo
select ok(
  (select r.estado = 'cancelada'
   from public.actualizar_estado_actividad(
     '97000000-0000-4000-a000-0000000000c1', 'cancelada', null, null, 'Lluvia') r),
  'pendiente -> cancelada con motivo'
);

-- 17. get: nuevas columnas y filtro cancelada
select is(
  (select g.cancelada_motivo from public.get_actividades_preventivas(null, null, 100, 'cancelada') g
   where g.id = '97000000-0000-4000-a000-0000000000c1'),
  'Lluvia',
  'get_actividades_preventivas expone cancelada_motivo y filtra por cancelada'
);
-- 18. filtro realizada incluye A y excluye B/C
select ok(
  (select count(*) = 1 from public.get_actividades_preventivas(null, null, 200, 'realizada') g
   where g.titulo like 'TEST40%' and g.id = '97000000-0000-4000-a000-0000000000a1'
     and g.realizada_en is not null)
  and not exists (
    select 1 from public.get_actividades_preventivas(null, null, 200, 'realizada') g
    where g.id in ('97000000-0000-4000-a000-0000000000b1', '97000000-0000-4000-a000-0000000000c1')),
  'filtro p_estado = realizada devuelve solo realizadas (con realizada_en)'
);
-- 19. filtro pendiente
select ok(
  exists (
    select 1 from public.get_actividades_preventivas(null, null, 200, 'pendiente') g
    where g.id = '97000000-0000-4000-a000-0000000000b1')
  and not exists (
    select 1 from public.get_actividades_preventivas(null, null, 200, 'pendiente') g
    where g.id in ('97000000-0000-4000-a000-0000000000a1', '97000000-0000-4000-a000-0000000000c1')),
  'filtro p_estado = pendiente devuelve solo pendientes'
);

-- 20. cancelada -> pendiente limpia motivo
select ok(
  (select r.estado = 'pendiente'
   from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000c1', 'pendiente') r)
  and (select ap.cancelada_motivo is null from public.actividad_preventiva ap
       where ap.id = '97000000-0000-4000-a000-0000000000c1'),
  'cancelada -> pendiente limpia cancelada_motivo'
);

-- 21. asistentes fuera de rango
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000c1', 'realizada', 10001)$$,
  '23514',
  null,
  'numero_asistentes fuera de 0..10000 lanza 23514'
);

-- 22-23. no encontrada / inactiva
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000ff', 'realizada')$$,
  'P0002',
  null,
  'actividad inexistente lanza P0002'
);
select throws_ok(
  $$select * from public.actualizar_estado_actividad('97000000-0000-4000-a000-0000000000d1', 'realizada')$$,
  'P0002',
  null,
  'actividad inactiva lanza P0002'
);

reset role;

-- 24. bitácora
select ok(
  exists (
    select 1 from public.bitacora_acceso ba
    where ba.tabla_afectada = 'actividad_preventiva'
      and ba.registro_id = '97000000-0000-4000-a000-0000000000b1'
      and ba.accion = 'actualizar'
      and ba.empleado_id = '97000000-0000-4000-a000-000000000001'),
  'actualizar_estado_actividad registra en bitacora_acceso'
);

select * from finish();
rollback;
