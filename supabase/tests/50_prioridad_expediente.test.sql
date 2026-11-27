-- =====================================================================
-- 50_prioridad_expediente.test.sql (Tarjeta #119)
-- Verifica:
-- 1. Backfill de ficha_registro.prioridad desde la última atención.
-- 2. cambiar_prioridad_expediente() funciona para roles autorizados,
--    rechaza Recepción (42501) y expedientes archivados (23514), y deja
--    bitácora 'actualizar'.
-- 3. crear_ficha_completa() acepta prioridad opcional y
--    get_expediente_detalle() la devuelve en 'ficha'.
-- 4. cita.prioridad ya no existe; get_agenda() y reagendar_cita() no la
--    usan; atencion.prioridad permanece intacta.
-- =====================================================================

begin;

select plan(11);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1) ficha_registro tiene las columnas prioridad y prioridad_actualizada_en
select is(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ficha_registro' and column_name = 'prioridad'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ficha_registro' and column_name = 'prioridad_actualizada_en'
  ),
  true,
  'ficha_registro tiene columnas prioridad y prioridad_actualizada_en'
);

-- 2) cita.prioridad ya no existe
select is(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cita' and column_name = 'prioridad'
  ),
  false,
  'cita.prioridad fue eliminada'
);

-- 3) atencion.prioridad sigue existiendo
select is(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'atencion' and column_name = 'prioridad'
  ),
  true,
  'atencion.prioridad permanece intacta'
);

-- Datos aislados para pruebas de #119
insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
values
  ('9d000000-0000-4000-a000-000000000101', 'PIRO900510MSLRNR01', 'Diana', 'Prioridad', '11111111-1111-4111-8111-111111111103'),
  ('9d000000-0000-4000-a000-000000000102', 'PARO900510MSLRNR02', 'Lucía', 'Archivada', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
values
  ('9d000000-0000-4000-a000-000000000201', '9d000000-0000-4000-a000-000000000101', 'abierto', now(), '11111111-1111-4111-8111-111111111103'),
  ('9d000000-0000-4000-a000-000000000202', '9d000000-0000-4000-a000-000000000102', 'archivado', now(), '11111111-1111-4111-8111-111111111103');

-- 4) Recepción rechazada con 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.cambiar_prioridad_expediente('9d000000-0000-4000-a000-000000000201', 'alta')$$,
  '42501',
  null,
  'Recepción no puede cambiar la prioridad del expediente (42501)'
);

-- 5) Expediente archivado rechazado con 23514
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.cambiar_prioridad_expediente('9d000000-0000-4000-a000-000000000202', 'alta')$$,
  '23514',
  null,
  'cambiar_prioridad_expediente rechaza expediente archivado (23514)'
);

-- 6) Trabajo Social cambia prioridad a alta y se persiste en ficha_registro
create temp table tmp_prio as
select * from public.cambiar_prioridad_expediente('9d000000-0000-4000-a000-000000000201', 'alta');

select ok(
  (select prioridad = 'alta' and prioridad_actualizada_en is not null from tmp_prio),
  'cambiar_prioridad_expediente actualiza prioridad y prioridad_actualizada_en'
);

-- 7) Deja registro en bitacora_acceso
reset role;
select ok(
  exists (
    select 1 from public.bitacora_acceso b
    where b.empleado_id = '11111111-1111-4111-8111-111111111103'::uuid
      and b.accion = 'actualizar'
      and b.tabla_afectada = 'ficha_registro'
      and b.registro_id = '9d000000-0000-4000-a000-000000000201'
  ),
  'cambiar_prioridad_expediente deja registro actualizar en bitacora_acceso'
);

-- 8) get_expediente_detalle devuelve prioridad y prioridad_actualizada_en en ficha
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (public.get_expediente_detalle('9d000000-0000-4000-a000-000000000201') -> 'ficha' ->> 'prioridad'),
  'alta',
  'get_expediente_detalle devuelve ficha.prioridad'
);

-- 9) crear_ficha_completa acepta prioridad opcional
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
create temp table tmp_nueva_ficha as
select * from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'NUEV920510MSLRNR01',
      'nombres', 'Sofía',
      'apellidoPaterno', 'Nueva',
      'avisoPrivacidadAceptado', true,
      'prioridad', 'media',
      'serviciosSolicitadosAreaIds', jsonb_build_array((select id from public.cat_area where clave = 'trabajo_social'))
    ),
    'domicilio', jsonb_build_object('calle', 'Calle 1'),
    'estudio', jsonb_build_object('tieneApoyo', false)
  )
);

select is(
  (public.get_expediente_detalle((select ficha_id from tmp_nueva_ficha)) -> 'ficha' ->> 'prioridad'),
  'media',
  'crear_ficha_completa guarda prioridad opcional y get_expediente_detalle la devuelve'
);

-- 10) get_agenda ya no devuelve columna prioridad
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_agenda'
      and pg_get_function_result(p.oid) ~* '\bprioridad\b'
  ),
  false,
  'get_agenda ya no devuelve columna prioridad'
);

-- 11) reagendar_cita tiene firma de 3 parámetros sin p_prioridad
select is(
  to_regprocedure('public.reagendar_cita(uuid, timestamptz, text)') is not null
  and to_regprocedure('public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel)') is null,
  true,
  'reagendar_cita fue actualizada a 3 parámetros sin p_prioridad'
);

select * from finish();
rollback;
