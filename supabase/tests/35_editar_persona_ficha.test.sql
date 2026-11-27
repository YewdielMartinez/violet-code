-- =====================================================================
-- 35_editar_persona_ficha.test.sql (A-03 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000400_35_rpc_editar_persona_y_ficha.sql:
--   - Permisos RBAC ('expediente.escribir'): psicologia, juridico,
--     recepcion, umeca y sin sesión reciben 42501.
--   - Expediente archivado rechaza edición con 23514 en ambas RPCs.
--   - Bloqueo optimista (p_actualizado_en obsoleto) lanza 23505.
--   - actualizar_persona: null conserva, '' limpia opcionales, celular
--     inválido y obligatorio vacío dan 23514, CURP no cambia, bitácora.
--   - actualizar_ficha: actualización, limpieza de drogas, servicios
--     solicitados >= 1, folio/estado intactos, trigger de bitácora en
--     ficha_servicio_solicitado (crear / desactivar con ficha:area).
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(29);

create temp table pg_temp.res_a03_per (
  id                 uuid,
  curp               text,
  nombres            text,
  apellido_paterno   text,
  apellido_materno   text,
  sexo               text,
  fecha_nacimiento   date,
  entidad_nacimiento text,
  celular            text,
  escolaridad        public.escolaridad_nivel,
  discapacidad       text,
  grupo_etnico       text,
  religion           text,
  actualizado_en     timestamptz
) on commit drop;
grant select, insert on pg_temp.res_a03_per to authenticated;

create temp table pg_temp.res_a03_fic (
  id                             uuid,
  folio                          text,
  persona_id                     uuid,
  estado                         public.estado_ficha,
  estado_civil                   public.estado_civil,
  ocupacion_id                   smallint,
  ocupacion_otra                 text,
  tiene_trabajo                  boolean,
  numero_hijas                   smallint,
  numero_hijos_hombres           smallint,
  servicio_medico                public.servicio_medico,
  servicio_medico_otro           text,
  tiene_embarazo                 boolean,
  tiene_denuncia                 boolean,
  es_victima_delito              boolean,
  drogas                         public.tipo_droga[],
  especificacion_droga           text,
  consumo_alcohol                public.consumo_alcohol,
  servicios_solicitados_area_ids smallint[],
  actualizado_en                 timestamptz
) on commit drop;
grant select, insert on pg_temp.res_a03_fic to authenticated;

do $$
declare
  v_uid_ts     uuid := '11111111-1111-4111-8111-111111111103';
  v_per_act    uuid := '95000000-0000-4000-a000-000000000101';
  v_per_arch   uuid := '95000000-0000-4000-a000-000000000102';
  v_fic_act    uuid := '95000000-0000-4000-a000-000000000201';
  v_fic_arch   uuid := '95000000-0000-4000-a000-000000000202';
  v_area_ts    smallint;
  v_area_psic  smallint;
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';

  insert into public.persona (
    id, curp, nombres, apellido_paterno, apellido_materno,
    celular, escolaridad, discapacidad, religion, creado_por
  ) values
    (v_per_act,  'GORL920415MSLGRN01', 'Lucia',  'Gomez', 'Ruiz',  '6681009501', 'preparatoria', 'Ninguna', 'Catolica', v_uid_ts),
    (v_per_arch, 'VESM890620MSLRRN02', 'Martha', 'Vega',  'Silva', '6681009502', 'secundaria',   'Ninguna', 'Catolica', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en,
    estado_civil, tiene_trabajo, drogas, especificacion_droga, creado_por
  ) values
    (
      v_fic_act, 'SEM-S2A3-0001', v_per_act, 'abierto', now(),
      'casado', true, array['marihuana']::public.tipo_droga[], 'Ocasional', v_uid_ts
    ),
    (
      v_fic_arch, 'SEM-S2A3-0002', v_per_arch, 'archivado', now(),
      'soltero', false, null, null, v_uid_ts
    );

  insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por) values
    (v_fic_act,  v_area_ts,   v_uid_ts),
    (v_fic_act,  v_area_psic, v_uid_ts),
    (v_fic_arch, v_area_ts,   v_uid_ts);
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

