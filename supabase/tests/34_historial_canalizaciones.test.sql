-- =====================================================================
-- 34_historial_canalizaciones.test.sql (A-02 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000300_34_historial_canalizaciones.sql:
--   - Backfill inicial en canalizacion_evento para derivaciones existentes.
--   - crear_canalizacion() inserta automáticamente el evento inicial.
--   - cambiar_estado_derivacion() exige p_nota al concluir/cancelar (23514)
--     y registra un evento por cada transición.
--   - get_historial_canalizaciones() respeta derivacion.gestionar y ABAC.
--   - get_linea_tiempo() muestra eventos canalizacion_evento por rol/área.
--   - canalizacion_evento bloquea INSERT/UPDATE/DELETE directos bajo RLS.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(21);

create temp table pg_temp.ids_a02 (
  clave         text primary key,
  derivacion_id uuid not null
) on commit drop;
grant select, insert on pg_temp.ids_a02 to authenticated;

do $$
declare
  v_uid_ts uuid := '11111111-1111-4111-8111-111111111103';
  v_per_1  uuid := '94000000-0000-4000-a000-000000000101';
  v_fic_1  uuid := '94000000-0000-4000-a000-000000000201';
  v_per_2  uuid := '94000000-0000-4000-a000-000000000102';
  v_fic_2  uuid := '94000000-0000-4000-a000-000000000202';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values (v_per_1, 'MEEL910315MSLGRN01', 'Elena', 'Mendoza', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
  values (v_fic_1, 'SEM-S2A2-0001', v_per_1, 'abierto', now(), v_uid_ts);

  -- Derivacion "heredada" (previa a la tabla de eventos) para probar el backfill.
  -- Las derivaciones del seed se insertan DESPUES de las migraciones, por lo que
  -- el backfill de la migracion 34 nunca las ve tras un `db reset`. Aqui se
  -- inserta una derivacion sin eventos y se ejecuta la misma sentencia de backfill.
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values (v_per_2, 'MEEL910315MSLGRN02', 'Backfill', 'Heredada', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por)
  values (v_fic_2, 'SEM-S2A2-0002', v_per_2, 'abierto', now(), v_uid_ts);

  insert into public.derivacion (
    id, ficha_id, area_origen_id, institucion_id, destino, motivo, estado, creado_por
  ) values (
    '94000000-0000-4000-a000-000000000301', v_fic_2,
    (select id from public.cat_area where clave = 'trabajo_social'),
    (select id from public.directorio_institucion order by id limit 1),
    'fiscalia', 'Derivacion heredada', 'en_proceso', v_uid_ts
  );

  insert into public.canalizacion_evento (
    derivacion_id, estado_anterior, estado_nuevo, nota, creado_por, creado_en
  )
  select d.id, null::public.estado_derivacion, d.estado,
         nullif(btrim(coalesce(d.motivo, '')), ''), d.creado_por, d.creado_en
  from public.derivacion d
  where d.id = '94000000-0000-4000-a000-000000000301'
    and not exists (select 1 from public.canalizacion_evento ce where ce.derivacion_id = d.id);
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

-- 1) Backfill (misma sentencia que la migracion 34) sobre una derivacion heredada
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select ok(
  exists (
    select 1
    from public.canalizacion_evento ce
    where ce.derivacion_id = '94000000-0000-4000-a000-000000000301'
      and ce.estado_anterior is null
      and ce.estado_nuevo = 'en_proceso'
      and ce.nota = 'Derivacion heredada'
  ),
  'backfill creo evento inicial (estado_anterior = null) para canalizaciones existentes'
);

-- 2) crear_canalizacion() genera evento inicial automáticamente
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
insert into pg_temp.ids_a02
select 'ts_psic', derivacion_id
from public.crear_canalizacion(
  '94000000-0000-4000-a000-000000000201',
  'psicologia',
  (select id from public.cat_area where clave = 'psicologia'),
  null,
  null,
  'Canalizacion inicial TS->Psic'
);

