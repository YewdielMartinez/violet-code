-- =====================================================================
-- 15_permisos.test.sql (P-01 · Sprint 01)
-- Verifica en pgTAP todas las claves (existentes y nuevas) de
-- public.tiene_permiso() para los 6 roles de empleado, sin sesión,
-- empleado inactivo y UMECA.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(181);

-- Sembrar un empleado inactivo temporal en auth.users + public.empleado
-- para validar que tiene_permiso() siempre devuelve false si activo = false.
do $$
declare
  v_uid_inactivo uuid := '11111111-1111-4111-8111-111111111199';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_uid_inactivo, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'inactivo.test@demo.violetcode.local',
    extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo)
  values (v_uid_inactivo, 'Empleada Inactiva Test', 'titular', null, false)
  on conflict (id) do update set activo = false, rol = 'titular';
end;
$$;

-- Helper local de prueba para simular sesión de un UUID
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
-- Desde la migración 31, las funciones nuevas no tienen EXECUTE para PUBLIC por defecto.
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1) Sin sesión (auth.uid() is null) -> las 20 claves en false
select pg_temp.set_actor(null);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'sin sesion: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'sin sesion: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'sin sesion: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'sin sesion: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        false, 'sin sesion: expediente.escribir = false');
select is(public.tiene_permiso('expediente.ver'),             false, 'sin sesion: expediente.ver = false');
select is(public.tiene_permiso('agresor.acceder'),            false, 'sin sesion: agresor.acceder = false');
select is(public.tiene_permiso('historial_clinico.acceder'),  false, 'sin sesion: historial_clinico.acceder = false');
select is(public.tiene_permiso('orden_proteccion.escribir'),  false, 'sin sesion: orden_proteccion.escribir = false');
select is(public.tiene_permiso('alerta.atender'),             false, 'sin sesion: alerta.atender = false');
select is(public.tiene_permiso('alerta.ver_cola'),            false, 'sin sesion: alerta.ver_cola = false');
select is(public.tiene_permiso('expediente.verificar_curp'),  false, 'sin sesion: expediente.verificar_curp = false');
select is(public.tiene_permiso('seguimiento.registrar'),      false, 'sin sesion: seguimiento.registrar = false');
select is(public.tiene_permiso('agenda.ver'),                 false, 'sin sesion: agenda.ver = false');
select is(public.tiene_permiso('agenda.gestionar'),           false, 'sin sesion: agenda.gestionar = false');
select is(public.tiene_permiso('urgencias.ver'),              false, 'sin sesion: urgencias.ver = false');
select is(public.tiene_permiso('derivacion.gestionar'),       false, 'sin sesion: derivacion.gestionar = false');
select is(public.tiene_permiso('actividad.ver'),              false, 'sin sesion: actividad.ver = false');
select is(public.tiene_permiso('actividad.registrar'),        false, 'sin sesion: actividad.registrar = false');
select is(public.tiene_permiso('informe.ver'),                false, 'sin sesion: informe.ver = false');

-- 2) Empleado inactivo -> las 20 claves en false
select pg_temp.set_actor('11111111-1111-4111-8111-111111111199'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'inactivo: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'inactivo: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'inactivo: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'inactivo: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        false, 'inactivo: expediente.escribir = false');
select is(public.tiene_permiso('expediente.ver'),             false, 'inactivo: expediente.ver = false');
select is(public.tiene_permiso('agresor.acceder'),            false, 'inactivo: agresor.acceder = false');
select is(public.tiene_permiso('historial_clinico.acceder'),  false, 'inactivo: historial_clinico.acceder = false');
select is(public.tiene_permiso('orden_proteccion.escribir'),  false, 'inactivo: orden_proteccion.escribir = false');
select is(public.tiene_permiso('alerta.atender'),             false, 'inactivo: alerta.atender = false');
select is(public.tiene_permiso('alerta.ver_cola'),            false, 'inactivo: alerta.ver_cola = false');
select is(public.tiene_permiso('expediente.verificar_curp'),  false, 'inactivo: expediente.verificar_curp = false');
select is(public.tiene_permiso('seguimiento.registrar'),      false, 'inactivo: seguimiento.registrar = false');
select is(public.tiene_permiso('agenda.ver'),                 false, 'inactivo: agenda.ver = false');
select is(public.tiene_permiso('agenda.gestionar'),           false, 'inactivo: agenda.gestionar = false');
select is(public.tiene_permiso('urgencias.ver'),              false, 'inactivo: urgencias.ver = false');
select is(public.tiene_permiso('derivacion.gestionar'),       false, 'inactivo: derivacion.gestionar = false');
select is(public.tiene_permiso('actividad.ver'),              false, 'inactivo: actividad.ver = false');
select is(public.tiene_permiso('actividad.registrar'),        false, 'inactivo: actividad.registrar = false');
select is(public.tiene_permiso('informe.ver'),                false, 'inactivo: informe.ver = false');

