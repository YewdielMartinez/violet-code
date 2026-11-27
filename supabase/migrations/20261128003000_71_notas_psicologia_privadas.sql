-- =====================================================================
-- 71_notas_psicologia_privadas.sql
-- Las notas privadas de Psicología (nota_area con area = 'psicologia')
-- solo las ve y escribe el rol `psicologia`. Dirección (titular y
-- subdirección) ya NO las lee.
--
-- Estado previo:
--   - Migración 21: cada área de atención lee/escribe solo su área
--     (`seguimiento.registrar` + area_id = auth_area_id()).
--   - Migración 61: nota_area_select añadió lectura de TODAS las áreas
--     para Dirección (es_direccion()). Eso exponía las notas de
--     Psicología a titular/subdirección.
--
-- Qué hace esta migración:
--   1. Clave nueva `nota_psicologia.acceder` (solo rol `psicologia`).
--      public.tiene_permiso() se redefine desde la definición vigente
--      (migración 67) conservando TODAS las claves.
--   2. Helper public.nota_area_es_psicologia(p_area_id): true si el área
--      es 'psicologia' (cat_area.clave).
--   3. RLS de nota_area:
--        select: notas de Psicología -> solo `nota_psicologia.acceder`
--                (y de su propia área). Notas de otras áreas -> sin
--                cambios (Dirección lee todas; cada área la suya).
--        insert/update: igual que antes, y las de Psicología además
--                exigen `nota_psicologia.acceder`.
--      Trabajo Social y Jurídico conservan su comportamiento y la
--      lectura de Dirección sobre sus notas (intención de la 61).
--   Nota: no hay RPC que liste o cree nota_area (el front usa la tabla
--   directa) y get_linea_tiempo nunca la incluye; la bitácora
--   (registrar_cambio) no copia el contenido de la nota.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. tiene_permiso(): agrega nota_psicologia.acceder (conserva todas las
--    claves de la migración 67).
-- ---------------------------------------------------------------------
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
    when 'expediente.reabrir'         then public.es_direccion()
    when 'seguimiento.registrar'      then public.es_area_atencion()
    when 'seguimiento.corregir'       then public.es_direccion() or public.es_area_atencion()
    when 'agresor.acceder'            then public.es_direccion() or public.es_area_atencion()
    when 'historial_clinico.acceder'  then public.es_direccion() or public.auth_rol() = 'psicologia'
    when 'historial_clinico.escribir' then public.auth_rol() = 'psicologia'
    when 'nota_psicologia.acceder'    then public.auth_rol() = 'psicologia'
    when 'orden_proteccion.escribir'  then public.es_direccion() or public.auth_rol() in ('juridico', 'trabajo_social')

    -- Agenda, urgencias y derivaciones (canalizaciones)
    when 'agenda.ver'                 then public.es_empleado_activo()
    when 'agenda.gestionar'           then public.es_empleado_activo()
    when 'agenda.crear'               then public.es_direccion() or public.auth_rol() in ('recepcion', 'juridico', 'psicologia')
    when 'urgencias.ver'              then public.es_direccion() or public.auth_rol() in ('trabajo_social', 'psicologia', 'recepcion')
    when 'derivacion.gestionar'       then public.es_direccion() or public.es_area_atencion()
    when 'canalizacion.crear'         then public.auth_rol() = 'trabajo_social'

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
-- 2. Helper: ¿el área es Psicología?
-- ---------------------------------------------------------------------
create or replace function public.nota_area_es_psicologia(p_area_id smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cat_area a
    where a.id = p_area_id
      and a.clave = 'psicologia'
  );
$$;

revoke all on function public.nota_area_es_psicologia(smallint) from public, anon;
grant execute on function public.nota_area_es_psicologia(smallint) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS de nota_area
-- ---------------------------------------------------------------------
drop policy if exists nota_area_select on public.nota_area;
drop policy if exists nota_area_insert on public.nota_area;
drop policy if exists nota_area_update on public.nota_area;

create policy nota_area_select on public.nota_area
  for select to authenticated
  using (
    case
      -- Psicología: solo el rol psicologia y solo su propia área
      when (select public.nota_area_es_psicologia(area_id)) then
        (select public.tiene_permiso('nota_psicologia.acceder'))
        and area_id = (select public.auth_area_id())
      -- Otras áreas: Dirección lee todas; cada área de atención la suya (migración 61)
      else
        (select public.es_direccion())
        or (
          (select public.tiene_permiso('seguimiento.registrar'))
          and area_id = (select public.auth_area_id())
        )
    end
  );

create policy nota_area_insert on public.nota_area
  for insert to authenticated
  with check (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
    and (
      not (select public.nota_area_es_psicologia(area_id))
      or (select public.tiene_permiso('nota_psicologia.acceder'))
    )
  );

create policy nota_area_update on public.nota_area
  for update to authenticated
  using (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
    and (
      not (select public.nota_area_es_psicologia(area_id))
      or (select public.tiene_permiso('nota_psicologia.acceder'))
    )
  )
  with check (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
    and (
      not (select public.nota_area_es_psicologia(area_id))
      or (select public.tiene_permiso('nota_psicologia.acceder'))
    )
  );
