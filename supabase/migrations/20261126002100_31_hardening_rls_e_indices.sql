-- =====================================================================
-- 31_hardening_rls_e_indices.sql (Auditoría Supabase Postgres best practices)
--
-- 1. Storage: elimina documentos_storage_update. Cualquier usuario con
--    'expediente.ver' podía sobrescribir evidencias de otra área. Los
--    documentos son inmutables una vez subidos (el front sube con
--    upsert:false); para corregir se sube uno nuevo y se desactiva el
--    anterior.
-- 2. RLS: envuelve tiene_permiso(), es_empleado_activo() y auth.uid() en
--    (select ...) en las políticas que quedaron fuera de la migración 21,
--    para que Postgres evalúe la función una vez por consulta (initPlan)
--    y no una vez por fila.
-- 3. Búsqueda por nombre: índice GIN trigram sobre el nombre completo
--    normalizado (antes solo había índices por columna, que la RPC no
--    podía usar) y búsqueda por folio con índice de prefijo.
-- 4. Índices en llaves foráneas usadas por RLS, RPCs y joins.
-- 5. Privilegios por defecto: las funciones nuevas ya no quedan
--    ejecutables por PUBLIC/anon si alguien olvida el revoke.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Storage: documentos inmutables
-- ---------------------------------------------------------------------
drop policy if exists documentos_storage_update on storage.objects;

-- ---------------------------------------------------------------------
-- 2. RLS: llamadas a funciones evaluadas una vez por consulta
-- ---------------------------------------------------------------------
alter policy actividad_empleado_insert on public.actividad_empleado
  with check ((select public.tiene_permiso('expediente.ver'::text)));
alter policy actividad_empleado_select on public.actividad_empleado
  using ((select public.es_empleado_activo()));
alter policy actividad_empleado_update on public.actividad_empleado
  using ((select public.tiene_permiso('expediente.ver'::text)))
  with check ((select public.tiene_permiso('expediente.ver'::text)));
alter policy actividad_preventiva_insert on public.actividad_preventiva
  with check ((select public.tiene_permiso('expediente.ver'::text)));
alter policy actividad_preventiva_select on public.actividad_preventiva
  using ((select public.es_empleado_activo()));
alter policy actividad_preventiva_update on public.actividad_preventiva
  using ((select public.tiene_permiso('expediente.ver'::text)))
  with check ((select public.tiene_permiso('expediente.ver'::text)));
alter policy alerta_update on public.alerta
  using ((select public.tiene_permiso('alerta.atender'::text)))
  with check ((select public.tiene_permiso('alerta.atender'::text)));
alter policy bitacora_acceso_select on public.bitacora_acceso
  using ((select public.tiene_permiso('bitacora.ver'::text)));
alter policy cat_area_insert on public.cat_area
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_area_update on public.cat_area
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_asentamiento_insert on public.cat_asentamiento
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_asentamiento_update on public.cat_asentamiento
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_ocupacion_insert on public.cat_ocupacion
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_ocupacion_update on public.cat_ocupacion
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_parentesco_insert on public.cat_parentesco
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_parentesco_update on public.cat_parentesco
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_tipo_actividad_insert on public.cat_tipo_actividad
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_tipo_actividad_update on public.cat_tipo_actividad
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_tipo_atencion_insert on public.cat_tipo_atencion
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_tipo_atencion_update on public.cat_tipo_atencion
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_tipo_documento_insert on public.cat_tipo_documento
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy cat_tipo_documento_update on public.cat_tipo_documento
  using ((select public.tiene_permiso('catalogos.gestionar'::text)))
  with check ((select public.tiene_permiso('catalogos.gestionar'::text)));
alter policy directorio_institucion_insert on public.directorio_institucion
  with check ((select public.tiene_permiso('directorio.gestionar'::text)));
alter policy directorio_institucion_select on public.directorio_institucion
  using ((activo OR (select public.es_empleado_activo())));
alter policy directorio_institucion_update on public.directorio_institucion
  using ((select public.tiene_permiso('directorio.gestionar'::text)))
  with check ((select public.tiene_permiso('directorio.gestionar'::text)));
alter policy empleado_insert on public.empleado
  with check ((select public.tiene_permiso('cuentas.gestionar'::text)));
alter policy empleado_select on public.empleado
  using (((id = (select auth.uid())) OR (select public.es_empleado_activo())));