-- 1-5) actualizar_persona: rechazos 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', (select actualizado_en from public.persona where id = '95000000-0000-4000-a000-000000000101'), 'Otro')$$,
  '42501', null, 'psicologia recibe 42501 en actualizar_persona'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', now(), 'Otro')$$,
  '42501', null, 'juridico recibe 42501 en actualizar_persona'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', now(), 'Otro')$$,
  '42501', null, 'recepcion recibe 42501 en actualizar_persona'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', now(), 'Otro')$$,
  '42501', null, 'umeca recibe 42501 en actualizar_persona'
);

select pg_temp.set_actor(null); -- sin sesion
select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', now(), 'Otro')$$,
  '42501', null, 'sin sesion recibe 42501 en actualizar_persona'
);

-- 6-10) actualizar_ficha: rechazos 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', now(), 'soltero')$$,
  '42501', null, 'psicologia recibe 42501 en actualizar_ficha'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', now(), 'soltero')$$,
  '42501', null, 'juridico recibe 42501 en actualizar_ficha'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', now(), 'soltero')$$,
  '42501', null, 'recepcion recibe 42501 en actualizar_ficha'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', now(), 'soltero')$$,
  '42501', null, 'umeca recibe 42501 en actualizar_ficha'
);

select pg_temp.set_actor(null); -- sin sesion
select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', now(), 'soltero')$$,
  '42501', null, 'sin sesion recibe 42501 en actualizar_ficha'
);

-- 11-14) Expediente archivado (23514) y bloqueo optimista (23505) como TS
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000102', (select actualizado_en from public.persona where id = '95000000-0000-4000-a000-000000000102'), 'Martha Nueva')$$,
  '23514', 'Reabre el expediente para editarlo', 'actualizar_persona rechaza expediente archivado con 23514'
);

select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000202', (select actualizado_en from public.ficha_registro where id = '95000000-0000-4000-a000-000000000202'), 'casado')$$,
  '23514', 'Reabre el expediente para editarlo', 'actualizar_ficha rechaza expediente archivado con 23514'
);

select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', now() - interval '1 hour', 'Lucia')$$,
  '23505', 'Este registro fue modificado por otra persona. Recarga los datos.', 'actualizar_persona con actualizado_en viejo lanza 23505'
);

select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', now() - interval '1 hour', 'casado')$$,
  '23505', 'Este registro fue modificado por otra persona. Recarga los datos.', 'actualizar_ficha con actualizado_en viejo lanza 23505'
);

-- 15-21) actualizar_persona: validaciones y camino feliz
select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', (select actualizado_en from public.persona where id = '95000000-0000-4000-a000-000000000101'), null, null, null, '12345')$$,
  '23514', null, 'actualizar_persona rechaza celular distinto de 10 digitos'
);

select throws_ok(
  $$select * from public.actualizar_persona('95000000-0000-4000-a000-000000000101', (select actualizado_en from public.persona where id = '95000000-0000-4000-a000-000000000101'), '   ')$$,
  '23514', null, 'actualizar_persona rechaza p_nombres vacio'
);

insert into pg_temp.res_a03_per
select *
from public.actualizar_persona(
  '95000000-0000-4000-a000-000000000101',
  (select actualizado_en from public.persona where id = '95000000-0000-4000-a000-000000000101'),
  'Lucia Fernanda',
  null,
  null,
  '6689998877',
  null,
  null,
  null,
  ''
);

select is(
  (select nombres from pg_temp.res_a03_per),
  'Lucia Fernanda',
  'actualizar_persona actualiza nombres'
);

select is(
  (select apellido_paterno || '|' || coalesce(religion, '<null>') from pg_temp.res_a03_per),
  'Gomez|<null>',
  'actualizar_persona conserva campo con null y borra opcional con cadena vacia'
);

