-- =====================================================================
-- 21_rls_tiene_permiso.sql (A-06 · Sprint 01)
-- Reescribe las políticas RLS de las 13 tablas asignadas a A-06 para
-- centralizar la autorización RBAC en tiene_permiso(...) y envolver todas
-- las llamadas a funciones helper en (select ...) (InitPlan por consulta),
-- sin modificar quién puede acceder o escribir respecto a 07_rls.sql.
--
-- No toca: persona, pre_registro, alerta ni storage.objects.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. domicilio
-- ---------------------------------------------------------------------
drop policy if exists domicilio_select on public.domicilio;
drop policy if exists domicilio_insert on public.domicilio;
drop policy if exists domicilio_update on public.domicilio;

create policy domicilio_select on public.domicilio
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy domicilio_insert on public.domicilio
  for insert to authenticated
  with check ((select public.tiene_permiso('expediente.ver')));

create policy domicilio_update on public.domicilio
  for update to authenticated
  using ((select public.tiene_permiso('expediente.ver')))
  with check ((select public.tiene_permiso('expediente.ver')));

-- ---------------------------------------------------------------------
-- 2. ficha_registro
-- ---------------------------------------------------------------------
drop policy if exists ficha_registro_select on public.ficha_registro;
drop policy if exists ficha_registro_insert on public.ficha_registro;
drop policy if exists ficha_registro_update on public.ficha_registro;

create policy ficha_registro_select on public.ficha_registro
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy ficha_registro_insert on public.ficha_registro
  for insert to authenticated
  with check ((select public.tiene_permiso('expediente.escribir')));

create policy ficha_registro_update on public.ficha_registro
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir')))
  with check ((select public.tiene_permiso('expediente.escribir')));

-- ---------------------------------------------------------------------
-- 3. ficha_servicio_solicitado
-- ---------------------------------------------------------------------
drop policy if exists ficha_servicio_solicitado_select on public.ficha_servicio_solicitado;
drop policy if exists ficha_servicio_solicitado_insert on public.ficha_servicio_solicitado;
drop policy if exists ficha_servicio_solicitado_update on public.ficha_servicio_solicitado;
drop policy if exists ficha_servicio_solicitado_delete on public.ficha_servicio_solicitado;

create policy ficha_servicio_solicitado_select on public.ficha_servicio_solicitado
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy ficha_servicio_solicitado_insert on public.ficha_servicio_solicitado
  for insert to authenticated
  with check ((select public.tiene_permiso('expediente.escribir')));

create policy ficha_servicio_solicitado_update on public.ficha_servicio_solicitado
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir')))
  with check ((select public.tiene_permiso('expediente.escribir')));

create policy ficha_servicio_solicitado_delete on public.ficha_servicio_solicitado
  for delete to authenticated
  using ((select public.tiene_permiso('expediente.escribir')));

-- ---------------------------------------------------------------------
-- 4. estudio_socioeconomico
-- ---------------------------------------------------------------------
drop policy if exists estudio_socioeconomico_select on public.estudio_socioeconomico;
drop policy if exists estudio_socioeconomico_insert on public.estudio_socioeconomico;
drop policy if exists estudio_socioeconomico_update on public.estudio_socioeconomico;

create policy estudio_socioeconomico_select on public.estudio_socioeconomico
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy estudio_socioeconomico_insert on public.estudio_socioeconomico
  for insert to authenticated
  with check ((select public.tiene_permiso('expediente.escribir')));

create policy estudio_socioeconomico_update on public.estudio_socioeconomico
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir')))
  with check ((select public.tiene_permiso('expediente.escribir')));

-- ---------------------------------------------------------------------
-- 5. aportante_hogar
-- ---------------------------------------------------------------------
drop policy if exists aportante_hogar_select on public.aportante_hogar;
drop policy if exists aportante_hogar_insert on public.aportante_hogar;
drop policy if exists aportante_hogar_update on public.aportante_hogar;

create policy aportante_hogar_select on public.aportante_hogar
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy aportante_hogar_insert on public.aportante_hogar
  for insert to authenticated
  with check ((select public.tiene_permiso('expediente.escribir')));

