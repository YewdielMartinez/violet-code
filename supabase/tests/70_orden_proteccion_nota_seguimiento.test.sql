create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 70_orden_proteccion_nota_seguimiento.test.sql
-- Verifica la migración 20261128002900_70_orden_proteccion_nota_seguimiento.sql
-- (delta sobre 65_historial_ordenes_proteccion.sql):
--   - Un solo trigger de alta y uno de cambio de estado (sin eventos duplicados).
--   - El alta de una orden registra el evento inicial (estado_anterior = null).
--   - Cambiar el estado (update directo, como hace la web) registra un evento
--     con estado anterior/nuevo, nota y usuario; la nota transitoria no se
--     conserva en la orden.
--   - Editar otros campos o archivar sin cambiar el estado no registra eventos.
--   - get_linea_tiempo() muestra «Orden de protección: <anterior> → <nuevo>»
--     (tipo 'orden_proteccion'), con detalle (usuario y nota) solo para
--     Dirección, Jurídico y Trabajo Social.
--   - orden_proteccion_evento es append-only bajo RLS y legible con
--     expediente.ver (no para Recepción).
--   - Las órdenes archivadas salen de la línea de tiempo.
-- =====================================================================

begin;

select plan(25);

do $$
declare
  v_uid_ts  uuid := '11111111-1111-4111-8111-111111111103';
  v_per_id  uuid := '66000000-0000-4000-a000-000000000101';
  v_fic_id  uuid := '66000000-0000-4000-a000-000000000201';
  v_ord_id  uuid := '66000000-0000-4000-a000-000000000301';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values (v_per_id, 'MOVV920515MSLGRN66', 'Valeria', 'Montes', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por
  ) values (
    v_fic_id, 'SEM-S366-0001', v_per_id, 'abierto', now(), v_uid_ts
  );

  insert into public.orden_proteccion (
    id, ficha_id, numero_oficio, autoridad_emisora, fecha_emision, estado, creado_por
  ) values (
    v_ord_id, v_fic_id, 'OF-66-01', 'Juzgado Familiar', current_date, 'en_tramite', v_uid_ts
  );
end;
$$;

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
  end if;
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

set local role authenticated;

-- 0) Un solo trigger de alta y uno de cambio de estado (sin duplicados)
select is(
  (
    select count(*)::int
    from pg_trigger t
    where t.tgrelid = 'public.orden_proteccion'::regclass
      and not t.tgisinternal
      and t.tgfoid = 'public.registrar_evento_orden_proteccion()'::regprocedure
  ),
  2,
  'orden_proteccion tiene exactamente 2 triggers de eventos (alta y cambio de estado)'
);

select is(
  (
    select count(*)::int
    from pg_trigger t
    where t.tgrelid = 'public.orden_proteccion'::regclass
      and not t.tgisinternal
      and t.tgname in ('orden_proteccion_evento_trg', 'orden_proteccion_evento_alta_trg')
      and t.tgtype & 2 = 2   -- BEFORE
      and t.tgtype & 16 = 16 -- UPDATE
  ),
  1,
  'el trigger de cambio de estado es BEFORE UPDATE (limpia la nota transitoria)'
);

-- 1) Alta: evento inicial
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (
    select count(*)::int
    from public.orden_proteccion_evento oe
    where oe.orden_id = '66000000-0000-4000-a000-000000000301'
      and oe.estado_anterior is null
      and oe.estado_nuevo = 'en_tramite'
  ),
  1,
  'el alta de la orden registra el evento inicial (estado_anterior = null)'
);

-- 2) Cambio de estado con nota (update directo, igual que la web)
select lives_ok(
  $$update public.orden_proteccion
    set estado = 'vigente', nota_cambio_estado = '  Oficio ratificado por el juzgado  '
    where id = '66000000-0000-4000-a000-000000000301'$$,
  'trabajo_social cambia el estado de la orden en_tramite -> vigente con nota'
);

select is(
  (
    select count(*)::int
    from public.orden_proteccion_evento oe
    where oe.orden_id = '66000000-0000-4000-a000-000000000301'
      and oe.estado_anterior = 'en_tramite'
      and oe.estado_nuevo = 'vigente'
      and oe.nota = 'Oficio ratificado por el juzgado'
      and oe.creado_por = '11111111-1111-4111-8111-111111111103'
  ),
  1,
  'el cambio registra estado anterior, nuevo, nota limpia y usuario'
);

select is(
  (select nota_cambio_estado from public.orden_proteccion where id = '66000000-0000-4000-a000-000000000301'),
  null,
  'la nota transitoria no se conserva en la orden'
);

-- 3) Editar otros campos no registra eventos
select lives_ok(
  $$update public.orden_proteccion
    set autoridad_emisora = 'Juzgado Familiar Segundo'
    where id = '66000000-0000-4000-a000-000000000301'$$,
  'editar la autoridad emisora sin cambiar el estado funciona'
);

select is(
  (
    select count(*)::int
    from public.orden_proteccion_evento oe
    where oe.orden_id = '66000000-0000-4000-a000-000000000301'
  ),
  2,
  'sin cambio de estado no se agregan eventos (solo alta + un cambio)'
);