alter policy empleado_update on public.empleado
  using ((select public.tiene_permiso('cuentas.gestionar'::text)))
  with check ((select public.tiene_permiso('cuentas.gestionar'::text)));
alter policy persona_insert on public.persona
  with check ((select public.tiene_permiso('expediente.escribir'::text)));
alter policy persona_update on public.persona
  using ((select public.tiene_permiso('expediente.escribir'::text)))
  with check ((select public.tiene_permiso('expediente.escribir'::text)));
alter policy pre_registro_insert on public.pre_registro
  with check ((auth_user_id = (select auth.uid())));
alter policy usuario_externo_insert on public.usuario_externo
  with check ((select public.tiene_permiso('cuentas.gestionar'::text)));
alter policy usuario_externo_select on public.usuario_externo
  using (((id = (select auth.uid())) OR (select public.tiene_permiso('cuentas.gestionar'::text))));
alter policy usuario_externo_update on public.usuario_externo
  using ((select public.tiene_permiso('cuentas.gestionar'::text)))
  with check ((select public.tiene_permiso('cuentas.gestionar'::text)));
alter policy documentos_storage_insert on storage.objects
  with check (((bucket_id = 'documentos'::text) AND (select public.tiene_permiso('expediente.ver'::text))));
alter policy documentos_storage_select on storage.objects
  using (((bucket_id = 'documentos'::text) AND (select public.tiene_permiso('expediente.ver'::text))));

-- ---------------------------------------------------------------------
-- 3. Búsqueda de expedientes indexable
-- ---------------------------------------------------------------------
-- unaccent() y concat_ws() son STABLE, así que no se pueden indexar
-- directamente. Este envoltorio fija el diccionario explícito
-- (extensions.unaccent) y recibe solo text, por lo que es seguro
-- declararlo IMMUTABLE.
create or replace function public.f_nombre_busqueda(
  p_nombres text, p_apellido_paterno text, p_apellido_materno text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    lower(concat_ws(' ', p_nombres, p_apellido_paterno, p_apellido_materno))
  )
$$;

revoke execute on function public.f_nombre_busqueda(text, text, text) from public, anon;
grant  execute on function public.f_nombre_busqueda(text, text, text) to authenticated, service_role;

create index if not exists persona_nombre_busqueda_trgm_idx
  on public.persona
  using gin (public.f_nombre_busqueda(nombres, apellido_paterno, apellido_materno) extensions.gin_trgm_ops);

-- Prefijo de folio sin distinguir mayúsculas (sustituye a ilike).
create index if not exists ficha_registro_folio_upper_prefix_idx
  on public.ficha_registro (upper(folio) text_pattern_ops);

create or replace function public.buscar_expedientes(
  p_termino            text,
  p_limite             int default 20,
  p_incluir_archivados boolean default false
)
returns table (
  ficha_id           uuid,
  folio              text,
  estado             public.estado_ficha,
  persona_id         uuid,
  curp               text,
  nombre_completo    text,
  sexo               text,
  fecha_nacimiento   date,
  en_lista_urgencias boolean,
  coincidencia       text,
  similitud          real
)
language plpgsql
stable
security definer
set search_path = public
-- Umbral del operador % de pg_trgm; igual al >= 0.25 que usaba antes.
set pg_trgm.similarity_threshold = 0.25
as $$
declare
  v_termino      text := btrim(coalesce(p_termino, ''));
  v_termino_norm text;
  v_upper        text;
  v_limite       int := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_incluir_arch boolean := coalesce(p_incluir_archivados, false);
