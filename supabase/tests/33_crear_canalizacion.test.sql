-- =====================================================================
-- 33_crear_canalizacion.test.sql (A-01 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000200_33_rpc_crear_canalizacion.sql:
--   - Solo Trabajo Social activo puede crear canalizaciones (canalizacion.crear).
--   - Dirección, Psicología, Jurídico, Recepción, UMECA, app, TS inactiva y
--     sin sesión reciben 42501.
--   - area_origen_id siempre proviene de auth_area_id() (Trabajo Social).
--   - Validaciones 23514: ficha inexistente/archivada, destino interno sin
--     área, área no coincidente, destino externo con área, otra_institucion
--     sin institución, RN-01 menor de 18 años hacia Psicología.
--   - RN-03: persona hombre hacia destino no jurídico devuelve aviso sin bloquear.
--   - Política derivacion_insert cerrada (with check (false)): insert directo falla.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(26);

create temp table pg_temp.res_a01 (
  caso          text,
  derivacion_id uuid,
  estado        public.estado_derivacion,
  aviso         text
) on commit drop;
grant select, insert on pg_temp.res_a01 to authenticated;

do $$
declare
  v_area_ts      smallint;
  v_uid_ts       uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_ts_inact uuid := '93000000-0000-4000-a000-000000000099';
  v_per_mujer    uuid := '93000000-0000-4000-a000-000000000101';
  v_per_hombre   uuid := '93000000-0000-4000-a000-000000000102';
  v_per_menor    uuid := '93000000-0000-4000-a000-000000000103';
  v_per_arch     uuid := '93000000-0000-4000-a000-000000000104';
  v_fic_mujer    uuid := '93000000-0000-4000-a000-000000000201';
  v_fic_hombre   uuid := '93000000-0000-4000-a000-000000000202';
  v_fic_menor    uuid := '93000000-0000-4000-a000-000000000203';
  v_fic_arch     uuid := '93000000-0000-4000-a000-000000000204';
begin
  select id into v_area_ts from public.cat_area where clave = 'trabajo_social';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_uid_ts_inact, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'ts.inact.a01s2@demo.violetcode.local',
    extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo)
  values (v_uid_ts_inact, 'TS Inactiva S2', 'trabajo_social', v_area_ts, false)
  on conflict (id) do update set activo = false, rol = 'trabajo_social', area_id = v_area_ts;

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_mujer,  'MEEN910315MSLGRN01', 'Elena',  'Mendoza', v_uid_ts),
    (v_per_hombre, 'PAMA900412HSLMNR02', 'Marco',  'Paredes', v_uid_ts),
    (v_per_menor,  'MEDA150512MSLRRRA3', 'Dafne',  'Menor',   v_uid_ts),
    (v_per_arch,   'AESO880220MSLRRN04', 'Sonia',  'Arch',    v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_mujer,  'SEM-S2A1-0001', v_per_mujer,  'abierto',   now(), v_uid_ts),
    (v_fic_hombre, 'SEM-S2A1-0002', v_per_hombre, 'abierto',   now(), v_uid_ts),
    (v_fic_menor,  'SEM-S2A1-0003', v_per_menor,  'abierto',   now(), v_uid_ts),
    (v_fic_arch,   'SEM-S2A1-0004', v_per_arch,   'archivado', now(), v_uid_ts);
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

-- 1-9) Rechazos 42501 para todos los actores distintos de TS activo
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'psicologia', (select id from public.cat_area where clave = 'psicologia'))$$,
  '42501', null, 'titular recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid); -- subdireccion
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'psicologia', (select id from public.cat_area where clave = 'psicologia'))$$,
  '42501', null, 'subdireccion recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'juridico', (select id from public.cat_area where clave = 'juridico'))$$,
  '42501', null, 'psicologia recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'psicologia', (select id from public.cat_area where clave = 'psicologia'))$$,
  '42501', null, 'juridico recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'psicologia', (select id from public.cat_area where clave = 'psicologia'))$$,
  '42501', null, 'recepcion recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'otra_institucion', null, null, 'DIF')$$,
  '42501', null, 'umeca recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'::uuid); -- usuaria app
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'otra_institucion', null, null, 'DIF')$$,
  '42501', null, 'usuaria app recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor('93000000-0000-4000-a000-000000000099'::uuid); -- ts inactiva
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'otra_institucion', null, null, 'DIF')$$,
  '42501', null, 'trabajo_social inactiva recibe 42501 al crear canalizacion'
);

select pg_temp.set_actor(null); -- sin sesion
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'otra_institucion', null, null, 'DIF')$$,
  '42501', null, 'sin sesion recibe 42501 al crear canalizacion'
);

