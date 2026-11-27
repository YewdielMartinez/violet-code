-- =====================================================================
-- 45_perfil_app.test.sql (Tarjeta #93)
-- Verifica registrar_mi_perfil(), get_mi_estado_app(), desactivar_mi_cuenta()
-- y cierre de INSERT directo en pre_registro (with check false).
-- =====================================================================

begin;

select plan(13);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Persona existente para probar que la liga silenciosa por CURP sigue funcionando sin exponerse
insert into public.persona (
  id, curp, nombres, apellido_paterno, apellido_materno, creado_por
) values (
  '99000000-0000-4000-a000-000000000101',
  'LIGA920510MSLRNR01',
  'Mónica', 'Liga', 'Silenciosa',
  '11111111-1111-4111-8111-111111111103'
);

-- Nueva cuenta de usuaria app (trigger la marca como usuaria_app)
insert into auth.users (id, email)
values ('99000000-0000-4000-a000-000000000001', 'app45@test.local');

-- 1-3) anon y empleada rechazados con 42501
select is(has_function_privilege('anon', 'public.registrar_mi_perfil(text, text, text, text, text, boolean)', 'execute'), false, 'anon sin EXECUTE en registrar_mi_perfil');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.registrar_mi_perfil('LIGA920510MSLRNR01', 'Mónica', 'Liga', 'Silenciosa', '6681234567', true)$$,
  '42501',
  null,
  'empleada no puede ejecutar registrar_mi_perfil (42501)'
);

select throws_ok(
  $$select * from public.get_mi_estado_app()$$,
  '42501',
  null,
  'empleada no puede ejecutar get_mi_estado_app (42501)'
);

-- 4) INSERT directo en pre_registro bloqueado para usuaria_app (42501)
select pg_temp.set_actor('99000000-0000-4000-a000-000000000001'::uuid);
select throws_ok(
  $$insert into public.pre_registro (auth_user_id, curp, nombres, apellido_paterno, aviso_privacidad_aceptado_en)
    values ('99000000-0000-4000-a000-000000000001', 'LIGA920510MSLRNR01', 'Mónica', 'Liga', now())$$,
  '42501',
  null,
  'INSERT directo en pre_registro bloqueado con 42501'
);

-- 5) get_mi_estado_app antes de registrar perfil
select is(
  (select json_build_object(
    'tiene_perfil', tiene_perfil,
    'puede_enviar_alerta', puede_enviar_alerta,
    'alertas_ultima_hora', alertas_ultima_hora
  )::text from public.get_mi_estado_app()),
  json_build_object(
    'tiene_perfil', false,
    'puede_enviar_alerta', false,
    'alertas_ultima_hora', 0
  )::text,
  'get_mi_estado_app devuelve tiene_perfil = false antes de registrar perfil'
);

-- 6) registrar_mi_perfil exige aviso de privacidad (23514)
select throws_ok(
  $$select * from public.registrar_mi_perfil('LIGA920510MSLRNR01', 'Mónica', 'Liga', 'Silenciosa', '6681234567', false)$$,
  '23514',
  null,
  'registrar_mi_perfil exige aviso de privacidad aceptado'
);

-- 7-8) registrar_mi_perfil exitoso + liga silenciosa por CURP en BD sin exponer persona_id ni estado
create temp table tmp_perfil as
select * from public.registrar_mi_perfil(
  'liga920510mslrnr01',
  'Mónica',
  'Liga',
  'Silenciosa',
  '6681234567',
  true
);

select is(
  (select curp from tmp_perfil),
  'LIGA920510MSLRNR01',
  'registrar_mi_perfil normaliza CURP y crea perfil'
);

reset role;
select is(
  (select pr.persona_id from public.pre_registro pr where pr.id = (select id from tmp_perfil)),
  '99000000-0000-4000-a000-000000000101'::uuid,
  'la liga silenciosa por CURP sigue ligando persona_id internamente'
);

-- 9-10) Ninguna salida expone persona_id ni estado
select ok(
  pg_get_function_result('public.registrar_mi_perfil(text, text, text, text, text, boolean)'::regprocedure) !~* '(persona_id|\mestado\M)'
  and pg_get_function_result('public.get_mi_estado_app()'::regprocedure) !~* '(persona_id|\mestado\M)',
  'ninguna salida de registrar_mi_perfil o get_mi_estado_app expone persona_id ni estado'
);

select pg_temp.set_actor('99000000-0000-4000-a000-000000000001'::uuid);
select is(
  (select json_build_object(
    'tiene_perfil', tiene_perfil,
    'puede_enviar_alerta', puede_enviar_alerta,
    'alertas_ultima_hora', alertas_ultima_hora
  )::text from public.get_mi_estado_app()),
  json_build_object(
    'tiene_perfil', true,
    'puede_enviar_alerta', true,
    'alertas_ultima_hora', 0
  )::text,
  'get_mi_estado_app devuelve tiene_perfil = true y puede_enviar_alerta = true tras registro'
);

-- 11-13) desactivar_mi_cuenta desactiva perfil, actualiza get_mi_estado_app e impide enviar alertas
select is(public.desactivar_mi_cuenta(), true, 'desactivar_mi_cuenta devuelve true');

select is(
  (select json_build_object(
    'tiene_perfil', tiene_perfil,
    'puede_enviar_alerta', puede_enviar_alerta
  )::text from public.get_mi_estado_app()),
  json_build_object(
    'tiene_perfil', false,
    'puede_enviar_alerta', false
  )::text,
  'tras desactivar_mi_cuenta, tiene_perfil y puede_enviar_alerta son false'
);

select throws_ok(
  $$insert into public.alerta (pre_registro_id, origen)
    values ((select id from tmp_perfil), 'app_movil')$$,
  '42501',
  null,
  'tras desactivar_mi_cuenta no se pueden enviar alertas (42501)'
);

select * from finish();
rollback;
