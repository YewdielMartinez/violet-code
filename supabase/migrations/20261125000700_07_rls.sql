-- =====================================================================
-- 07_rls.sql
-- Qué contiene: modelo híbrido RBAC + ABAC ligero mediante funciones
-- helper SQL y políticas RLS para las 32 tablas públicas + bucket
-- privado 'documentos' en storage.objects.
-- Depende de: 01_base.sql a 06_reglas_negocio.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funciones helper RBAC + ABAC (SECURITY DEFINER STABLE)
-- ---------------------------------------------------------------------
create or replace function public.auth_rol()
returns public.rol_empleado
language sql
stable
security definer
set search_path = public
as $$
  select e.rol
  from public.empleado e
  where e.id = auth.uid()
    and e.activo;
$$;

create or replace function public.auth_area_id()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select e.area_id
  from public.empleado e
  where e.id = auth.uid()
    and e.activo;
$$;

create or replace function public.es_empleado_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_rol() is not null;
$$;

create or replace function public.es_direccion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_rol() in ('titular', 'subdireccion'), false);
$$;

create or replace function public.es_area_atencion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_rol() in ('trabajo_social', 'psicologia', 'juridico'), false);
$$;

create or replace function public.es_linea_24_7()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_rol() in ('titular', 'subdireccion', 'juridico'), false);
$$;

create or replace function public.es_umeca()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuario_externo u
    where u.id = auth.uid()
      and u.activo
      and u.dependencia = 'umeca'
  );
$$;

create or replace function public.area_id_por_clave(p_clave text)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.cat_area a
  where a.clave = p_clave
  limit 1;
$$;

-- Puerta de escalamiento granular: hoy resuelve por rol sin tablas extra;
-- si en el futuro se requieren permisos por usuario o rol personalizado,
-- basta modificar esta función sin reescribir las políticas RLS.
create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_permiso
    when 'catalogos.gestionar' then public.es_direccion()
    when 'directorio.gestionar' then public.es_direccion()
    when 'cuentas.gestionar' then public.es_direccion()
    when 'bitacora.ver' then public.es_direccion()
    when 'expediente.escribir' then public.es_direccion() or public.auth_rol() = 'trabajo_social'
    when 'expediente.ver' then public.es_direccion() or public.es_area_atencion()
    when 'agresor.acceder' then public.es_direccion() or public.es_area_atencion()
    when 'historial_clinico.acceder' then public.es_direccion() or public.auth_rol() = 'psicologia'
    when 'orden_proteccion.escribir' then public.es_direccion() or public.auth_rol() in ('juridico', 'trabajo_social')
    when 'alerta.atender' then public.es_linea_24_7()
    when 'alerta.ver_cola' then public.es_linea_24_7() or public.auth_rol() in ('trabajo_social', 'psicologia')
    else false
  end;
$$;

revoke all on function public.auth_rol()               from public, anon;
revoke all on function public.auth_area_id()           from public, anon;
revoke all on function public.es_empleado_activo()     from public, anon;
revoke all on function public.es_direccion()           from public, anon;
revoke all on function public.es_area_atencion()       from public, anon;
revoke all on function public.es_linea_24_7()          from public, anon;
revoke all on function public.es_umeca()               from public, anon;
revoke all on function public.area_id_por_clave(text)  from public, anon;
revoke all on function public.tiene_permiso(text)      from public, anon;

grant execute on function public.auth_rol()              to authenticated;
grant execute on function public.auth_area_id()          to authenticated;
grant execute on function public.es_empleado_activo()    to authenticated;
grant execute on function public.es_direccion()          to authenticated;
grant execute on function public.es_area_atencion()      to authenticated;
grant execute on function public.es_linea_24_7()         to authenticated;
grant execute on function public.es_umeca()              to authenticated;
grant execute on function public.area_id_por_clave(text) to authenticated;
grant execute on function public.tiene_permiso(text)     to authenticated;

