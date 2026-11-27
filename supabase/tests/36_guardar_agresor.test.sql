-- =====================================================================
-- 36_guardar_agresor.test.sql (A-04 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000500_36_rpc_guardar_agresor.sql:
--   - Permisos ('agresor.acceder'): recepcion, umeca, app y sin sesión
--     reciben 42501 en guardar_agresor y desactivar_agresor.
--   - Validaciones 23514: ficha archivada, parentesco_otro sin 'otro',
--     drogas sin consumo, asentamiento_id + codigo_postal juntos.
--   - Alta con guardar_agresor(null), bloqueo optimista (23505) y edición
--     con auditoría en bitacora_acceso.
--   - desactivar_agresor bloquea si hay orden vigente ligada (23514) y
--     desactiva cuando no existe orden vigente.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(18);

create temp table pg_temp.res_a04 (
  id                    uuid,
  ficha_id              uuid,
  nombres               text,
  apellido_paterno      text,
  apellido_materno      text,
  edad                  smallint,
  fecha_nacimiento      date,
  entidad_nacimiento    text,
  sexo                  public.sexo_biologico,
  estado_civil          public.estado_civil,
  curp                  text,
  parentesco_id         smallint,
  parentesco_otro       text,
  asentamiento_id       integer,
  codigo_postal         text,
  calle                 text,
  numero_exterior       text,
  numero_interior       text,
  referencias           text,
  zona                  public.zona_geografica,
  ocupacion_id          smallint,
  ocupacion_otra        text,
  tipo_trabajo          public.tipo_trabajo,
  drogas               public.tipo_droga[],
  especificacion_droga text,
  consumo_alcohol      public.consumo_alcohol,
  especificacion_arma   text,
  observaciones         text,
  activo                boolean,
  actualizado_en        timestamptz
) on commit drop;
grant select, insert, update on pg_temp.res_a04 to authenticated;

do $$
declare
  v_uid_ts   uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_jur  uuid := '11111111-1111-4111-8111-111111111105';
  v_per_act  uuid := '96000000-0000-4000-a000-000000000101';
  v_per_arch uuid := '96000000-0000-4000-a000-000000000102';
  v_fic_act  uuid := '96000000-0000-4000-a000-000000000201';
  v_fic_arch uuid := '96000000-0000-4000-a000-000000000202';
  v_agr_ord  uuid := '96000000-0000-4000-a000-000000000301';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_act,  'SAEL920415MSLGRN01', 'Elena', 'Salazar', v_uid_ts),
    (v_per_arch, 'CARO880620MSLRRN02', 'Rosa',  'Campos',  v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_act,  'SEM-S2A4-0001', v_per_act,  'abierto',   now(), v_uid_ts),
    (v_fic_arch, 'SEM-S2A4-0002', v_per_arch, 'archivado', now(), v_uid_ts);

  insert into public.agresor (id, ficha_id, nombres, creado_por) values
    (v_agr_ord, v_fic_act, 'Agresor Con Orden', v_uid_ts);

  insert into public.orden_proteccion (ficha_id, agresor_id, fecha_emision, fecha_vigencia, estado, creado_por) values
    (v_fic_act, v_agr_ord, current_date, current_date + 30, 'vigente', v_uid_jur);
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

-- 1-6) Permisos 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos')$$,
  '42501', null, 'recepcion recibe 42501 en guardar_agresor'
);
select throws_ok(
  $$select * from public.desactivar_agresor('96000000-0000-4000-a000-000000000301')$$,
  '42501', null, 'recepcion recibe 42501 en desactivar_agresor'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos')$$,
  '42501', null, 'umeca recibe 42501 en guardar_agresor'
);

select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'::uuid); -- usuaria app
select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos')$$,
  '42501', null, 'usuaria app recibe 42501 en guardar_agresor'
);

select pg_temp.set_actor(null); -- sin sesion
select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos')$$,
  '42501', null, 'sin sesion recibe 42501 en guardar_agresor'
);
select throws_ok(
  $$select * from public.desactivar_agresor('96000000-0000-4000-a000-000000000301')$$,
  '42501', null, 'sin sesion recibe 42501 en desactivar_agresor'
);

