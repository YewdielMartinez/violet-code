-- =====================================================================
-- 69_rpc_mi_perfil.sql (Tarjeta #159)
-- Crea RPC public.get_mi_perfil() para que apps/admin resuelva el perfil
-- del usuario autenticado (empleado o externo UMECA) y sus permisos
-- efectivos de tiene_permiso() en una sola llamada, sin leer empleado ni
-- usuario_externo directo en el login.
-- =====================================================================

create or replace function public.get_mi_perfil()
returns table (
  id          uuid,
  email       text,
  nombre      text,
  tipo        text,
  rol         text,
  area_id     smallint,
  area_clave  text,
  area_nombre text,
  dependencia text,
  activo      boolean,
  permisos    text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text;
  v_emp      record;
  v_ext      record;
  v_permisos text[] := '{}'::text[];
begin
  if v_uid is null then
    return;
  end if;

  select u.email::text
  into v_email
  from auth.users u
  where u.id = v_uid;

  select
    e.id,
    e.nombre,
    e.rol::text as rol,
    e.area_id,
    ca.clave    as area_clave,
    ca.nombre   as area_nombre,
    e.activo
  into v_emp
  from public.empleado e
  left join public.cat_area ca on ca.id = e.area_id
  where e.id = v_uid
  limit 1;

  if found then
    if v_emp.activo then
      select coalesce(array_agg(p.clave order by p.clave), '{}'::text[])
      into v_permisos
      from unnest(array[
        'catalogos.gestionar',
        'directorio.gestionar',
        'cuentas.gestionar',
        'bitacora.ver',
        'expediente.escribir',
        'expediente.ver',
        'expediente.verificar_curp',
        'expediente.reabrir',
        'seguimiento.registrar',
        'seguimiento.corregir',
        'agresor.acceder',
        'historial_clinico.acceder',
        'historial_clinico.escribir',
        'orden_proteccion.escribir',
        'agenda.ver',
        'agenda.gestionar',
        'agenda.crear',
        'urgencias.ver',
        'derivacion.gestionar',
        'canalizacion.crear',
        'alerta.atender',
        'alerta.ver_cola',
        'actividad.ver',
        'actividad.registrar',
        'informe.ver'
      ]) as p(clave)
      where public.tiene_permiso(p.clave);
    end if;

    return query
    select
      v_emp.id,
      coalesce(v_email, ''),
      v_emp.nombre,
      'empleado'::text,
      v_emp.rol,
      v_emp.area_id,
      v_emp.area_clave,
      v_emp.area_nombre,
      null::text,
      v_emp.activo,
      v_permisos;
    return;
  end if;

  select
    ue.id,
    ue.nombre,
    ue.dependencia,
    ue.activo
  into v_ext
  from public.usuario_externo ue
  where ue.id = v_uid
    and ue.dependencia = 'umeca'
  limit 1;

  if found then
    return query
    select
      v_ext.id,
      coalesce(v_email, ''),
      v_ext.nombre,
      'externo'::text,
      'umeca'::text,
      null::smallint,
      'umeca'::text,
      'UMECA'::text,
      v_ext.dependencia,
      v_ext.activo,
      '{}'::text[];
    return;
  end if;

  return;
end;
$$;

revoke all on function public.get_mi_perfil() from public, anon;
grant  execute on function public.get_mi_perfil() to authenticated;