-- ---------------------------------------------------------------------
-- 2. Políticas en catálogos (10 catálogos: lectura authenticated; gestión
--    vía tiene_permiso('catalogos.gestionar'))
-- ---------------------------------------------------------------------
create policy cat_area_select on public.cat_area for select to authenticated using (true);
create policy cat_area_insert on public.cat_area for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_area_update on public.cat_area for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_asentamiento_select on public.cat_asentamiento for select to authenticated using (true);
create policy cat_asentamiento_insert on public.cat_asentamiento for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_asentamiento_update on public.cat_asentamiento for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_discapacidad_select on public.cat_discapacidad for select to authenticated using (true);
create policy cat_discapacidad_insert on public.cat_discapacidad for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_discapacidad_update on public.cat_discapacidad for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_grupo_etnico_select on public.cat_grupo_etnico for select to authenticated using (true);
create policy cat_grupo_etnico_insert on public.cat_grupo_etnico for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_grupo_etnico_update on public.cat_grupo_etnico for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_religion_select on public.cat_religion for select to authenticated using (true);
create policy cat_religion_insert on public.cat_religion for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_religion_update on public.cat_religion for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_tipo_atencion_select on public.cat_tipo_atencion for select to authenticated using (true);
create policy cat_tipo_atencion_insert on public.cat_tipo_atencion for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_tipo_atencion_update on public.cat_tipo_atencion for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_ocupacion_select on public.cat_ocupacion for select to authenticated using (true);
create policy cat_ocupacion_insert on public.cat_ocupacion for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_ocupacion_update on public.cat_ocupacion for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_tipo_actividad_select on public.cat_tipo_actividad for select to authenticated using (true);
create policy cat_tipo_actividad_insert on public.cat_tipo_actividad for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_tipo_actividad_update on public.cat_tipo_actividad for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_parentesco_select on public.cat_parentesco for select to authenticated using (true);
create policy cat_parentesco_insert on public.cat_parentesco for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_parentesco_update on public.cat_parentesco for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

create policy cat_tipo_documento_select on public.cat_tipo_documento for select to authenticated using (true);
create policy cat_tipo_documento_insert on public.cat_tipo_documento for insert to authenticated with check (public.tiene_permiso('catalogos.gestionar'));
create policy cat_tipo_documento_update on public.cat_tipo_documento for update to authenticated using (public.tiene_permiso('catalogos.gestionar')) with check (public.tiene_permiso('catalogos.gestionar'));

-- ---------------------------------------------------------------------
-- 3. Cuentas (empleado, usuario_externo)
-- ---------------------------------------------------------------------
create policy empleado_select on public.empleado
  for select to authenticated
  using (id = auth.uid() or public.es_empleado_activo());

create policy empleado_insert on public.empleado
  for insert to authenticated
  with check (public.tiene_permiso('cuentas.gestionar'));

create policy empleado_update on public.empleado
  for update to authenticated
  using (public.tiene_permiso('cuentas.gestionar'))
  with check (public.tiene_permiso('cuentas.gestionar'));

create policy usuario_externo_select on public.usuario_externo
  for select to authenticated
  using (id = auth.uid() or public.tiene_permiso('cuentas.gestionar'));

create policy usuario_externo_insert on public.usuario_externo
  for insert to authenticated
  with check (public.tiene_permiso('cuentas.gestionar'));

create policy usuario_externo_update on public.usuario_externo
  for update to authenticated
  using (public.tiene_permiso('cuentas.gestionar'))
  with check (public.tiene_permiso('cuentas.gestionar'));

-- ---------------------------------------------------------------------
-- 4. Persona y domicilio
-- ---------------------------------------------------------------------
create policy persona_select on public.persona
  for select to authenticated
  using (
    public.tiene_permiso('expediente.ver')
    or public.auth_rol() = 'recepcion'
  );

create policy persona_insert on public.persona
  for insert to authenticated
  with check (public.tiene_permiso('expediente.escribir'));