select is(
  (select curp from public.persona where id = '95000000-0000-4000-a000-000000000101'),
  'GORL920415MSLGRN01',
  'actualizar_persona nunca cambia la CURP'
);

select ok(
  (select actualizado_en >= now() - interval '1 minute' from pg_temp.res_a03_per),
  'actualizar_persona devuelve el actualizado_en actualizado'
);

-- Verificar bitacora en persona (como postgres temporalmente para consultar bitacora_acceso)
reset role;
select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'persona'
      and b.registro_id = '95000000-0000-4000-a000-000000000101'
      and b.accion = 'actualizar'
  ),
  1,
  'actualizar_persona deja registro actualizar en bitacora_acceso'
);
set local role authenticated;

-- 22-29) actualizar_ficha: validaciones, servicios solicitados y bitácora
select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', (select actualizado_en from public.ficha_registro where id = '95000000-0000-4000-a000-000000000201'), null, null, null, null, null, null, null, null, null, null, null, null, null, null, array[9999]::smallint[])$$,
  '23514', null, 'actualizar_ficha rechaza area inexistente en servicios solicitados'
);

select throws_ok(
  $$select * from public.actualizar_ficha('95000000-0000-4000-a000-000000000201', (select actualizado_en from public.ficha_registro where id = '95000000-0000-4000-a000-000000000201'), null, null, null, null, null, null, null, null, null, null, null, array['no_consume', 'marihuana']::public.tipo_droga[])$$,
  '23514', null, 'actualizar_ficha rechaza no_consume combinado con otra droga'
);

insert into pg_temp.res_a03_fic
select *
from public.actualizar_ficha(
  '95000000-0000-4000-a000-000000000201',
  (select actualizado_en from public.ficha_registro where id = '95000000-0000-4000-a000-000000000201'),
  'divorciado'::public.estado_civil,
  null,
  null,
  false,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  array['no_consume']::public.tipo_droga[],
  null,
  'no_consume'::public.consumo_alcohol,
  array[
    (select id from public.cat_area where clave = 'trabajo_social'),
    (select id from public.cat_area where clave = 'juridico')
  ]::smallint[]
);

select is(
  (select estado_civil::text || '|' || coalesce(especificacion_droga, '<null>') from pg_temp.res_a03_fic),
  'divorciado|<null>',
  'actualizar_ficha edita estado_civil y limpia drogas al desactivar consumo'
);

select is(
  (select servicios_solicitados_area_ids from pg_temp.res_a03_fic),
  array[
    (select id from public.cat_area where clave = 'trabajo_social'),
    (select id from public.cat_area where clave = 'juridico')
  ]::smallint[],
  'actualizar_ficha sincroniza ficha_servicio_solicitado (TS y Jur)'
);

select is(
  (select folio || '|' || estado::text from pg_temp.res_a03_fic),
  'SEM-S2A3-0001|abierto',
  'actualizar_ficha conserva folio y estado del expediente'
);

reset role;

select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'ficha_registro'
      and b.registro_id = '95000000-0000-4000-a000-000000000201'
      and b.accion = 'actualizar'
  ),
  1,
  'actualizar_ficha deja registro actualizar en bitacora_acceso'
);

select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'ficha_servicio_solicitado'
      and b.accion = 'desactivar'
      and b.registro_id = '95000000-0000-4000-a000-000000000201:' || (select id from public.cat_area where clave = 'psicologia')::text
  ),
  1,
  'quitar servicio solicitado registra desactivar en bitacora_acceso'
);

select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'ficha_servicio_solicitado'
      and b.accion = 'crear'
      and b.registro_id = '95000000-0000-4000-a000-000000000201:' || (select id from public.cat_area where clave = 'juridico')::text
  ),
  1,
  'agregar servicio solicitado registra crear en bitacora_acceso'
);

select * from finish();
rollback;
