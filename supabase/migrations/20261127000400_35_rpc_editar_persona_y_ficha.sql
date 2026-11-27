-- =====================================================================
-- 35_rpc_editar_persona_y_ficha.sql (A-03 · Sprint 02)
-- Qué contiene:
--   1. Trigger de bitácora en public.ficha_servicio_solicitado
--      (registrar_cambio_ficha_servicio) para auditar INSERT ('crear')
--      y DELETE ('desactivar') con registro_id = ficha_id || ':' || area_id.
--      Cubre tanto actualizar_ficha() como el DELETE que realiza
--      crear_ficha_completa() al reutilizar una ficha incompleta.
--   2. RPC public.actualizar_persona(p_persona_id, p_actualizado_en, ...):
--      permiso 'expediente.escribir', bloqueo optimista (23505), rechazo
--      si tiene expediente archivado (23514), null = no cambiar, '' = borrar
--      opcional; nunca modifica curp, sexo, fecha/entidad ni activo.
--   3. RPC public.actualizar_ficha(p_ficha_id, p_actualizado_en, ...):
--      permiso 'expediente.escribir', bloqueo optimista (23505), rechazo
--      si está archivada (23514), sincroniza servicios solicitados
--      (mínimo 1); nunca modifica folio, persona_id, estado, aviso ni activo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trigger de bitácora para public.ficha_servicio_solicitado
-- ---------------------------------------------------------------------
create or replace function public.registrar_cambio_ficha_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion      public.accion_bitacora;
  v_registro_id text;
begin
  if tg_op = 'INSERT' then
    v_accion      := 'crear';
    v_registro_id := new.ficha_id::text || ':' || new.area_id::text;
  else
    v_accion      := 'desactivar';
    v_registro_id := old.ficha_id::text || ':' || old.area_id::text;
  end if;

  insert into public.bitacora_acceso (
    empleado_id,
    usuario_externo_id,
    accion,
    tabla_afectada,
    registro_id
  ) values (
    (select e.id from public.empleado e where e.id = auth.uid()),
    (select u.id from public.usuario_externo u where u.id = auth.uid()),
    v_accion,
    tg_table_name,
    v_registro_id
  );

  return null;
end;
$$;

revoke all on function public.registrar_cambio_ficha_servicio() from public, anon, authenticated;

drop trigger if exists ficha_servicio_solicitado_bitacora on public.ficha_servicio_solicitado;

create trigger ficha_servicio_solicitado_bitacora
  after insert or delete on public.ficha_servicio_solicitado
  for each row execute function public.registrar_cambio_ficha_servicio();

