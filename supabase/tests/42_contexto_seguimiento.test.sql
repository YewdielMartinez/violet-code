-- =====================================================================
-- 42_contexto_seguimiento.test.sql (Tarjeta #90)
-- Verifica RPC get_contexto_seguimiento(p_cita_id): permisos, filtro
-- estricto de cita del área y del día, bitácora 'ver', aislamiento de
-- notas/folios por área, historial clínico solo en Psicología y cero CURP.
-- =====================================================================

begin;

select plan(12);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Datos aislados para #90
insert into public.persona (
  id, curp, nombres, apellido_paterno, apellido_materno, creado_por
) values (
  '96000000-0000-4000-a000-000000000101',
  'COXT900510MSLRNR01',
  'Lucía', 'Contexto', 'Seguimiento',
  '11111111-1111-4111-8111-111111111103'
);

insert into public.ficha_registro (
  id, persona_id, aviso_privacidad_aceptado_en, creado_por
) values (
  '96000000-0000-4000-a000-000000000201',
  '96000000-0000-4000-a000-000000000101',
  now(),
  '11111111-1111-4111-8111-111111111103'
);

insert into public.orden_proteccion (
  id, ficha_id, numero_oficio, autoridad_emisora, fecha_emision, fecha_vigencia, estado, creado_por
) values (
  '96000000-0000-4000-a000-000000000501',
  '96000000-0000-4000-a000-000000000201',
  'OF-90-001',
  'Juzgado Familiar',
  current_date - 1,
  current_date + 30,
  'vigente',
  '11111111-1111-4111-8111-111111111105'
);

-- Citas: TS hoy, Psi hoy, TS ayer, TS mañana
insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '96000000-0000-4000-a000-000000000301',
  '96000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '10 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '96000000-0000-4000-a000-000000000302',
  '96000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '11 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111104'
from public.cat_area ca where ca.clave = 'psicologia' limit 1;

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '96000000-0000-4000-a000-000000000303',
  '96000000-0000-4000-a000-000000000101',
  ca.id,
  ((date_trunc('day', now() at time zone 'America/Mazatlan') - interval '1 day') at time zone 'America/Mazatlan') + interval '10 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '96000000-0000-4000-a000-000000000304',
  '96000000-0000-4000-a000-000000000101',
  ca.id,
  ((date_trunc('day', now() at time zone 'America/Mazatlan') + interval '1 day') at time zone 'America/Mazatlan') + interval '10 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- Atención previa en Trabajo Social (para probar último folio/próxima acción solo de TS)
insert into public.atencion (
  id, ficha_id, area_id, tipo_atencion_id, atendida_por, proxima_accion, creado_por
)
select
  '96000000-0000-4000-a000-000000000401',
  '96000000-0000-4000-a000-000000000201',
  ca.id,
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  '11111111-1111-4111-8111-111111111103',
  'Canalizar a Psicología',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- 1) anon no tiene EXECUTE
select is(
  has_function_privilege('anon', 'public.get_contexto_seguimiento(uuid)', 'execute'),
  false,
  'anon no puede ejecutar get_contexto_seguimiento'
);

-- 2) recepcion -> 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid);
select throws_ok(
  $$select * from public.get_contexto_seguimiento('96000000-0000-4000-a000-000000000301')$$,
  '42501',
  null,
  'recepcion no tiene permiso para get_contexto_seguimiento'
);

-- 3) p_cita_id nulo -> 23514
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.get_contexto_seguimiento(null)$$,
  '23514',
  null,
  'p_cita_id nulo lanza 23514'
);

-- 4) Cita de otra área (Psicología para actor TS) -> 23514
select throws_ok(
  $$select * from public.get_contexto_seguimiento('96000000-0000-4000-a000-000000000302')$$,
  '23514',
  null,
  'cita de otra área lanza 23514'
);

-- 5) Cita de ayer -> 23514
select throws_ok(
  $$select * from public.get_contexto_seguimiento('96000000-0000-4000-a000-000000000303')$$,
  '23514',
  null,
  'cita de ayer lanza 23514'
);

-- 6) Cita de mañana -> 23514
select throws_ok(
  $$select * from public.get_contexto_seguimiento('96000000-0000-4000-a000-000000000304')$$,
  '23514',
  null,
  'cita de mañana lanza 23514'
);

-- 7) La firma de salida nunca incluye CURP, agresor ni estudio socioeconómico
select ok(
  pg_get_function_result('public.get_contexto_seguimiento(uuid)'::regprocedure) !~* '(curp|agresor|estudio)',
  'la salida de get_contexto_seguimiento no expone CURP, agresor ni estudio'
);

-- 8-10) TS recibe datos mínimos, último folio/próxima acción de TS, orden vigente y null en historial clínico
create temp table tmp_ctx_ts as
select * from public.get_contexto_seguimiento('96000000-0000-4000-a000-000000000301');

select is(
  (select json_build_object(
    'nombre', nombre_persona,
    'es_primera_vez_area', es_primera_vez_area,
    'ultima_proxima_accion', ultima_proxima_accion,
    'tiene_orden_vigente', tiene_orden_vigente,
    'tiene_historial_clinico', tiene_historial_clinico
  )::text from tmp_ctx_ts),
  json_build_object(
    'nombre', 'Lucía Contexto Seguimiento',
    'es_primera_vez_area', false,
    'ultima_proxima_accion', 'Canalizar a Psicología',
    'tiene_orden_vigente', true,
    'tiene_historial_clinico', null::boolean
  )::text,
  'TS recibe contexto mínimo con orden vigente, última acción de TS y tiene_historial_clinico nulo'
);

select matches(
  (select ultimo_folio_seguimiento from tmp_ctx_ts),
  '^SEG-\d{4}-\d{5}$',
  'TS recibe ultimo_folio_seguimiento con formato SEG-AAAA-NNNNN'
);

reset role;
select ok(
  exists (
    select 1
    from public.bitacora_acceso b
    where b.empleado_id = '11111111-1111-4111-8111-111111111103'::uuid
      and b.accion = 'ver'
      and b.tabla_afectada = 'ficha_registro'
      and b.registro_id = '96000000-0000-4000-a000-000000000201'
  ),
  'get_contexto_seguimiento registra acceso ver en bitacora_acceso'
);

-- 11-12) Psicología recibe tiene_historial_clinico booleano y NO ve notas/folio de TS
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia

create temp table tmp_ctx_psi as
select * from public.get_contexto_seguimiento('96000000-0000-4000-a000-000000000302');

select is(
  (select json_build_object(
    'es_primera_vez_area', es_primera_vez_area,
    'ultimo_folio_seguimiento', ultimo_folio_seguimiento,
    'ultima_proxima_accion', ultima_proxima_accion,
    'tiene_historial_clinico', tiene_historial_clinico
  )::text from tmp_ctx_psi),
  json_build_object(
    'es_primera_vez_area', true,
    'ultimo_folio_seguimiento', null::text,
    'ultima_proxima_accion', null::text,
    'tiene_historial_clinico', false
  )::text,
  'Psicología recibe tiene_historial_clinico booleano y no ve folio/acción de TS'
);

select ok(
  (select edad from tmp_ctx_psi) >= 18,
  'edad calculada correctamente para persona mayor de edad'
);

select * from finish();
rollback;