create policy aportante_hogar_update on public.aportante_hogar
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir')))
  with check ((select public.tiene_permiso('expediente.escribir')));

-- ---------------------------------------------------------------------
-- 6. agresor
-- ---------------------------------------------------------------------
drop policy if exists agresor_select on public.agresor;
drop policy if exists agresor_insert on public.agresor;
drop policy if exists agresor_update on public.agresor;

create policy agresor_select on public.agresor
  for select to authenticated
  using ((select public.tiene_permiso('agresor.acceder')));

create policy agresor_insert on public.agresor
  for insert to authenticated
  with check ((select public.tiene_permiso('agresor.acceder')));

create policy agresor_update on public.agresor
  for update to authenticated
  using ((select public.tiene_permiso('agresor.acceder')))
  with check ((select public.tiene_permiso('agresor.acceder')));

-- ---------------------------------------------------------------------
-- 7. orden_proteccion
-- ---------------------------------------------------------------------
drop policy if exists orden_proteccion_select on public.orden_proteccion;
drop policy if exists orden_proteccion_insert on public.orden_proteccion;
drop policy if exists orden_proteccion_update on public.orden_proteccion;

create policy orden_proteccion_select on public.orden_proteccion
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy orden_proteccion_insert on public.orden_proteccion
  for insert to authenticated
  with check ((select public.tiene_permiso('orden_proteccion.escribir')));

create policy orden_proteccion_update on public.orden_proteccion
  for update to authenticated
  using ((select public.tiene_permiso('orden_proteccion.escribir')))
  with check ((select public.tiene_permiso('orden_proteccion.escribir')));

-- ---------------------------------------------------------------------
-- 8. cita
-- ---------------------------------------------------------------------
drop policy if exists cita_select on public.cita;
drop policy if exists cita_insert on public.cita;
drop policy if exists cita_update on public.cita;

create policy cita_select on public.cita
  for select to authenticated
  using (
    (select public.tiene_permiso('agenda.ver'))
    and (
      (select public.es_direccion())
      or (
        (select public.auth_rol()) in ('recepcion', 'trabajo_social')
        and area_id in (
          (select public.area_id_por_clave('trabajo_social')),
          (select public.area_id_por_clave('psicologia'))
        )
      )
      or (
        (select public.auth_rol()) in ('psicologia', 'juridico')
        and area_id = (select public.auth_area_id())
      )
    )
  );

create policy cita_insert on public.cita
  for insert to authenticated
  with check (
    (select public.tiene_permiso('agenda.gestionar'))
    and (
      (select public.es_direccion())
      or (
        (select public.auth_rol()) = 'recepcion'
        and area_id in (
          (select public.area_id_por_clave('trabajo_social')),
          (select public.area_id_por_clave('psicologia'))
        )
      )
      or (
        (select public.es_area_atencion())
        and area_id = (select public.auth_area_id())
      )
    )
  );

create policy cita_update on public.cita
  for update to authenticated
  using (
    (select public.tiene_permiso('agenda.gestionar'))
    and (
      (select public.es_direccion())
      or (
        (select public.auth_rol()) = 'recepcion'
        and area_id in (
          (select public.area_id_por_clave('trabajo_social')),
          (select public.area_id_por_clave('psicologia'))
        )
      )
      or (
        (select public.es_area_atencion())
        and area_id = (select public.auth_area_id())
      )
    )
  )
  with check (
    (select public.tiene_permiso('agenda.gestionar'))
    and (
      (select public.es_direccion())
      or (
        (select public.auth_rol()) = 'recepcion'
        and area_id in (
          (select public.area_id_por_clave('trabajo_social')),
          (select public.area_id_por_clave('psicologia'))
        )
      )
      or (
        (select public.es_area_atencion())
        and area_id = (select public.auth_area_id())
      )
    )
  );

-- ---------------------------------------------------------------------
-- 9. atencion
-- ---------------------------------------------------------------------
drop policy if exists atencion_select on public.atencion;
drop policy if exists atencion_insert on public.atencion;
drop policy if exists atencion_update on public.atencion;