-- ---------------------------------------------------------------------
-- 2. RPC: public.actualizar_persona
-- ---------------------------------------------------------------------
create or replace function public.actualizar_persona(
  p_persona_id       uuid,
  p_actualizado_en   timestamptz,
  p_nombres          text default null,
  p_apellido_paterno text default null,
  p_apellido_materno text default null,
  p_celular          text default null,
  p_escolaridad      public.escolaridad_nivel default null,
  p_discapacidad     text default null,
  p_grupo_etnico     text default null,
  p_religion         text default null
)
returns table (
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
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona          public.persona%rowtype;
  v_nombres          text;
  v_apellido_paterno text;
  v_apellido_materno text;
  v_celular          text;
  v_discapacidad     text;
  v_grupo_etnico     text;
  v_religion         text;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para editar datos de la persona'
      using errcode = '42501';
  end if;

  if p_persona_id is null or p_actualizado_en is null then
    raise exception 'El identificador de persona y actualizado_en son obligatorios'
      using errcode = '23514';
  end if;

  select per.*
  into v_persona
  from public.persona per
  where per.id = p_persona_id
    and per.activo
  for update;

  if v_persona.id is null then
    raise exception 'Persona no encontrada o inactiva'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.ficha_registro fr
    where fr.persona_id = p_persona_id
      and fr.activo
      and fr.estado = 'archivado'
  ) then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  if v_persona.actualizado_en is distinct from p_actualizado_en then
    raise exception 'Este registro fue modificado por otra persona. Recarga los datos.'
      using errcode = '23505';
  end if;

  if p_nombres is not null then
    v_nombres := btrim(p_nombres);
    if char_length(v_nombres) < 1 or char_length(v_nombres) > 100 then
      raise exception 'El nombre debe tener entre 1 y 100 caracteres'
        using errcode = '23514';
    end if;
  else
    v_nombres := v_persona.nombres;
  end if;

  if p_apellido_paterno is not null then
    v_apellido_paterno := btrim(p_apellido_paterno);
    if char_length(v_apellido_paterno) < 1 or char_length(v_apellido_paterno) > 100 then
      raise exception 'El apellido paterno debe tener entre 1 y 100 caracteres'
        using errcode = '23514';
    end if;
  else
    v_apellido_paterno := v_persona.apellido_paterno;
  end if;

  if p_apellido_materno is null then
    v_apellido_materno := v_persona.apellido_materno;
  else
    v_apellido_materno := nullif(btrim(p_apellido_materno), '');
    if v_apellido_materno is not null and char_length(v_apellido_materno) > 100 then
      raise exception 'El apellido materno no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_celular is null then
    v_celular := v_persona.celular;
  else
    v_celular := nullif(btrim(p_celular), '');
    if v_celular is not null and v_celular !~ '^[0-9]{10}$' then
      raise exception 'El celular debe contener exactamente 10 dígitos'
        using errcode = '23514';
    end if;
  end if;

  if p_discapacidad is null then
    v_discapacidad := v_persona.discapacidad;
  else
    v_discapacidad := nullif(btrim(p_discapacidad), '');
    if v_discapacidad is not null and char_length(v_discapacidad) > 120 then
      raise exception 'La discapacidad no debe exceder 120 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_grupo_etnico is null then
    v_grupo_etnico := v_persona.grupo_etnico;
  else
    v_grupo_etnico := nullif(btrim(p_grupo_etnico), '');
    if v_grupo_etnico is not null and char_length(v_grupo_etnico) > 120 then
      raise exception 'El grupo étnico no debe exceder 120 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_religion is null then
    v_religion := v_persona.religion;
  else
    v_religion := nullif(btrim(p_religion), '');
    if v_religion is not null and char_length(v_religion) > 120 then
      raise exception 'La religión no debe exceder 120 caracteres'
        using errcode = '23514';
    end if;
  end if;

  return query
  update public.persona per
  set nombres          = v_nombres,
      apellido_paterno = v_apellido_paterno,
      apellido_materno = v_apellido_materno,
      celular          = v_celular,
      escolaridad      = coalesce(p_escolaridad, v_persona.escolaridad),
      discapacidad     = v_discapacidad,
      grupo_etnico     = v_grupo_etnico,
      religion         = v_religion
  where per.id = p_persona_id
  returning per.id,
            per.curp,
            per.nombres,
            per.apellido_paterno,
            per.apellido_materno,
            per.sexo,
            per.fecha_nacimiento,
            per.entidad_nacimiento,
            per.celular,
            per.escolaridad,
            per.discapacidad,
            per.grupo_etnico,
            per.religion,
            per.actualizado_en;
end;
$$;

revoke all on function public.actualizar_persona(
  uuid, timestamptz, text, text, text, text, public.escolaridad_nivel, text, text, text
) from public, anon;

