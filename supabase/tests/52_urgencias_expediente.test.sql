-- =====================================================================
-- 52_urgencias_expediente.test.sql (Tarjeta #121)
-- Verifica que vista_lista_urgencias y get_lista_urgencias() usan
-- ficha_registro.prioridad = 'alta' + sin cita futura, que desaparece
-- al agendar o bajar la prioridad y que Recepción la consulta.
-- =====================================================================

begin;

select plan(6);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Datos aislados
insert into public.persona (id, curp, nombres, apellido_paterno, celular, creado_por)
values ('9f000000-0000-4000-a000-000000000101', 'UURG900510MSLRNR01', 'Carmen', 'Urgencia', '6681112233', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, folio, persona_id, estado, prioridad, prioridad_actualizada_en, aviso_privacidad_aceptado_en, creado_por)
values ('9f000000-0000-4000-a000-000000000201', 'SEM-EXP-URG01', '9f000000-0000-4000-a000-000000000101', 'abierto', 'alta', now() - interval '2 days', now(), '11111111-1111-4111-8111-111111111103');

insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
select '9f000000-0000-4000-a000-000000000201', id, '11111111-1111-4111-8111-111111111103'
from public.cat_area where clave = 'psicologia';

-- 1) Recepción consulta get_lista_urgencias y aparece con prioridad_actualizada_en
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select ok(
  exists (
    select 1 from public.get_lista_urgencias() glu
    where glu.ficha_id = '9f000000-0000-4000-a000-000000000201'
      and glu.prioridad_actualizada_en is not null
  ),
  'Recepción consulta get_lista_urgencias y ve expediente con prioridad alta'
);

-- 2) Filtro por p_area_id incluye el área solicitada y excluye otra
select ok(
  exists (
    select 1 from public.get_lista_urgencias((select id from public.cat_area where clave = 'psicologia')) glu
    where glu.ficha_id = '9f000000-0000-4000-a000-000000000201'
  ) and not exists (
    select 1 from public.get_lista_urgencias((select id from public.cat_area where clave = 'juridico')) glu
    where glu.ficha_id = '9f000000-0000-4000-a000-000000000201'
  ),
  'get_lista_urgencias filtra correctamente por p_area_id'
);

-- 3) vista_lista_urgencias también la incluye para Trabajo Social
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select ok(
  exists (
    select 1 from public.vista_lista_urgencias vlu
    where vlu.ficha_id = '9f000000-0000-4000-a000-000000000201'
      and vlu.prioridad_actualizada_en is not null
  ),
  'vista_lista_urgencias lee ficha_registro.prioridad = alta'
);

-- 4) Desaparece al agendar una cita futura mediante crear_cita()
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select * from public.crear_cita(
  '9f000000-0000-4000-a000-000000000101',
  (select id from public.cat_area where clave = 'psicologia'),
  now() + interval '2 days'
);

select is(
  exists (
    select 1 from public.get_lista_urgencias() glu
    where glu.ficha_id = '9f000000-0000-4000-a000-000000000201'
  ),
  false,
  'desaparece de la lista de urgencias al agendar cita futura'
);

-- 5) Si se cancela la cita vuelve, y al bajar prioridad a media desaparece
update public.cita
set estado = 'cancelada'
where persona_id = '9f000000-0000-4000-a000-000000000101';

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select * from public.cambiar_prioridad_expediente('9f000000-0000-4000-a000-000000000201', 'media');

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is(
  exists (
    select 1 from public.get_lista_urgencias() glu
    where glu.ficha_id = '9f000000-0000-4000-a000-000000000201'
  ),
  false,
  'desaparece de la lista de urgencias al bajar prioridad del expediente'
);

-- 6) Jurídico sigue rechazado con 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.get_lista_urgencias()$$,
  '42501',
  null,
  'Jurídico no tiene urgencias.ver (42501)'
);

select * from finish();
rollback;