-- 3) UMECA (usuario_externo) -> las 20 claves en false
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'umeca: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'umeca: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'umeca: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'umeca: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        false, 'umeca: expediente.escribir = false');
select is(public.tiene_permiso('expediente.ver'),             false, 'umeca: expediente.ver = false');
select is(public.tiene_permiso('agresor.acceder'),            false, 'umeca: agresor.acceder = false');
select is(public.tiene_permiso('historial_clinico.acceder'),  false, 'umeca: historial_clinico.acceder = false');
select is(public.tiene_permiso('orden_proteccion.escribir'),  false, 'umeca: orden_proteccion.escribir = false');
select is(public.tiene_permiso('alerta.atender'),             false, 'umeca: alerta.atender = false');
select is(public.tiene_permiso('alerta.ver_cola'),            false, 'umeca: alerta.ver_cola = false');
select is(public.tiene_permiso('expediente.verificar_curp'),  false, 'umeca: expediente.verificar_curp = false');
select is(public.tiene_permiso('seguimiento.registrar'),      false, 'umeca: seguimiento.registrar = false');
select is(public.tiene_permiso('agenda.ver'),                 false, 'umeca: agenda.ver = false');
select is(public.tiene_permiso('agenda.gestionar'),           false, 'umeca: agenda.gestionar = false');
select is(public.tiene_permiso('urgencias.ver'),              false, 'umeca: urgencias.ver = false');
select is(public.tiene_permiso('derivacion.gestionar'),       false, 'umeca: derivacion.gestionar = false');
select is(public.tiene_permiso('actividad.ver'),              false, 'umeca: actividad.ver = false');
select is(public.tiene_permiso('actividad.registrar'),        false, 'umeca: actividad.registrar = false');
select is(public.tiene_permiso('informe.ver'),                false, 'umeca: informe.ver = false');

-- 4) Titular
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        true,  'titular: catalogos.gestionar = true');
select is(public.tiene_permiso('directorio.gestionar'),       true,  'titular: directorio.gestionar = true');
select is(public.tiene_permiso('cuentas.gestionar'),          true,  'titular: cuentas.gestionar = true');
select is(public.tiene_permiso('bitacora.ver'),               true,  'titular: bitacora.ver = true');
select is(public.tiene_permiso('expediente.escribir'),        true,  'titular: expediente.escribir = true');
select is(public.tiene_permiso('expediente.ver'),             true,  'titular: expediente.ver = true');
select is(public.tiene_permiso('agresor.acceder'),            true,  'titular: agresor.acceder = true');
select is(public.tiene_permiso('historial_clinico.acceder'),  true,  'titular: historial_clinico.acceder = true');
select is(public.tiene_permiso('orden_proteccion.escribir'),  true,  'titular: orden_proteccion.escribir = true');
select is(public.tiene_permiso('alerta.atender'),             true,  'titular: alerta.atender = true');
select is(public.tiene_permiso('alerta.ver_cola'),            true,  'titular: alerta.ver_cola = true');
select is(public.tiene_permiso('expediente.verificar_curp'),  true,  'titular: expediente.verificar_curp = true');
select is(public.tiene_permiso('seguimiento.registrar'),      false, 'titular: seguimiento.registrar = false');
select is(public.tiene_permiso('agenda.ver'),                 true,  'titular: agenda.ver = true');
select is(public.tiene_permiso('agenda.gestionar'),           true,  'titular: agenda.gestionar = true');
select is(public.tiene_permiso('urgencias.ver'),              true,  'titular: urgencias.ver = true');
select is(public.tiene_permiso('derivacion.gestionar'),       true,  'titular: derivacion.gestionar = true');
select is(public.tiene_permiso('actividad.ver'),              true,  'titular: actividad.ver = true');
select is(public.tiene_permiso('actividad.registrar'),        true,  'titular: actividad.registrar = true');
select is(public.tiene_permiso('informe.ver'),                true,  'titular: informe.ver = true');

