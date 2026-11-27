-- =====================================================================
-- 15_permisos_rbac_abac.sql (P-01 · Sprint 01)
-- Centraliza la validación RBAC en public.tiene_permiso(p_permiso) con
-- todas las claves del Sprint 01 y actualiza get_mapa_calor_asentamiento()
-- para validar con tiene_permiso('expediente.ver') en lugar de e.rol in (...).
-- =====================================================================

create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(case p_permiso
    -- Administración y catálogos
    when 'catalogos.gestionar'        then public.es_direccion()
    when 'directorio.gestionar'       then public.es_direccion()
    when 'cuentas.gestionar'          then public.es_direccion()
    when 'bitacora.ver'               then public.es_direccion()

    -- Expedientes y atención
    when 'expediente.escribir'        then public.es_direccion() or public.auth_rol() = 'trabajo_social'
    when 'expediente.ver'             then public.es_direccion() or public.es_area_atencion()
    when 'expediente.verificar_curp'  then public.es_empleado_activo()
    when 'seguimiento.registrar'      then public.es_area_atencion()
    when 'agresor.acceder'            then public.es_direccion() or public.es_area_atencion()
    when 'historial_clinico.acceder'  then public.es_direccion() or public.auth_rol() = 'psicologia'
    when 'orden_proteccion.escribir'  then public.es_direccion() or public.auth_rol() in ('juridico', 'trabajo_social')

    -- Agenda, urgencias y derivaciones
    when 'agenda.ver'                 then public.es_empleado_activo()
    when 'agenda.gestionar'           then public.es_empleado_activo()
    when 'urgencias.ver'              then public.es_direccion() or public.auth_rol() in ('trabajo_social', 'psicologia', 'recepcion')
    when 'derivacion.gestionar'       then public.es_direccion() or public.es_area_atencion()

    -- Alertas 24/7
    when 'alerta.atender'             then public.es_linea_24_7()
    when 'alerta.ver_cola'            then public.es_linea_24_7() or public.auth_rol() in ('trabajo_social', 'psicologia')

    -- Actividades preventivas e informes
    when 'actividad.ver'              then public.es_empleado_activo()
    when 'actividad.registrar'        then public.es_direccion() or public.es_area_atencion()
    when 'informe.ver'                then public.es_direccion() or public.es_area_atencion()

    else false
  end, false);
$$;

revoke all on function public.tiene_permiso(text) from public, anon;
grant execute on function public.tiene_permiso(text) to authenticated;

-- ---------------------------------------------------------------------
-- get_mapa_calor_asentamiento(): migra validación manual de roles a
-- public.tiene_permiso('expediente.ver') y mantiene alias explícitos.
-- ---------------------------------------------------------------------
create or replace function public.get_mapa_calor_asentamiento(p_umbral_minimo int default 3)
returns table (
  asentamiento_id   integer,
  codigo_postal     text,
  nombre            text,
  tipo_asentamiento text,
  municipio         text,
  estado            text,
  latitud           numeric(9, 6),
  longitud          numeric(9, 6),
  total_expedientes bigint,
  total_alertas     bigint,
  total_actividades bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para consultar el mapa de calor' using errcode = '42501';
  end if;

  return query
  with exp_por_asentamiento as (
    select d.asentamiento_id, count(distinct f.id) as cnt
    from public.domicilio d
    join public.persona p        on p.id = d.persona_id
    join public.ficha_registro f on f.persona_id = p.id
    where d.activo
      and d.es_actual
      and p.activo
      and f.activo
      and d.asentamiento_id is not null
    group by d.asentamiento_id
  ),
  alerta_por_asentamiento as (
    select al.asentamiento_id, count(*) as cnt
    from public.alerta al
    where al.activo
      and al.asentamiento_id is not null
    group by al.asentamiento_id
  ),
  act_por_asentamiento as (
    select ap.asentamiento_id, count(*) as cnt
    from public.actividad_preventiva ap
    where ap.activo
      and ap.asentamiento_id is not null
    group by ap.asentamiento_id
  )
  select ca.id as asentamiento_id,
         ca.codigo_postal,
         ca.nombre,
         ca.tipo_asentamiento,
         ca.municipio,
         ca.estado,
         ca.latitud,
         ca.longitud,
         coalesce(ep.cnt, 0) as total_expedientes,
         coalesce(aa.cnt, 0) as total_alertas,
         coalesce(ac.cnt, 0) as total_actividades
  from public.cat_asentamiento ca
  left join exp_por_asentamiento    ep on ep.asentamiento_id = ca.id
  left join alerta_por_asentamiento aa on aa.asentamiento_id = ca.id
  left join act_por_asentamiento    ac on ac.asentamiento_id = ca.id
  where (coalesce(ep.cnt, 0) + coalesce(aa.cnt, 0)) >= greatest(coalesce(p_umbral_minimo, 3), 1)
  order by (coalesce(ep.cnt, 0) + coalesce(aa.cnt, 0)) desc, ca.nombre;
end;
$$;

revoke execute on function public.get_mapa_calor_asentamiento(int) from public, anon;
grant  execute on function public.get_mapa_calor_asentamiento(int) to authenticated;