-- 10-16) Trabajo Social activo: caminos felices + area_origen_id + RN-03
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid);

insert into pg_temp.res_a01
select 'interna_mujer', derivacion_id, estado, aviso
from public.crear_canalizacion(
  '93000000-0000-4000-a000-000000000201',
  'psicologia',
  (select id from public.cat_area where clave = 'psicologia'),
  null,
  null,
  'Valoracion psicologica inicial'
);

select is(
  (select estado from pg_temp.res_a01 where caso = 'interna_mujer'),
  'pendiente'::public.estado_derivacion,
  'TS crea canalizacion interna en estado pendiente'
);

select is(
  (select aviso from pg_temp.res_a01 where caso = 'interna_mujer'),
  null,
  'canalizacion interna de mujer no genera aviso RN-03'
);

select is(
  (
    select d.area_origen_id
    from public.derivacion d
    join pg_temp.res_a01 r on r.derivacion_id = d.id
    where r.caso = 'interna_mujer'
  ),
  (select id from public.cat_area where clave = 'trabajo_social'),
  'area_origen_id siempre proviene de trabajo_social'
);

insert into pg_temp.res_a01
select 'externa_otra', derivacion_id, estado, aviso
from public.crear_canalizacion(
  '93000000-0000-4000-a000-000000000201',
  'otra_institucion',
  null,
  null,
  'DIF Ahome',
  'Apoyo asistencial'
);

select is(
  (select estado from pg_temp.res_a01 where caso = 'externa_otra'),
  'pendiente'::public.estado_derivacion,
  'TS crea canalizacion externa a otra_institucion'
);

select is(
  (
    select d.area_origen_id
    from public.derivacion d
    join pg_temp.res_a01 r on r.derivacion_id = d.id
    where r.caso = 'externa_otra'
  ),
  (select id from public.cat_area where clave = 'trabajo_social'),
  'canalizacion externa registra area_origen_id de trabajo_social'
);

insert into pg_temp.res_a01
select 'rn03_hombre_psic', derivacion_id, estado, aviso
from public.crear_canalizacion(
  '93000000-0000-4000-a000-000000000202',
  'psicologia',
  (select id from public.cat_area where clave = 'psicologia'),
  null,
  null,
  'Caso hombre RN-03'
);

select ok(
  (select aviso is not null from pg_temp.res_a01 where caso = 'rn03_hombre_psic'),
  'RN-03: hombre canalizado a psicologia devuelve aviso sin bloquear'
);

insert into pg_temp.res_a01
select 'rn03_hombre_jur', derivacion_id, estado, aviso
from public.crear_canalizacion(
  '93000000-0000-4000-a000-000000000202',
  'juridico',
  (select id from public.cat_area where clave = 'juridico'),
  null,
  null,
  'Asesoria juridica'
);

select is(
  (select aviso from pg_temp.res_a01 where caso = 'rn03_hombre_jur'),
  null,
  'RN-03: hombre canalizado a juridico no genera aviso'
);

-- 17-24) Validaciones 23514
select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000999', 'otra_institucion', null, null, 'DIF')$$,
  '23514', null, 'expediente inexistente da 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000204', 'otra_institucion', null, null, 'DIF')$$,
  '23514', null, 'expediente archivado da 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'psicologia', null)$$,
  '23514', null, 'destino interno sin area_destino_id da 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'psicologia', (select id from public.cat_area where clave = 'juridico'))$$,
  '23514', null, 'area_destino_id distinto al destino da 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'fiscalia', (select id from public.cat_area where clave = 'juridico'))$$,
  '23514', null, 'destino externo con area_destino_id da 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'otra_institucion', null, null, null)$$,
  '23514', null, 'otra_institucion sin institucion da 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000201', 'fiscalia', null, (select id from public.directorio_institucion where activo limit 1), 'Otra Manual')$$,
  '23514', null, 'institucion_id y institucion_otra juntos dan 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('93000000-0000-4000-a000-000000000203', 'psicologia', (select id from public.cat_area where clave = 'psicologia'))$$,
  '23514', null, 'RN-01: menor de edad hacia psicologia da 23514'
);

-- 25-26) Insert directo en derivacion bloqueado por RLS
select throws_ok(
  $$insert into public.derivacion (ficha_id, destino, institucion_otra) values ('93000000-0000-4000-a000-000000000201', 'otra_institucion', 'Directo TS')$$,
  '42501', null, 'insert directo en derivacion falla para trabajo_social'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select throws_ok(
  $$insert into public.derivacion (ficha_id, destino, institucion_otra) values ('93000000-0000-4000-a000-000000000201', 'otra_institucion', 'Directo Dir')$$,
  '42501', null, 'insert directo en derivacion falla para titular'
);

reset role;

select * from finish();
rollback;