create policy persona_update on public.persona
  for update to authenticated
  using (public.tiene_permiso('expediente.escribir'))
  with check (public.tiene_permiso('expediente.escribir'));

create policy domicilio_select on public.domicilio
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy domicilio_insert on public.domicilio
  for insert to authenticated
  with check (public.tiene_permiso('expediente.ver'));

create policy domicilio_update on public.domicilio
  for update to authenticated
  using (public.tiene_permiso('expediente.ver'))
  with check (public.tiene_permiso('expediente.ver'));

-- ---------------------------------------------------------------------
-- 5. Expediente: ficha_registro, ficha_servicio_solicitado,
--    estudio_socioeconomico y aportante_hogar
-- ---------------------------------------------------------------------
create policy ficha_registro_select on public.ficha_registro
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy ficha_registro_insert on public.ficha_registro
  for insert to authenticated
  with check (public.tiene_permiso('expediente.escribir'));

create policy ficha_registro_update on public.ficha_registro
  for update to authenticated
  using (public.tiene_permiso('expediente.escribir'))
  with check (public.tiene_permiso('expediente.escribir'));

create policy ficha_servicio_solicitado_select on public.ficha_servicio_solicitado
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy ficha_servicio_solicitado_insert on public.ficha_servicio_solicitado
  for insert to authenticated
  with check (public.tiene_permiso('expediente.escribir'));

create policy ficha_servicio_solicitado_update on public.ficha_servicio_solicitado
  for update to authenticated
  using (public.tiene_permiso('expediente.escribir'))
  with check (public.tiene_permiso('expediente.escribir'));

create policy ficha_servicio_solicitado_delete on public.ficha_servicio_solicitado
  for delete to authenticated
  using (public.tiene_permiso('expediente.escribir'));

create policy estudio_socioeconomico_select on public.estudio_socioeconomico
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy estudio_socioeconomico_insert on public.estudio_socioeconomico
  for insert to authenticated
  with check (public.tiene_permiso('expediente.escribir'));

create policy estudio_socioeconomico_update on public.estudio_socioeconomico
  for update to authenticated
  using (public.tiene_permiso('expediente.escribir'))
  with check (public.tiene_permiso('expediente.escribir'));

create policy aportante_hogar_select on public.aportante_hogar
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy aportante_hogar_insert on public.aportante_hogar
  for insert to authenticated
  with check (public.tiene_permiso('expediente.escribir'));

create policy aportante_hogar_update on public.aportante_hogar
  for update to authenticated
  using (public.tiene_permiso('expediente.escribir'))
  with check (public.tiene_permiso('expediente.escribir'));

-- ---------------------------------------------------------------------
-- 6. Agresor y órdenes de protección
-- ---------------------------------------------------------------------
create policy agresor_select on public.agresor
  for select to authenticated
  using (public.tiene_permiso('agresor.acceder'));

create policy agresor_insert on public.agresor
  for insert to authenticated
  with check (public.tiene_permiso('agresor.acceder'));

create policy agresor_update on public.agresor
  for update to authenticated
  using (public.tiene_permiso('agresor.acceder'))
  with check (public.tiene_permiso('agresor.acceder'));

create policy orden_proteccion_select on public.orden_proteccion
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy orden_proteccion_insert on public.orden_proteccion
  for insert to authenticated
  with check (public.tiene_permiso('orden_proteccion.escribir'));

create policy orden_proteccion_update on public.orden_proteccion
  for update to authenticated
  using (public.tiene_permiso('orden_proteccion.escribir'))
  with check (public.tiene_permiso('orden_proteccion.escribir'));

-- ---------------------------------------------------------------------
-- 7. Agenda (cita) y Seguimiento (atencion) (RN-04, RN-18)
-- ---------------------------------------------------------------------
create policy cita_select on public.cita
  for select to authenticated
  using (
    public.es_direccion()
    or (
      public.auth_rol() in ('recepcion', 'trabajo_social')
      and area_id in (
        public.area_id_por_clave('trabajo_social'),
        public.area_id_por_clave('psicologia')
      )
    )
    or (
      public.auth_rol() in ('psicologia', 'juridico')
      and area_id = public.auth_area_id()
    )
  );

