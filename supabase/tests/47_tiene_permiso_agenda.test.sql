-- =====================================================================
-- 47_tiene_permiso_agenda.test.sql (Tarjeta #95)
-- Verifica que las 7 RPC de agenda y alertas usen tiene_permiso() en lugar
-- de e.rol in (...) manteniendo alcance por área, y que get_linea_tiempo
-- muestre el folio_seguimiento y el evento de archivo.
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

-- 1-7) Verificar en catálogo que las 7 RPC usan tiene_permiso() y no e.rol in
select ok(
  pg_get_functiondef('public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int)'::regprocedure) ~* 'tiene_permiso\(''agenda\.ver''\)'
  and pg_get_functiondef('public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int)'::regprocedure) !~* 'e\.rol\s+in',
  'get_agenda usa tiene_permiso(agenda.ver) sin e.rol in'
);

select ok(
  pg_get_functiondef('public.cambiar_estado_cita(uuid, public.estado_cita, text)'::regprocedure) ~* 'tiene_permiso\(''agenda\.gestionar''\)'
  and pg_get_functiondef('public.cambiar_estado_cita(uuid, public.estado_cita, text)'::regprocedure) !~* 'e\.rol\s+in',
  'cambiar_estado_cita usa tiene_permiso(agenda.gestionar) sin e.rol in'
);

select ok(
  pg_get_functiondef('public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel)'::regprocedure) ~* 'tiene_permiso\(''agenda\.gestionar''\)'
  and pg_get_functiondef('public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel)'::regprocedure) !~* 'e\.rol\s+in',
  'reagendar_cita usa tiene_permiso(agenda.gestionar) sin e.rol in'
);

select ok(
  pg_get_functiondef('public.get_lista_urgencias(smallint)'::regprocedure) ~* 'tiene_permiso\(''urgencias\.ver''\)'
  and pg_get_functiondef('public.get_lista_urgencias(smallint)'::regprocedure) !~* 'e\.rol\s+in',
  'get_lista_urgencias usa tiene_permiso(urgencias.ver) sin e.rol in'
);

select ok(
  pg_get_functiondef('public.get_cola_alertas(public.estado_alerta[], int)'::regprocedure) ~* 'tiene_permiso\(''alerta\.ver_cola''\)'
  and pg_get_functiondef('public.get_cola_alertas(public.estado_alerta[], int)'::regprocedure) !~* 'e\.rol\s+in',
  'get_cola_alertas usa tiene_permiso(alerta.ver_cola) sin e.rol in'
);

select ok(
  pg_get_functiondef('public.tomar_alerta(uuid)'::regprocedure) ~* 'tiene_permiso\(''alerta\.atender''\)'
  and pg_get_functiondef('public.tomar_alerta(uuid)'::regprocedure) !~* 'e\.rol\s+in',
  'tomar_alerta usa tiene_permiso(alerta.atender) sin e.rol in'
);

select ok(
  pg_get_functiondef('public.atender_alerta(uuid, text)'::regprocedure) ~* 'tiene_permiso\(''alerta\.atender''\)'
  and pg_get_functiondef('public.atender_alerta(uuid, text)'::regprocedure) !~* 'e\.rol\s+in',
  'atender_alerta usa tiene_permiso(alerta.atender) sin e.rol in'
);

-- 8-10) Validación en ejecución por rol
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.get_lista_urgencias(null)$$,
  '42501',
  null,
  'juridico no tiene urgencias.ver (42501)'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.get_cola_alertas(null, 50)$$,
  '42501',
  null,
  'recepcion no tiene alerta.ver_cola (42501)'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.tomar_alerta('93000000-0000-4000-a000-000000000001')$$,
  '42501',
  null,
  'trabajo_social no tiene alerta.atender (42501)'
);

-- 11-12) get_linea_tiempo muestra folio_seguimiento y evento de archivo
reset role;
insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
values ('9b000000-0000-4000-a000-000000000101', 'LINE900510MSLRNR01', 'Clara', 'Tiempo', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
values ('9b000000-0000-4000-a000-000000000201', '9b000000-0000-4000-a000-000000000101', 'archivado', now(), '11111111-1111-4111-8111-111111111103');

insert into public.atencion (id, ficha_id, area_id, tipo_atencion_id, atendida_por, creado_por)
select '9b000000-0000-4000-a000-000000000401', '9b000000-0000-4000-a000-000000000201', ca.id, (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'), '11111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select ok(
  exists (
    select 1
    from public.get_linea_tiempo('9b000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion'
      and lt.titulo ~ '\(SEG-\d{4}-\d{5}\)'
  ),
  'get_linea_tiempo muestra folio_seguimiento en el título de atención'
);

select ok(
  exists (
    select 1
    from public.get_linea_tiempo('9b000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'archivo'
      and lt.titulo like 'Archivo de expediente %'
  ),
  'get_linea_tiempo muestra evento de archivo cuando la ficha está archivada'
);

select * from finish();
rollback;