-- 7-10) Validaciones 23514 como Psicologia
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid);

select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000202', null, 'Carlos')$$,
  '23514', 'Reabre el expediente para editarlo', 'guardar_agresor rechaza expediente archivado con 23514'
);

select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos', null, null, null, null, null, null, null, null, (select id from public.cat_parentesco where clave = 'pareja'), 'Vecino')$$,
  '23514', null, 'guardar_agresor rechaza parentesco_otro sin parentesco otro'
);

select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, array['no_consume', 'marihuana']::public.tipo_droga[])$$,
  '23514', null, 'guardar_agresor rechaza no_consume combinado con otra droga'
);

select throws_ok(
  $$select * from public.guardar_agresor(null, '96000000-0000-4000-a000-000000000201', null, 'Carlos', null, null, null, null, null, null, null, null, null, null, (select id from public.cat_asentamiento limit 1), '81200')$$,
  '23514', null, 'guardar_agresor rechaza asentamiento_id y codigo_postal juntos'
);

-- 11-15) Alta, bloqueo optimista 23505 y edición como Jurídico
insert into pg_temp.res_a04
select *
from public.guardar_agresor(
  null,
  '96000000-0000-4000-a000-000000000201',
  null,
  'Carlos',
  'Mendez',
  null,
  34::smallint,
  null,
  null,
  'H'::public.sexo_biologico,
  null,
  null,
  (select id from public.cat_parentesco where clave = 'otro'),
  'Vecino cercano',
  null,
  '81200',
  null, null, null, null, null, null, null, null,
  array['marihuana']::public.tipo_droga[],
  'Consumo frecuente',
  'ocasional'::public.consumo_alcohol,
  'Ninguna',
  'Registro inicial'
);

select is(
  (select nombres || '|' || parentesco_otro from pg_temp.res_a04),
  'Carlos|Vecino cercano',
  'guardar_agresor(null) crea agresor correctamente'
);

reset role;
select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'agresor'
      and b.registro_id = (select id::text from pg_temp.res_a04)
      and b.accion = 'crear'
  ),
  1,
  'alta con guardar_agresor deja accion crear en bitacora_acceso'
);
set local role authenticated;

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.guardar_agresor((select id from pg_temp.res_a04), null, now() - interval '1 hour', 'Carlos Editado')$$,
  '23505', 'Este registro fue modificado por otra persona. Recarga los datos.',
  'guardar_agresor con actualizado_en viejo lanza 23505'
);

with upd as (
  select *
  from public.guardar_agresor(
    (select id from pg_temp.res_a04),
    null,
    (select actualizado_en from pg_temp.res_a04),
    'Carlos Alberto',
    null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null,
    array['no_consume']::public.tipo_droga[],
    null,
    'no_consume'::public.consumo_alcohol,
    null,
    'Editado por Juridico'
  )
)
select is(
  (select nombres || '|' || coalesce(especificacion_droga, '<null>') || '|' || observaciones from upd),
  'Carlos Alberto|<null>|Editado por Juridico',
  'guardar_agresor edita con bloqueo optimista y limpia drogas al desactivar consumo'
);

reset role;
select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'agresor'
      and b.registro_id = (select id::text from pg_temp.res_a04)
      and b.accion = 'actualizar'
  ),
  1,
  'edicion con guardar_agresor deja accion actualizar en bitacora_acceso'
);
set local role authenticated;

-- 16-18) desactivar_agresor: orden vigente (23514) vs sin orden (activo = false)
select throws_ok(
  $$select * from public.desactivar_agresor('96000000-0000-4000-a000-000000000301', 'Baja indebida')$$,
  '23514', null, 'desactivar_agresor rechaza agresor con orden de proteccion vigente (23514)'
);

select is(
  (select activo from public.desactivar_agresor((select id from pg_temp.res_a04), 'Ya no aplica')),
  false,
  'desactivar_agresor marca activo = false cuando no hay orden vigente'
);

reset role;
select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'agresor'
      and b.registro_id = (select id::text from pg_temp.res_a04)
      and b.accion = 'desactivar'
  ),
  1,
  'desactivar_agresor deja accion desactivar en bitacora_acceso'
);

select * from finish();
rollback;