create policy cita_insert on public.cita
  for insert to authenticated
  with check (
    public.es_direccion()
    or (
      public.auth_rol() = 'recepcion'
      and area_id in (
        public.area_id_por_clave('trabajo_social'),
        public.area_id_por_clave('psicologia')
      )
    )
    or (
      public.es_area_atencion()
      and area_id = public.auth_area_id()
    )
  );

create policy cita_update on public.cita
  for update to authenticated
  using (
    public.es_direccion()
    or (
      public.auth_rol() = 'recepcion'
      and area_id in (
        public.area_id_por_clave('trabajo_social'),
        public.area_id_por_clave('psicologia')
      )
    )
    or (
      public.es_area_atencion()
      and area_id = public.auth_area_id()
    )
  )
  with check (
    public.es_direccion()
    or (
      public.auth_rol() = 'recepcion'
      and area_id in (
        public.area_id_por_clave('trabajo_social'),
        public.area_id_por_clave('psicologia')
      )
    )
    or (
      public.es_area_atencion()
      and area_id = public.auth_area_id()
    )
  );

create policy atencion_select on public.atencion
  for select to authenticated
  using (
    public.es_direccion()
    or (public.es_area_atencion() and area_id = public.auth_area_id())
  );

create policy atencion_insert on public.atencion
  for insert to authenticated
  with check (
    public.es_direccion()
    or (public.es_area_atencion() and area_id = public.auth_area_id())
  );

create policy atencion_update on public.atencion
  for update to authenticated
  using (
    public.es_direccion()
    or (public.es_area_atencion() and area_id = public.auth_area_id())
  )
  with check (
    public.es_direccion()
    or (public.es_area_atencion() and area_id = public.auth_area_id())
  );

-- ---------------------------------------------------------------------
-- 8. Privacidad de áreas: nota_area (RF-10, RN-09) y historial_clinico
-- ---------------------------------------------------------------------
create policy nota_area_select on public.nota_area
  for select to authenticated
  using (public.es_area_atencion() and area_id = public.auth_area_id());

create policy nota_area_insert on public.nota_area
  for insert to authenticated
  with check (public.es_area_atencion() and area_id = public.auth_area_id());

create policy nota_area_update on public.nota_area
  for update to authenticated
  using (public.es_area_atencion() and area_id = public.auth_area_id())
  with check (public.es_area_atencion() and area_id = public.auth_area_id());

create policy historial_clinico_select on public.historial_clinico
  for select to authenticated
  using (public.tiene_permiso('historial_clinico.acceder'));

create policy historial_clinico_insert on public.historial_clinico
  for insert to authenticated
  with check (public.tiene_permiso('historial_clinico.acceder'));

create policy historial_clinico_update on public.historial_clinico
  for update to authenticated
  using (public.tiene_permiso('historial_clinico.acceder'))
  with check (public.tiene_permiso('historial_clinico.acceder'));

-- ---------------------------------------------------------------------
-- 9. Derivaciones, documentos y Storage ('documentos')
-- ---------------------------------------------------------------------
create policy derivacion_select on public.derivacion
  for select to authenticated
  using (
    public.es_direccion()
    or (
      public.es_area_atencion()
      and (
        area_origen_id = public.auth_area_id()
        or area_destino_id = public.auth_area_id()
        or public.auth_rol() = 'trabajo_social'
      )
    )
  );

create policy derivacion_insert on public.derivacion
  for insert to authenticated
  with check (public.tiene_permiso('expediente.ver'));

create policy derivacion_update on public.derivacion
  for update to authenticated
  using (public.tiene_permiso('expediente.ver'))
  with check (public.tiene_permiso('expediente.ver'));