begin
  if not public.tiene_permiso('expediente.ver') then
    raise exception 'Sin permiso para buscar expedientes' using errcode = '42501';
  end if;

  if char_length(v_termino) < 3 then
    raise exception 'Ingresa al menos 3 caracteres para buscar' using errcode = '23514';
  end if;

  v_upper := upper(v_termino);
  v_termino_norm := public.f_nombre_busqueda(v_termino, null, null);

  if v_upper ~ '^[A-Z0-9]{18}$' then
    return query
    select f.id as ficha_id,
           f.folio,
           f.estado,
           p.id as persona_id,
           p.curp,
           concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as nombre_completo,
           p.sexo,
           p.fecha_nacimiento,
           exists (
             select 1 from public.vista_lista_urgencias vlu where vlu.ficha_id = f.id
           ) as en_lista_urgencias,
           'curp'::text as coincidencia,
           1.0::real as similitud
    from public.ficha_registro f
    join public.persona p on p.id = f.persona_id
    where f.activo
      and p.activo
      and (v_incluir_arch or f.estado <> 'archivado')
      and p.curp = v_upper
    order by f.registrada_en desc
    limit v_limite;
    return;
  end if;

  if v_upper ~ '^SEM-' then
    return query
    select f.id as ficha_id,
           f.folio,
           f.estado,
           p.id as persona_id,
           p.curp,
           concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as nombre_completo,
           p.sexo,
           p.fecha_nacimiento,
           exists (
             select 1 from public.vista_lista_urgencias vlu where vlu.ficha_id = f.id
           ) as en_lista_urgencias,
           'folio'::text as coincidencia,
           1.0::real as similitud
    from public.ficha_registro f
    join public.persona p on p.id = f.persona_id
    where f.activo
      and p.activo
      and (v_incluir_arch or f.estado <> 'archivado')
      -- Escapa comodines para que el término sea un prefijo literal.
      and upper(f.folio) like replace(replace(replace(v_upper, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by f.registrada_en desc
    limit v_limite;
    return;
  end if;

  return query
  with candidatos as (
    select f.id as c_ficha_id,
           f.folio as c_folio,
           f.estado as c_estado,
           f.registrada_en as c_registrada_en,
           p.id as c_persona_id,
           p.curp as c_curp,
           concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as c_nombre_completo,
           p.sexo as c_sexo,
           p.fecha_nacimiento as c_fecha_nacimiento,
           public.f_nombre_busqueda(p.nombres, p.apellido_paterno, p.apellido_materno) as c_nombre_norm
    from public.persona p
    join public.ficha_registro f on f.persona_id = p.id
    where f.activo
      and p.activo
      and (v_incluir_arch or f.estado <> 'archivado')
      and (
        public.f_nombre_busqueda(p.nombres, p.apellido_paterno, p.apellido_materno)
          like '%' || v_termino_norm || '%'
        or public.f_nombre_busqueda(p.nombres, p.apellido_paterno, p.apellido_materno)
          operator(extensions.%) v_termino_norm
      )
  )
  select c.c_ficha_id,
         c.c_folio,
         c.c_estado,
         c.c_persona_id,
         c.c_curp,
         c.c_nombre_completo,
         c.c_sexo,
         c.c_fecha_nacimiento,
         exists (
           select 1 from public.vista_lista_urgencias vlu where vlu.ficha_id = c.c_ficha_id
         ),
         'nombre'::text,
         greatest(
           extensions.similarity(c.c_nombre_norm, v_termino_norm),
           case when c.c_nombre_norm like '%' || v_termino_norm || '%' then 0.8::real else 0.0::real end
         )::real as c_similitud
  from candidatos c
  order by c_similitud desc, c.c_registrada_en desc
  limit v_limite;
end;
$$;

revoke execute on function public.buscar_expedientes(text, int, boolean) from public, anon;
grant  execute on function public.buscar_expedientes(text, int, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Índices en llaves foráneas usadas por RLS, RPCs y joins
--    (las columnas creado_por solo se usan para auditoría y no se indexan)
-- ---------------------------------------------------------------------
create index if not exists derivacion_area_origen_id_idx        on public.derivacion (area_origen_id);
create index if not exists derivacion_area_destino_id_idx       on public.derivacion (area_destino_id);
create index if not exists empleado_area_id_idx                 on public.empleado (area_id);
create index if not exists alerta_atendida_por_idx              on public.alerta (atendida_por);
create index if not exists atencion_atendida_por_idx            on public.atencion (atendida_por);
create index if not exists atencion_tipo_atencion_id_idx        on public.atencion (tipo_atencion_id);
create index if not exists bitacora_acceso_usuario_externo_idx  on public.bitacora_acceso (usuario_externo_id);
create index if not exists orden_proteccion_agresor_id_idx      on public.orden_proteccion (agresor_id);
create index if not exists nota_area_area_id_idx                on public.nota_area (area_id);
create index if not exists documento_tipo_documento_id_idx      on public.documento (tipo_documento_id);

-- ---------------------------------------------------------------------
-- 5. Funciones futuras: sin EXECUTE para PUBLIC ni anon por defecto.
--    El grant global a PUBLIC solo se revoca sin IN SCHEMA; el grant a
--    anon que agrega Supabase es por esquema.
-- ---------------------------------------------------------------------
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