-- 5) Subdirección
select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        true,  'subdireccion: catalogos.gestionar = true');
select is(public.tiene_permiso('directorio.gestionar'),       true,  'subdireccion: directorio.gestionar = true');
select is(public.tiene_permiso('cuentas.gestionar'),          true,  'subdireccion: cuentas.gestionar = true');
select is(public.tiene_permiso('bitacora.ver'),               true,  'subdireccion: bitacora.ver = true');
select is(public.tiene_permiso('expediente.escribir'),        true,  'subdireccion: expediente.escribir = true');
select is(public.tiene_permiso('expediente.ver'),             true,  'subdireccion: expediente.ver = true');
select is(public.tiene_permiso('agresor.acceder'),            true,  'subdireccion: agresor.acceder = true');
select is(public.tiene_permiso('historial_clinico.acceder'),  true,  'subdireccion: historial_clinico.acceder = true');
select is(public.tiene_permiso('orden_proteccion.escribir'),  true,  'subdireccion: orden_proteccion.escribir = true');
select is(public.tiene_permiso('alerta.atender'),             true,  'subdireccion: alerta.atender = true');
select is(public.tiene_permiso('alerta.ver_cola'),            true,  'subdireccion: alerta.ver_cola = true');
select is(public.tiene_permiso('expediente.verificar_curp'),  true,  'subdireccion: expediente.verificar_curp = true');
select is(public.tiene_permiso('seguimiento.registrar'),      false, 'subdireccion: seguimiento.registrar = false');
select is(public.tiene_permiso('agenda.ver'),                 true,  'subdireccion: agenda.ver = true');
select is(public.tiene_permiso('agenda.gestionar'),           true,  'subdireccion: agenda.gestionar = true');
select is(public.tiene_permiso('urgencias.ver'),              true,  'subdireccion: urgencias.ver = true');
select is(public.tiene_permiso('derivacion.gestionar'),       true,  'subdireccion: derivacion.gestionar = true');
select is(public.tiene_permiso('actividad.ver'),              true,  'subdireccion: actividad.ver = true');
select is(public.tiene_permiso('actividad.registrar'),        true,  'subdireccion: actividad.registrar = true');
select is(public.tiene_permiso('informe.ver'),                true,  'subdireccion: informe.ver = true');

-- 6) Trabajo Social
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'trabajo_social: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'trabajo_social: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'trabajo_social: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'trabajo_social: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        true,  'trabajo_social: expediente.escribir = true');
select is(public.tiene_permiso('expediente.ver'),             true,  'trabajo_social: expediente.ver = true');
select is(public.tiene_permiso('agresor.acceder'),            true,  'trabajo_social: agresor.acceder = true');
select is(public.tiene_permiso('historial_clinico.acceder'),  false, 'trabajo_social: historial_clinico.acceder = false');
select is(public.tiene_permiso('orden_proteccion.escribir'),  true,  'trabajo_social: orden_proteccion.escribir = true');
select is(public.tiene_permiso('alerta.atender'),             false, 'trabajo_social: alerta.atender = false');
select is(public.tiene_permiso('alerta.ver_cola'),            true,  'trabajo_social: alerta.ver_cola = true');
select is(public.tiene_permiso('expediente.verificar_curp'),  true,  'trabajo_social: expediente.verificar_curp = true');
select is(public.tiene_permiso('seguimiento.registrar'),      true,  'trabajo_social: seguimiento.registrar = true');
select is(public.tiene_permiso('agenda.ver'),                 true,  'trabajo_social: agenda.ver = true');
select is(public.tiene_permiso('agenda.gestionar'),           true,  'trabajo_social: agenda.gestionar = true');
select is(public.tiene_permiso('urgencias.ver'),              true,  'trabajo_social: urgencias.ver = true');
select is(public.tiene_permiso('derivacion.gestionar'),       true,  'trabajo_social: derivacion.gestionar = true');
select is(public.tiene_permiso('actividad.ver'),              true,  'trabajo_social: actividad.ver = true');
select is(public.tiene_permiso('actividad.registrar'),        true,  'trabajo_social: actividad.registrar = true');
select is(public.tiene_permiso('informe.ver'),                true,  'trabajo_social: informe.ver = true');

-- 7) Psicología
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'psicologia: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'psicologia: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'psicologia: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'psicologia: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        false, 'psicologia: expediente.escribir = false');
select is(public.tiene_permiso('expediente.ver'),             true,  'psicologia: expediente.ver = true');
select is(public.tiene_permiso('agresor.acceder'),            true,  'psicologia: agresor.acceder = true');
select is(public.tiene_permiso('historial_clinico.acceder'),  true,  'psicologia: historial_clinico.acceder = true');
select is(public.tiene_permiso('orden_proteccion.escribir'),  false, 'psicologia: orden_proteccion.escribir = false');
select is(public.tiene_permiso('alerta.atender'),             false, 'psicologia: alerta.atender = false');
select is(public.tiene_permiso('alerta.ver_cola'),            true,  'psicologia: alerta.ver_cola = true');
select is(public.tiene_permiso('expediente.verificar_curp'),  true,  'psicologia: expediente.verificar_curp = true');
select is(public.tiene_permiso('seguimiento.registrar'),      true,  'psicologia: seguimiento.registrar = true');
select is(public.tiene_permiso('agenda.ver'),                 true,  'psicologia: agenda.ver = true');
select is(public.tiene_permiso('agenda.gestionar'),           true,  'psicologia: agenda.gestionar = true');
select is(public.tiene_permiso('urgencias.ver'),              true,  'psicologia: urgencias.ver = true');
select is(public.tiene_permiso('derivacion.gestionar'),       true,  'psicologia: derivacion.gestionar = true');
select is(public.tiene_permiso('actividad.ver'),              true,  'psicologia: actividad.ver = true');
select is(public.tiene_permiso('actividad.registrar'),        true,  'psicologia: actividad.registrar = true');
select is(public.tiene_permiso('informe.ver'),                true,  'psicologia: informe.ver = true');