create policy documento_select on public.documento
  for select to authenticated
  using (public.tiene_permiso('expediente.ver'));

create policy documento_insert on public.documento
  for insert to authenticated
  with check (public.tiene_permiso('expediente.ver'));

create policy documento_update on public.documento
  for update to authenticated
  using (public.tiene_permiso('expediente.ver'))
  with check (public.tiene_permiso('expediente.ver'));

create policy documentos_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and public.tiene_permiso('expediente.ver'));

create policy documentos_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.tiene_permiso('expediente.ver'));

create policy documentos_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and public.tiene_permiso('expediente.ver'))
  with check (bucket_id = 'documentos' and public.tiene_permiso('expediente.ver'));

-- ---------------------------------------------------------------------
-- 10. Directorio público y actividades preventivas
-- ---------------------------------------------------------------------
create policy directorio_institucion_select on public.directorio_institucion
  for select to authenticated
  using (activo or public.es_empleado_activo());

create policy directorio_institucion_insert on public.directorio_institucion
  for insert to authenticated
  with check (public.tiene_permiso('directorio.gestionar'));

create policy directorio_institucion_update on public.directorio_institucion
  for update to authenticated
  using (public.tiene_permiso('directorio.gestionar'))
  with check (public.tiene_permiso('directorio.gestionar'));

create policy actividad_preventiva_select on public.actividad_preventiva
  for select to authenticated
  using (public.es_empleado_activo());

create policy actividad_preventiva_insert on public.actividad_preventiva
  for insert to authenticated
  with check (public.tiene_permiso('expediente.ver'));

create policy actividad_preventiva_update on public.actividad_preventiva
  for update to authenticated
  using (public.tiene_permiso('expediente.ver'))
  with check (public.tiene_permiso('expediente.ver'));

create policy actividad_empleado_select on public.actividad_empleado
  for select to authenticated
  using (public.es_empleado_activo());

create policy actividad_empleado_insert on public.actividad_empleado
  for insert to authenticated
  with check (public.tiene_permiso('expediente.ver'));

create policy actividad_empleado_update on public.actividad_empleado
  for update to authenticated
  using (public.tiene_permiso('expediente.ver'))
  with check (public.tiene_permiso('expediente.ver'));

-- ---------------------------------------------------------------------
-- 11. Pre-registro móvil, alertas y bitácora inmutable (RF-18, RF-22, RF-33)
-- ---------------------------------------------------------------------
create policy pre_registro_select on public.pre_registro
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.tiene_permiso('expediente.escribir')
  );

create policy pre_registro_insert on public.pre_registro
  for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy pre_registro_update on public.pre_registro
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or public.tiene_permiso('expediente.escribir')
  )
  with check (
    auth_user_id = auth.uid()
    or public.tiene_permiso('expediente.escribir')
  );

create policy alerta_select on public.alerta
  for select to authenticated
  using (
    public.tiene_permiso('alerta.ver_cola')
    or exists (
      select 1
      from public.pre_registro pr
      where pr.id = alerta.pre_registro_id
        and pr.auth_user_id = auth.uid()
    )
  );

create policy alerta_insert on public.alerta
  for insert to authenticated
  with check (
    public.tiene_permiso('alerta.atender')
    or (
      origen = 'app_movil'
      and persona_id is null
      and exists (
        select 1
        from public.pre_registro pr
        where pr.id = alerta.pre_registro_id
          and pr.auth_user_id = auth.uid()
          and pr.activo
      )
    )
  );

create policy alerta_update on public.alerta
  for update to authenticated
  using (public.tiene_permiso('alerta.atender'))
  with check (public.tiene_permiso('alerta.atender'));

-- bitacora_acceso: solo lectura para Dirección; las escrituras provienen
-- únicamente de registrar_cambio() y registrar_consulta() (SECURITY DEFINER).
create policy bitacora_acceso_select on public.bitacora_acceso
  for select to authenticated
  using (public.tiene_permiso('bitacora.ver'));