-- 4) Cambio de estado sin nota
select lives_ok(
  $$update public.orden_proteccion
    set estado = 'vencida'
    where id = '66000000-0000-4000-a000-000000000301'$$,
  'trabajo_social cambia el estado vigente -> vencida sin nota'
);

select is(
  (
    select count(*)::int
    from public.orden_proteccion_evento oe
    where oe.orden_id = '66000000-0000-4000-a000-000000000301'
      and oe.estado_anterior = 'vigente'
      and oe.estado_nuevo = 'vencida'
      and oe.nota is null
  ),
  1,
  'el cambio sin nota registra el evento con nota nula'
);

-- 5) La nota no puede exceder 1000 caracteres
select throws_ok(
  $$update public.orden_proteccion
    set estado = 'cancelada', nota_cambio_estado = repeat('x', 1001)
    where id = '66000000-0000-4000-a000-000000000301'$$,
  '23514', null,
  'una nota de más de 1000 caracteres se rechaza con 23514'
);

-- 6) Línea de tiempo: título y detalle para trabajo_social
select is(
  (
    select count(*)::int
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201')
    where tipo = 'orden_proteccion'
      and titulo = 'Orden de protección: vigente → vencida'
  ),
  1,
  'get_linea_tiempo muestra «Orden de protección: vigente → vencida»'
);

select ok(
  exists (
    select 1
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'orden_proteccion'
      and lt.titulo = 'Orden de protección: en_tramite → vigente'
      and lt.detalle like 'Por %'
      and lt.detalle like '%Oficio ratificado por el juzgado'
  ),
  'trabajo_social ve usuario y nota del cambio en el detalle'
);

select is(
  (
    select lt.titulo
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'orden_proteccion'
      and lt.titulo like 'Orden de protección registrada · %'
  ),
  'Orden de protección registrada · en_tramite',
  'el título del alta conserva el estado inicial aunque la orden ya cambió'
);

-- 6b) Sin duplicados: un evento por transición (alta + 2 cambios = 3)
select is(
  (
    select count(*)::int
    from public.orden_proteccion_evento oe
    where oe.orden_id = '66000000-0000-4000-a000-000000000301'
  ),
  3,
  'cada alta/cambio de estado genera un solo evento (sin duplicados)'
);

select ok(
  exists (
    select 1
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201') lt
    where lt.titulo = 'Orden de protección registrada · en_tramite'
      and lt.detalle like 'OF-66-01%'
  ),
  'trabajo_social ve oficio y autoridad en el detalle del alta'
);

select ok(
  exists (
    select 1
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201') lt
    where lt.titulo = 'Orden de protección: vigente → vencida'
      and lt.detalle like 'Por %'
      and lt.detalle not like '%—%'
  ),
  'un cambio sin nota muestra solo «Por <empleado>» en el detalle'
);

-- 6c) Dirección también ve el detalle
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- direccion
select ok(
  exists (
    select 1
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201') lt
    where lt.titulo = 'Orden de protección: en_tramite → vigente'
      and lt.detalle like 'Por %'
      and lt.detalle like '%Oficio ratificado por el juzgado'
  ),
  'direccion ve usuario y nota del cambio en el detalle'
);
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

-- 7) Psicología ve el evento pero no el detalle
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select ok(
  exists (
    select 1
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201') lt
    where lt.titulo = 'Orden de protección: en_tramite → vigente'
      and lt.detalle is null
  ),
  'psicologia ve el cambio de estado pero no su detalle (usuario/nota)'
);

-- 8) RLS de orden_proteccion_evento
select ok(
  (select count(*) from public.orden_proteccion_evento) >= 3,
  'psicologia (expediente.ver) puede leer orden_proteccion_evento'
);

select throws_ok(
  $$insert into public.orden_proteccion_evento (orden_id, estado_anterior, estado_nuevo)
    values ('66000000-0000-4000-a000-000000000301', 'vigente', 'cancelada')$$,
  '42501', null,
  'orden_proteccion_evento no admite INSERT directo'
);

select throws_ok(
  $$update public.orden_proteccion_evento set nota = 'manipulada'$$,
  '42501', null,
  'orden_proteccion_evento no admite UPDATE directo'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is(
  (select count(*)::int from public.orden_proteccion_evento),
  0,
  'recepcion (sin expediente.ver) no ve eventos de órdenes'
);

-- 9) Archivar sin cambiar estado no agrega eventos y saca la orden de la línea de tiempo
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select lives_ok(
  $$update public.orden_proteccion set activo = false where id = '66000000-0000-4000-a000-000000000301'$$,
  'trabajo_social archiva la orden'
);

select is(
  (
    select count(*)::int
    from public.get_linea_tiempo('66000000-0000-4000-a000-000000000201')
    where tipo = 'orden_proteccion'
  ),
  0,
  'una orden archivada (y sus cambios) ya no aparece en la línea de tiempo'
);

select * from finish();
rollback;
