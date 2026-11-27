-- =====================================================================
-- 32_permisos_sprint02.test.sql (P-02 · Sprint 02)
-- Verifica en pgTAP las 3 claves nuevas de public.tiene_permiso() para
-- los 6 roles de empleado, sin sesión, empleado inactivo, UMECA y usuaria
-- móvil, además de clave desconocida.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(34);

-- Empleados inactivos temporales para comprobar activo = false -> false
-- (titular para expediente.reabrir y trabajo_social para canalizacion.crear)
do $$
declare
  v_uid_inactivo    uuid := '11111111-1111-4111-8111-111111111199';
  v_uid_ts_inactivo uuid := '11111111-1111-4111-8111-111111111198';
  v_area_ts         smallint;
begin
  select id into v_area_ts from public.cat_area where clave = 'trabajo_social';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (
      v_uid_inactivo, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'inactivo.p02@demo.violetcode.local',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    ),
    (
      v_uid_ts_inactivo, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'ts.inactiva.p02@demo.violetcode.local',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    )
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo)
  values (v_uid_inactivo, 'Empleada Inactiva P02', 'titular', null, false)
  on conflict (id) do update set activo = false, rol = 'titular', area_id = null;

  insert into public.empleado (id, nombre, rol, area_id, activo)
  values (v_uid_ts_inactivo, 'TS Inactiva P02', 'trabajo_social', v_area_ts, false)
  on conflict (id) do update set activo = false, rol = 'trabajo_social', area_id = v_area_ts;
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

-- 1) Sin sesión
select pg_temp.set_actor(null);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'sin sesion: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'sin sesion: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), false, 'sin sesion: seguimiento.corregir = false');

-- 2) Empleado inactivo (titular)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111199'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'inactivo: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'inactivo: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), false, 'inactivo: seguimiento.corregir = false');

-- 2b) Trabajo Social inactiva (verifica que no pueda canalizar ni corregir)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111198'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'ts inactiva: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'ts inactiva: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), false, 'ts inactiva: seguimiento.corregir = false');

-- 3) UMECA (usuario_externo)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'umeca: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'umeca: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), false, 'umeca: seguimiento.corregir = false');

-- 4) Usuaria app móvil
select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'usuaria app: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'usuaria app: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), false, 'usuaria app: seguimiento.corregir = false');

-- 5) Titular
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'titular: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   true,  'titular: expediente.reabrir = true');
select is(public.tiene_permiso('seguimiento.corregir'), true,  'titular: seguimiento.corregir = true');

-- 6) Subdirección
select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'subdireccion: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   true,  'subdireccion: expediente.reabrir = true');
select is(public.tiene_permiso('seguimiento.corregir'), true,  'subdireccion: seguimiento.corregir = true');

-- 7) Trabajo Social
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   true,  'trabajo_social: canalizacion.crear = true');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'trabajo_social: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), true,  'trabajo_social: seguimiento.corregir = true');

-- 8) Psicología
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'psicologia: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'psicologia: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), true,  'psicologia: seguimiento.corregir = true');

-- 9) Jurídico
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'juridico: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'juridico: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), true,  'juridico: seguimiento.corregir = true');

-- 10) Recepción
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid);
select is(public.tiene_permiso('canalizacion.crear'),   false, 'recepcion: canalizacion.crear = false');
select is(public.tiene_permiso('expediente.reabrir'),   false, 'recepcion: expediente.reabrir = false');
select is(public.tiene_permiso('seguimiento.corregir'), false, 'recepcion: seguimiento.corregir = false');

-- 11) Clave inexistente
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid);
select is(public.tiene_permiso('permiso.inexistente.p02'), false, 'clave inexistente devuelve false');

select * from finish();
rollback;
