-- =====================================================================
-- 46_enviar_alerta.test.sql (Tarjeta #94)
-- Verifica:
--   - enviar_alerta() exclusivo de es_usuaria_app() (anon/empleado -> 42501).
--   - Sin perfil activo -> 23514.
--   - INSERT directo de usuaria_app en alerta bloqueado (42501).
--   - Personal con alerta.atender sigue registrando alertas por teléfono.
--   - Límite de 3 alertas por hora: la 4.ª alerta lanza 23514.
-- =====================================================================

begin;

select plan(10);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Dos cuentas usuaria_app nuevas: una sin perfil y una con perfil
insert into auth.users (id, email) values
  ('9a000000-0000-4000-a000-000000000001', 'sinperfil46@test.local'),
  ('9a000000-0000-4000-a000-000000000002', 'conperfil46@test.local');

-- 1-2) anon y empleada rechazados en enviar_alerta
select is(has_function_privilege('anon', 'public.enviar_alerta(integer)', 'execute'), false, 'anon sin EXECUTE en enviar_alerta');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.enviar_alerta(null)$$,
  '42501',
  null,
  'empleada no puede ejecutar enviar_alerta (42501)'
);

-- 3) usuaria_app sin perfil -> 23514
select pg_temp.set_actor('9a000000-0000-4000-a000-000000000001'::uuid);
select throws_ok(
  $$select * from public.enviar_alerta(null)$$,
  '23514',
  null,
  'usuaria_app sin perfil activo lanza 23514'
);

-- 4) Personal con alerta.atender (juridico) sigue insertando alertas por teléfono
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select lives_ok(
  $$insert into public.alerta (origen, observaciones) values ('telefono', 'Llamada a línea 24/7')$$,
  'personal con alerta.atender sigue registrando alertas por teléfono'
);

-- 5) usuaria_app registra perfil y falla en INSERT directo sobre alerta (42501)
select pg_temp.set_actor('9a000000-0000-4000-a000-000000000002'::uuid);
select * from public.registrar_mi_perfil('AERT920510MSLRNR01', 'Ana', 'Alerta', null, '6681234567', true);

select throws_ok(
  $$insert into public.alerta (pre_registro_id, origen) values (public.mi_pre_registro_id(), 'app_movil')$$,
  '42501',
  null,
  'INSERT directo en alerta falla para usuaria_app (42501)'
);

-- 6-10) Envía 3 alertas válidas; get_mi_estado_app refleja límite; 4.ª alerta lanza 23514
select lives_ok($$select * from public.enviar_alerta(null)$$, '1ra alerta en la hora permitida');
select lives_ok($$select * from public.enviar_alerta(null)$$, '2da alerta en la hora permitida');
select lives_ok($$select * from public.enviar_alerta(null)$$, '3ra alerta en la hora permitida');

select is(
  (select json_build_object(
    'alertas_ultima_hora', alertas_ultima_hora,
    'puede_enviar_alerta', puede_enviar_alerta
  )::text from public.get_mi_estado_app()),
  json_build_object(
    'alertas_ultima_hora', 3,
    'puede_enviar_alerta', false
  )::text,
  'tras 3 alertas, get_mi_estado_app marca puede_enviar_alerta = false'
);

select throws_ok(
  $$select * from public.enviar_alerta(null)$$,
  '23514',
  null,
  '4ta alerta en la misma hora lanza 23514'
);

select * from finish();
rollback;