select is(
  (
    select count(*)::int
    from public.canalizacion_evento ce
    where ce.derivacion_id = (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic')
      and ce.estado_anterior is null
      and ce.estado_nuevo = 'pendiente'
  ),
  1,
  'crear_canalizacion inserta automaticamente el primer evento pendiente'
);

-- 3) Transicion pendiente -> en_proceso sin nota permitida
select is(
  (
    select estado
    from public.cambiar_estado_derivacion(
      (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic'),
      'en_proceso'
    )
  ),
  'en_proceso'::public.estado_derivacion,
  'cambiar_estado_derivacion avanza pendiente -> en_proceso sin nota'
);

-- 4-5) Concluir o cancelar sin nota -> 23514
select throws_ok(
  $$select * from public.cambiar_estado_derivacion((select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic'), 'concluida', null)$$,
  '23514', null, 'concluir canalizacion sin nota lanza 23514'
);

select throws_ok(
  $$select * from public.cambiar_estado_derivacion((select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic'), 'cancelada', '   ')$$,
  '23514', null, 'cancelar canalizacion con nota vacia lanza 23514'
);

-- 6-7) Psicologia concluye TS->Psic con nota y quedan 3 eventos
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (
    select estado
    from public.cambiar_estado_derivacion(
      (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic'),
      'concluida',
      'Seguimiento concluido S2'
    )
  ),
  'concluida'::public.estado_derivacion,
  'psicologia concluye su canalizacion con nota obligatoria'
);

select is(
  (
    select count(*)::int
    from public.canalizacion_evento ce
    where ce.derivacion_id = (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic')
  ),
  3,
  'TS->Psic acumula exactamente 3 eventos (inicial, en_proceso, concluida)'
);

-- 8) TS crea TS->Juridico y la avanza con nota
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
insert into pg_temp.ids_a02
select 'ts_jur', derivacion_id
from public.crear_canalizacion(
  '94000000-0000-4000-a000-000000000201',
  'juridico',
  (select id from public.cat_area where clave = 'juridico'),
  null,
  null,
  'Canalizacion inicial TS->Jur'
);

select is(
  (
    select estado
    from public.cambiar_estado_derivacion(
      (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_jur'),
      'en_proceso',
      'Turnado a juridico S2'
    )
  ),
  'en_proceso'::public.estado_derivacion,
  'TS avanza TS->Juridico con nota'
);

-- 9-15) get_historial_canalizaciones(p_ficha_id): RBAC + ABAC
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  (select count(*)::int from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000201')),
  2,
  'titular ve las 2 canalizaciones del expediente'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (
    select jsonb_array_length(h.eventos)::int
    from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000201') h
    where h.id = (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic')
  ),
  3,
  'get_historial_canalizaciones incluye los 3 eventos en jsonb para trabajo_social'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select count(*)::int from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000201')),
  1,
  'psicologia solo ve historial de su canalizacion y no TS->Juridico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is(
  (select count(*)::int from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000201')),
  1,
  'juridico solo ve historial de TS->Juridico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'recepcion recibe 42501 en get_historial_canalizaciones'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'umeca recibe 42501 en get_historial_canalizaciones'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select throws_ok(
  $$select * from public.get_historial_canalizaciones('94000000-0000-4000-a000-000000000999')$$,
  '23514', null, 'get_historial_canalizaciones rechaza expediente inexistente con 23514'
);

-- 16-17) get_linea_tiempo() expone canalizacion_evento con detalle por rol/área
select ok(
  exists (
    select 1 from public.get_linea_tiempo('94000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'canalizacion_evento' and lt.detalle = 'Seguimiento concluido S2'
  )
  and exists (
    select 1 from public.get_linea_tiempo('94000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'canalizacion_evento' and lt.detalle = 'Turnado a juridico S2'
  ),
  'get_linea_tiempo muestra eventos de cambio de estado con nota a Direccion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select ok(
  exists (
    select 1 from public.get_linea_tiempo('94000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'canalizacion_evento' and lt.detalle = 'Seguimiento concluido S2'
  )
  and exists (
    select 1 from public.get_linea_tiempo('94000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'canalizacion_evento' and lt.titulo like '%pendiente → en_proceso' and lt.detalle is null
  ),
  'get_linea_tiempo oculta nota de TS->Juridico a Psicologia'
);

-- 18-21) canalizacion_evento RLS y append-only (sin INSERT/UPDATE/DELETE directos)
select is(
  (
    select count(*)::int
    from public.canalizacion_evento ce
    where ce.derivacion_id in (select derivacion_id from pg_temp.ids_a02)
  ),
  3,
  'RLS canalizacion_evento solo expone a Psicologia los 3 eventos de TS->Psic'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$insert into public.canalizacion_evento (derivacion_id, estado_nuevo) values ((select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic'), 'en_proceso')$$,
  '42501', null, 'INSERT directo en canalizacion_evento falla con 42501'
);

select throws_ok(
  $$update public.canalizacion_evento set nota = 'Alterada' where derivacion_id = (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic')$$,
  '42501', null, 'UPDATE directo en canalizacion_evento falla con 42501'
);

select throws_ok(
  $$delete from public.canalizacion_evento where derivacion_id = (select derivacion_id from pg_temp.ids_a02 where clave = 'ts_psic')$$,
  '42501', null, 'DELETE directo en canalizacion_evento falla con 42501'
);

reset role;

select * from finish();
rollback;