-- 8) Jurídico
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'juridico: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'juridico: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'juridico: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'juridico: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        false, 'juridico: expediente.escribir = false');
select is(public.tiene_permiso('expediente.ver'),             true,  'juridico: expediente.ver = true');
select is(public.tiene_permiso('agresor.acceder'),            true,  'juridico: agresor.acceder = true');
select is(public.tiene_permiso('historial_clinico.acceder'),  false, 'juridico: historial_clinico.acceder = false');
select is(public.tiene_permiso('orden_proteccion.escribir'),  true,  'juridico: orden_proteccion.escribir = true');
select is(public.tiene_permiso('alerta.atender'),             true,  'juridico: alerta.atender = true');
select is(public.tiene_permiso('alerta.ver_cola'),            true,  'juridico: alerta.ver_cola = true');
select is(public.tiene_permiso('expediente.verificar_curp'),  true,  'juridico: expediente.verificar_curp = true');
select is(public.tiene_permiso('seguimiento.registrar'),      true,  'juridico: seguimiento.registrar = true');
select is(public.tiene_permiso('agenda.ver'),                 true,  'juridico: agenda.ver = true');
select is(public.tiene_permiso('agenda.gestionar'),           true,  'juridico: agenda.gestionar = true');
select is(public.tiene_permiso('urgencias.ver'),              false, 'juridico: urgencias.ver = false');
select is(public.tiene_permiso('derivacion.gestionar'),       true,  'juridico: derivacion.gestionar = true');
select is(public.tiene_permiso('actividad.ver'),              true,  'juridico: actividad.ver = true');
select is(public.tiene_permiso('actividad.registrar'),        true,  'juridico: actividad.registrar = true');
select is(public.tiene_permiso('informe.ver'),                true,  'juridico: informe.ver = true');

-- 9) Recepción
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid);
select is(public.tiene_permiso('catalogos.gestionar'),        false, 'recepcion: catalogos.gestionar = false');
select is(public.tiene_permiso('directorio.gestionar'),       false, 'recepcion: directorio.gestionar = false');
select is(public.tiene_permiso('cuentas.gestionar'),          false, 'recepcion: cuentas.gestionar = false');
select is(public.tiene_permiso('bitacora.ver'),               false, 'recepcion: bitacora.ver = false');
select is(public.tiene_permiso('expediente.escribir'),        false, 'recepcion: expediente.escribir = false');
select is(public.tiene_permiso('expediente.ver'),             false, 'recepcion: expediente.ver = false');
select is(public.tiene_permiso('agresor.acceder'),            false, 'recepcion: agresor.acceder = false');
select is(public.tiene_permiso('historial_clinico.acceder'),  false, 'recepcion: historial_clinico.acceder = false');
select is(public.tiene_permiso('orden_proteccion.escribir'),  false, 'recepcion: orden_proteccion.escribir = false');
select is(public.tiene_permiso('alerta.atender'),             false, 'recepcion: alerta.atender = false');
select is(public.tiene_permiso('alerta.ver_cola'),            false, 'recepcion: alerta.ver_cola = false');
select is(public.tiene_permiso('expediente.verificar_curp'),  true,  'recepcion: expediente.verificar_curp = true');
select is(public.tiene_permiso('seguimiento.registrar'),      false, 'recepcion: seguimiento.registrar = false');
select is(public.tiene_permiso('agenda.ver'),                 true,  'recepcion: agenda.ver = true');
select is(public.tiene_permiso('agenda.gestionar'),           true,  'recepcion: agenda.gestionar = true');
select is(public.tiene_permiso('urgencias.ver'),              true,  'recepcion: urgencias.ver = true');
select is(public.tiene_permiso('derivacion.gestionar'),       false, 'recepcion: derivacion.gestionar = false');
select is(public.tiene_permiso('actividad.ver'),              true,  'recepcion: actividad.ver = true');
select is(public.tiene_permiso('actividad.registrar'),        false, 'recepcion: actividad.registrar = false');
select is(public.tiene_permiso('informe.ver'),                false, 'recepcion: informe.ver = false');

-- 10) Permiso inexistente -> false
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid);
select is(public.tiene_permiso('permiso.inexistente'), false, 'permiso inexistente = false');

select * from finish();
rollback;