grant execute on function public.actualizar_persona(
  uuid, timestamptz, text, text, text, text, public.escolaridad_nivel, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC: public.actualizar_ficha
-- ---------------------------------------------------------------------
create or replace function public.actualizar_ficha(
  p_ficha_id                       uuid,
  p_actualizado_en                 timestamptz,
  p_estado_civil                   public.estado_civil default null,
  p_ocupacion_id                   smallint default null,
  p_ocupacion_otra                 text default null,
  p_tiene_trabajo                  boolean default null,
  p_numero_hijas                   smallint default null,
  p_numero_hijos_hombres           smallint default null,
  p_servicio_medico                public.servicio_medico default null,
  p_servicio_medico_otro           text default null,
  p_tiene_embarazo                 boolean default null,
  p_tiene_denuncia                 boolean default null,
  p_es_victima_delito              boolean default null,
  p_tiene_consumo_droga            boolean default null,
  p_drogas                         public.tipo_droga[] default null,
  p_especificacion_droga           text default null,
  p_tiene_consumo_alcohol          boolean default null,
  p_servicios_solicitados_area_ids smallint[] default null
)
returns table (
  id                           uuid,
  folio                        text,
  persona_id                   uuid,
  estado                       public.estado_ficha,
  estado_civil                 public.estado_civil,
  ocupacion_id                 smallint,
  ocupacion_otra               text,
  tiene_trabajo                boolean,
  numero_hijas                 smallint,
  numero_hijos_hombres         smallint,
  servicio_medico              public.servicio_medico,
  servicio_medico_otro         text,
  tiene_embarazo               boolean,
  tiene_denuncia               boolean,
  es_victima_delito            boolean,
  tiene_consumo_droga          boolean,
  drogas                       public.tipo_droga[],
  especificacion_droga         text,
  tiene_consumo_alcohol        boolean,
  servicios_solicitados_area_ids smallint[],
  actualizado_en               timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_ficha                public.ficha_registro%rowtype;
  v_ocupacion_id         smallint;
  v_ocupacion_otra       text;
  v_numero_hijas         smallint;
  v_numero_hijos_hombres smallint;
  v_servicio_medico      public.servicio_medico;
  v_servicio_medico_otro text;
  v_tiene_consumo_droga  boolean;
  v_drogas               public.tipo_droga[];
  v_especificacion_droga text;
  v_area_ids             smallint[];
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para editar el expediente'
      using errcode = '42501';
  end if;

  if p_ficha_id is null or p_actualizado_en is null then
    raise exception 'El identificador del expediente y actualizado_en son obligatorios'
      using errcode = '23514';
  end if;

  select fr.*
  into v_ficha
  from public.ficha_registro fr
  where fr.id = p_ficha_id
    and fr.activo
  for update;

  if v_ficha.id is null then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  if v_ficha.actualizado_en is distinct from p_actualizado_en then
    raise exception 'Este registro fue modificado por otra persona. Recarga los datos.'
      using errcode = '23505';
  end if;

  if p_ocupacion_id is not null then
    if not exists (
      select 1
      from public.cat_ocupacion co
      where co.id = p_ocupacion_id
    ) then
      raise exception 'Ocupación no encontrada en catálogo'
        using errcode = '23514';
    end if;
    v_ocupacion_id := p_ocupacion_id;
  else
    v_ocupacion_id := v_ficha.ocupacion_id;
  end if;

  if p_ocupacion_otra is null then
    v_ocupacion_otra := v_ficha.ocupacion_otra;
  else
    v_ocupacion_otra := nullif(btrim(p_ocupacion_otra), '');
    if v_ocupacion_otra is not null and char_length(v_ocupacion_otra) > 150 then
      raise exception 'La especificación de ocupación no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  v_numero_hijas := coalesce(p_numero_hijas, v_ficha.numero_hijas);
  if v_numero_hijas is not null and (v_numero_hijas < 0 or v_numero_hijas > 30) then
    raise exception 'El número de hijas debe estar entre 0 y 30'
      using errcode = '23514';
  end if;

  v_numero_hijos_hombres := coalesce(p_numero_hijos_hombres, v_ficha.numero_hijos_hombres);
  if v_numero_hijos_hombres is not null and (v_numero_hijos_hombres < 0 or v_numero_hijos_hombres > 30) then
    raise exception 'El número de hijos debe estar entre 0 y 30'
      using errcode = '23514';
  end if;

  v_servicio_medico := coalesce(p_servicio_medico, v_ficha.servicio_medico);
  if p_servicio_medico_otro is null then
    v_servicio_medico_otro := v_ficha.servicio_medico_otro;
  else
    v_servicio_medico_otro := nullif(btrim(p_servicio_medico_otro), '');
    if v_servicio_medico_otro is not null and char_length(v_servicio_medico_otro) > 150 then
      raise exception 'El servicio médico especificado no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_servicio_medico is distinct from 'otro'::public.servicio_medico then
    if p_servicio_medico_otro is not null and v_servicio_medico_otro is not null then
      raise exception 'Solo especifica otro servicio médico cuando el servicio sea "otro"'
        using errcode = '23514';
    end if;
    v_servicio_medico_otro := null;
  end if;

  v_tiene_consumo_droga := coalesce(p_tiene_consumo_droga, v_ficha.tiene_consumo_droga);
  if p_drogas is null then
    v_drogas := v_ficha.drogas;
  else
    select array_agg(d_item order by idx)
    into v_drogas
    from (
      select distinct on (elem) elem as d_item, min(ord) as idx
      from unnest(p_drogas) with ordinality as u(elem, ord)
      where elem is not null
      group by elem
    ) s;
  end if;

  if p_especificacion_droga is null then
    v_especificacion_droga := v_ficha.especificacion_droga;
  else
    v_especificacion_droga := nullif(btrim(p_especificacion_droga), '');
    if v_especificacion_droga is not null and char_length(v_especificacion_droga) > 250 then
      raise exception 'La especificación de droga no debe exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if not coalesce(v_tiene_consumo_droga, false) then
    if (p_drogas is not null and cardinality(v_drogas) > 0)
       or (p_especificacion_droga is not null and v_especificacion_droga is not null) then
      raise exception 'No puedes registrar drogas si tiene_consumo_droga no es verdadero'
        using errcode = '23514';
    end if;
    v_drogas               := null;
    v_especificacion_droga := null;
  end if;

  if p_servicios_solicitados_area_ids is not null then
    select array_agg(distinct a_id order by a_id)
    into v_area_ids
    from unnest(p_servicios_solicitados_area_ids) as a_id
    where a_id is not null;

    if v_area_ids is null or cardinality(v_area_ids) = 0 then
      raise exception 'Debe indicar al menos un servicio solicitado válido'
        using errcode = '23514';
    end if;

    if (
      select count(*)
      from public.cat_area ca
      where ca.id = any(v_area_ids)
    ) <> cardinality(v_area_ids) then
      raise exception 'Alguno de los servicios solicitados no existe en cat_area'
        using errcode = '23514';
    end if;

    delete from public.ficha_servicio_solicitado fss
    where fss.ficha_id = p_ficha_id
      and not (fss.area_id = any(v_area_ids));

    insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
    select p_ficha_id, a_id, v_actor_id
    from unnest(v_area_ids) as a_id
    on conflict (ficha_id, area_id) do nothing;
  end if;

  return query
  with actualizado as (
    update public.ficha_registro fr
    set estado_civil          = coalesce(p_estado_civil, v_ficha.estado_civil),
        ocupacion_id          = v_ocupacion_id,
        ocupacion_otra        = v_ocupacion_otra,
        tiene_trabajo         = coalesce(p_tiene_trabajo, v_ficha.tiene_trabajo),
        numero_hijas          = v_numero_hijas,
        numero_hijos_hombres  = v_numero_hijos_hombres,
        servicio_medico       = v_servicio_medico,
        servicio_medico_otro  = v_servicio_medico_otro,
        tiene_embarazo        = coalesce(p_tiene_embarazo, v_ficha.tiene_embarazo),
        tiene_denuncia        = coalesce(p_tiene_denuncia, v_ficha.tiene_denuncia),
        es_victima_delito     = coalesce(p_es_victima_delito, v_ficha.es_victima_delito),
        tiene_consumo_droga   = v_tiene_consumo_droga,
        drogas                = v_drogas,
        especificacion_droga  = v_especificacion_droga,
        tiene_consumo_alcohol = coalesce(p_tiene_consumo_alcohol, v_ficha.tiene_consumo_alcohol)
    where fr.id = p_ficha_id
    returning fr.*
  )
  select
    act.id,
    act.folio,
    act.persona_id,
    act.estado,
    act.estado_civil,
    act.ocupacion_id,
    act.ocupacion_otra,
    act.tiene_trabajo,
    act.numero_hijas,
    act.numero_hijos_hombres,
    act.servicio_medico,
    act.servicio_medico_otro,
    act.tiene_embarazo,
    act.tiene_denuncia,
    act.es_victima_delito,
    act.tiene_consumo_droga,
    act.drogas,
    act.especificacion_droga,
    act.tiene_consumo_alcohol,
    coalesce(
      (
        select array_agg(fss.area_id order by fss.area_id)
        from public.ficha_servicio_solicitado fss
        where fss.ficha_id = act.id
      ),
      '{}'::smallint[]
    ) as servicios_solicitados_area_ids,
    act.actualizado_en
  from actualizado act;
end;
$$;

revoke all on function public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, boolean, public.tipo_droga[],
  text, boolean, smallint[]
) from public, anon;

grant execute on function public.actualizar_ficha(
  uuid, timestamptz, public.estado_civil, smallint, text, boolean, smallint, smallint,
  public.servicio_medico, text, boolean, boolean, boolean, boolean, public.tipo_droga[],
  text, boolean, smallint[]
) to authenticated;