create policy atencion_select on public.atencion
  for select to authenticated
  using (
    (select public.tiene_permiso('expediente.ver'))
    and (
      (select public.es_direccion())
      or area_id = (select public.auth_area_id())
    )
  );

create policy atencion_insert on public.atencion
  for insert to authenticated
  with check (
    (select public.tiene_permiso('expediente.ver'))
    and (
      (select public.es_direccion())
      or area_id = (select public.auth_area_id())
    )
  );

create policy atencion_update on public.atencion
  for update to authenticated
  using (
    (select public.tiene_permiso('expediente.ver'))
    and (
      (select public.es_direccion())
      or area_id = (select public.auth_area_id())
    )
  )
  with check (
    (select public.tiene_permiso('expediente.ver'))
    and (
      (select public.es_direccion())
      or area_id = (select public.auth_area_id())
    )
  );

-- ---------------------------------------------------------------------
-- 10. nota_area
-- ---------------------------------------------------------------------
drop policy if exists nota_area_select on public.nota_area;
drop policy if exists nota_area_insert on public.nota_area;
drop policy if exists nota_area_update on public.nota_area;

create policy nota_area_select on public.nota_area
  for select to authenticated
  using (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
  );

create policy nota_area_insert on public.nota_area
  for insert to authenticated
  with check (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
  );

create policy nota_area_update on public.nota_area
  for update to authenticated
  using (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
  )
  with check (
    (select public.tiene_permiso('seguimiento.registrar'))
    and area_id = (select public.auth_area_id())
  );

-- ---------------------------------------------------------------------
-- 11. historial_clinico
-- ---------------------------------------------------------------------
drop policy if exists historial_clinico_select on public.historial_clinico;
drop policy if exists historial_clinico_insert on public.historial_clinico;
drop policy if exists historial_clinico_update on public.historial_clinico;

create policy historial_clinico_select on public.historial_clinico
  for select to authenticated
  using ((select public.tiene_permiso('historial_clinico.acceder')));

create policy historial_clinico_insert on public.historial_clinico
  for insert to authenticated
  with check ((select public.tiene_permiso('historial_clinico.acceder')));

create policy historial_clinico_update on public.historial_clinico
  for update to authenticated
  using ((select public.tiene_permiso('historial_clinico.acceder')))
  with check ((select public.tiene_permiso('historial_clinico.acceder')));

-- ---------------------------------------------------------------------
-- 12. derivacion
-- ---------------------------------------------------------------------
drop policy if exists derivacion_select on public.derivacion;
drop policy if exists derivacion_insert on public.derivacion;
drop policy if exists derivacion_update on public.derivacion;

create policy derivacion_select on public.derivacion
  for select to authenticated
  using (
    (select public.tiene_permiso('derivacion.gestionar'))
    and (
      (select public.es_direccion())
      or (select public.auth_rol()) = 'trabajo_social'
      or area_origen_id = (select public.auth_area_id())
      or area_destino_id = (select public.auth_area_id())
    )
  );

create policy derivacion_insert on public.derivacion
  for insert to authenticated
  with check ((select public.tiene_permiso('derivacion.gestionar')));

create policy derivacion_update on public.derivacion
  for update to authenticated
  using ((select public.tiene_permiso('derivacion.gestionar')))
  with check ((select public.tiene_permiso('derivacion.gestionar')));

-- ---------------------------------------------------------------------
-- 13. documento
-- ---------------------------------------------------------------------
drop policy if exists documento_select on public.documento;
drop policy if exists documento_insert on public.documento;
drop policy if exists documento_update on public.documento;

create policy documento_select on public.documento
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));

create policy documento_insert on public.documento
  for insert to authenticated
  with check ((select public.tiene_permiso('expediente.ver')));

create policy documento_update on public.documento
  for update to authenticated
  using ((select public.tiene_permiso('expediente.ver')))
  with check ((select public.tiene_permiso('expediente.ver')));
