-- =====================================================================
-- 40_agenda_permisos_creacion.sql
-- Regla de producto para la agenda de citas (decisión de negocio):
--   * CREAR citas: solo `recepcion` (áreas trabajo_social, psicologia y
--     juridico) y `juridico` (únicamente el área jurídico). Nadie más
--     (titular, subdireccion, trabajo_social, psicologia) puede crear.
--   * Recepción pasa a ver y gestionar (confirmar / cancelar / no_asistio
--     / reagendar) también las citas de Jurídico.
--   * Reagendar equivale a crear (genera una cita nueva): sigue la misma
--     regla de creación. Titular, subdirección, TS y Psicología ya no
--     pueden reagendar; sí pueden confirmar/cancelar según su alcance.
--   * Registrar seguimiento con `p_proxima_cita_en` también crea una
--     cita: solo se permite si el actor puede crear en su área (hoy solo
--     Jurídico). TS/Psicología deben solicitar la cita a Recepción.
--   * Lectura sin cambios por rol, salvo Recepción (+ juridico).
--   * Las citas UMECA (origen = 'umeca') no cambian: get_umeca_citas()
--     no se modifica.
-- Qué contiene:
--   1. public.tiene_permiso(): nueva clave `agenda.crear` (recepcion,
--      juridico). Conserva todas las claves vigentes.
--   2. public.puede_crear_cita_en_area(smallint): helper de alcance.
--   3. Políticas RLS cita_select / cita_insert / cita_update.
--   4. RPCs get_agenda, cambiar_estado_cita, reagendar_cita y
--      registrar_seguimiento (reemplazan las definiciones de 19, 22, 23).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. tiene_permiso(): agrega agenda.crear
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
    when 'orden_proteccion.escribir'  then public.es_direccion() or public.auth_rol() in ('juridico', 'trabajo_social')

    -- Agenda, urgencias y derivaciones (canalizaciones)
    when 'agenda.ver'                 then public.es_empleado_activo()
    when 'agenda.gestionar'           then public.es_empleado_activo()
    when 'agenda.crear'               then public.auth_rol() in ('recepcion', 'juridico')
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
-- 2. Helper: ¿el actor puede crear una cita en el área indicada?
--    recepcion -> trabajo_social, psicologia, juridico
--    juridico  -> solo su propia área (jurídico)
-- ---------------------------------------------------------------------
create or replace function public.puede_crear_cita_en_area(p_area_id smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.tiene_permiso('agenda.crear')
    and p_area_id is not null
    and (
      (
        public.auth_rol() = 'recepcion'
        and p_area_id in (
          public.area_id_por_clave('trabajo_social'),
          public.area_id_por_clave('psicologia'),
          public.area_id_por_clave('juridico')
        )
      )
      or (
        public.auth_rol() = 'juridico'
        and p_area_id = public.area_id_por_clave('juridico')
        and p_area_id = public.auth_area_id()
      )
    ),
    false
  );
$$;

revoke all on function public.puede_crear_cita_en_area(smallint) from public, anon;
grant execute on function public.puede_crear_cita_en_area(smallint) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Políticas RLS de public.cita
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
        (select public.auth_rol()) = 'recepcion'
        and area_id in (
          (select public.area_id_por_clave('trabajo_social')),
          (select public.area_id_por_clave('psicologia')),
          (select public.area_id_por_clave('juridico'))
        )
      )
      or (
        (select public.auth_rol()) = 'trabajo_social'
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

-- Crear: solo recepcion (3 áreas) y juridico (su área). Sin Dirección.
create policy cita_insert on public.cita
  for insert to authenticated
  with check (
    (select public.tiene_permiso('agenda.crear'))
    and (select public.puede_crear_cita_en_area(area_id))
  );

-- Actualizar (confirmar / cancelar / reagendar vía RPC): Dirección, recepcion
-- (3 áreas) y cada área de atención sobre su propia agenda.
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
          (select public.area_id_por_clave('psicologia')),
          (select public.area_id_por_clave('juridico'))
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
          (select public.area_id_por_clave('psicologia')),
          (select public.area_id_por_clave('juridico'))
        )
      )
      or (
        (select public.es_area_atencion())
        and area_id = (select public.auth_area_id())
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4a. get_agenda / cambiar_estado_cita: Recepción incluye Jurídico
-- ---------------------------------------------------------------------
create or replace function public.get_agenda(
  p_desde   timestamptz,
  p_hasta   timestamptz,
  p_area_id smallint default null,
  p_estados public.estado_cita[] default null,
  p_limite  int default 200
)
returns table (
  cita_id         uuid,
  programada_en   timestamptz,
  estado          public.estado_cita,
  prioridad       public.prioridad_nivel,
  area_id         smallint,
  area_clave      text,
  recomendada_por text,
  reagendada_de   uuid,
  origen          public.origen_cita,
  persona_id      uuid,
  nombre_completo text,
  celular         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rol      public.rol_empleado;
  v_area_id  smallint;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para consultar la agenda' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Sin permiso para consultar la agenda' using errcode = '42501';
  end if;

  if p_desde is null or p_hasta is null or p_hasta <= p_desde then
    raise exception 'El rango de fechas de la agenda es inválido' using errcode = '23514';
  end if;

  if (p_hasta - p_desde) > interval '31 days' then
    raise exception 'El rango de consulta de agenda no puede superar 31 días' using errcode = '23514';
  end if;

  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'El límite de citas debe estar entre 1 y 200' using errcode = '23514';
  end if;

  return query
  select
    c.id as cita_id,
    c.programada_en,
    c.estado,
    c.prioridad,
    c.area_id,
    a.clave as area_clave,
    c.recomendada_por,
    c.reagendada_de,
    c.origen,
    c.persona_id,
    concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
    p.celular
  from public.cita c
  join public.cat_area a on a.id = c.area_id
  join public.persona p on p.id = c.persona_id
  where c.activo
    and c.programada_en >= p_desde
    and c.programada_en < p_hasta
    and (p_area_id is null or c.area_id = p_area_id)
    and (p_estados is null or c.estado = any(p_estados))
    and (
      v_rol in ('titular', 'subdireccion')
      or (v_rol = 'recepcion' and a.clave in ('trabajo_social', 'psicologia', 'juridico'))
      or (v_rol = 'trabajo_social' and a.clave in ('trabajo_social', 'psicologia'))
      or (v_rol in ('psicologia', 'juridico') and c.area_id = v_area_id)
    )
  order by c.programada_en asc
  limit p_limite;
end;
$$;

revoke execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) from public, anon;
grant  execute on function public.get_agenda(timestamptz, timestamptz, smallint, public.estado_cita[], int) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC: public.cambiar_estado_cita(p_cita_id, p_estado, p_motivo)
-- ---------------------------------------------------------------------
create or replace function public.cambiar_estado_cita(
  p_cita_id uuid,
  p_estado  public.estado_cita,
  p_motivo  text default null
)
returns table (
  cita_id       uuid,
  estado        public.estado_cita,
  confirmada_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id      uuid := auth.uid();
  v_rol           public.rol_empleado;
  v_area_id       smallint;
  v_cita          record;
  v_confirmada_en timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para gestionar citas' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico')
     or not public.tiene_permiso('agenda.gestionar') then
    raise exception 'Sin permiso para gestionar citas' using errcode = '42501';
  end if;

  if p_cita_id is null or p_estado is null
     or p_estado not in ('confirmada', 'cancelada', 'no_asistio') then
    raise exception 'Cita y estado destino válido (confirmada, cancelada, no_asistio) son obligatorios'
      using errcode = '23514';
  end if;

  if p_motivo is not null and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo de cancelación no puede exceder 500 caracteres' using errcode = '23514';
  end if;

  select c.id, c.estado, c.area_id, a.clave as area_clave, c.confirmada_en
  into v_cita
  from public.cita c
  join public.cat_area a on a.id = c.area_id
  where c.id = p_cita_id
    and c.activo
  for update;

  if v_cita.id is null then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if v_rol = 'recepcion' and v_cita.area_clave not in ('trabajo_social', 'psicologia', 'juridico') then
    raise exception 'Recepción solo puede gestionar citas de Trabajo Social, Psicología o Jurídico'
      using errcode = '42501';
  elsif v_rol in ('trabajo_social', 'psicologia', 'juridico')
        and v_cita.area_id is distinct from v_area_id then
    raise exception 'Sin permiso para modificar citas de otra área' using errcode = '42501';
  end if;

  if not (
    (v_cita.estado = 'agendada' and p_estado in ('confirmada', 'cancelada', 'no_asistio'))
    or (v_cita.estado = 'confirmada' and p_estado in ('cancelada', 'no_asistio'))
  ) then
    raise exception 'Transición de estado de cita no permitida: % -> %', v_cita.estado, p_estado
      using errcode = '23514';
  end if;

  update public.cita c
  set estado = p_estado,
      confirmada_en = case
        when p_estado = 'confirmada' then now()
        else c.confirmada_en
      end,
      motivo_cancelacion = case
        when p_estado = 'cancelada' then nullif(btrim(coalesce(p_motivo, '')), '')
        else c.motivo_cancelacion
      end
  where c.id = p_cita_id
  returning c.confirmada_en into v_confirmada_en;

  return query select p_cita_id, p_estado, v_confirmada_en;
end;
$$;

revoke execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) from public, anon;
grant  execute on function public.cambiar_estado_cita(uuid, public.estado_cita, text) to authenticated;
-- ---------------------------------------------------------------------
-- 4b. reagendar_cita: reagendar = crear (agenda.crear + alcance por área)
-- ---------------------------------------------------------------------
create or replace function public.reagendar_cita(
  p_cita_id     uuid,
  p_nueva_fecha timestamptz,
  p_motivo      text default null,
  p_prioridad   public.prioridad_nivel default null
)
returns table (
  cita_anterior_id uuid,
  cita_nueva_id    uuid,
  programada_en    timestamptz,
  estado           public.estado_cita
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rol      public.rol_empleado;
  v_area_id  smallint;
  v_cita     record;
  v_nueva_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Sin permiso para reagendar citas' using errcode = '42501';
  end if;

  select e.rol, e.area_id
  into v_rol, v_area_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_rol is null
     or v_rol not in ('titular', 'subdireccion', 'recepcion', 'trabajo_social', 'psicologia', 'juridico')
     or not public.tiene_permiso('agenda.crear') then
    -- Reagendar crea una cita nueva: solo recepcion y juridico (agenda.crear).
    raise exception 'Sin permiso para reagendar citas' using errcode = '42501';
  end if;

  if p_cita_id is null or p_nueva_fecha is null then
    raise exception 'La cita y la nueva fecha son obligatorias' using errcode = '23514';
  end if;

  if p_nueva_fecha <= now() then
    raise exception 'La nueva fecha de la cita debe estar en el futuro' using errcode = '23514';
  end if;

  if p_motivo is not null and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo no puede exceder 500 caracteres' using errcode = '23514';
  end if;

  select c.id, c.persona_id, c.area_id, a.clave as area_clave,
         c.estado, c.prioridad, c.recomendada_por, c.origen
  into v_cita
  from public.cita c
  join public.cat_area a on a.id = c.area_id
  where c.id = p_cita_id
    and c.activo
  for update;

  if v_cita.id is null then
    raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
  end if;

  if not public.puede_crear_cita_en_area(v_cita.area_id) then
    raise exception 'Sin permiso para reagendar citas de esta área' using errcode = '42501';
  end if;

  if v_cita.estado = 'reagendada'
     or exists (select 1 from public.cita c2 where c2.reagendada_de = p_cita_id) then
    raise exception 'Esta cita ya fue reagendada anteriormente' using errcode = '23505';
  end if;

  if v_cita.estado not in ('agendada', 'confirmada') then
    raise exception 'Solo se pueden reagendar citas agendadas o confirmadas (estado actual: %)', v_cita.estado
      using errcode = '23514';
  end if;

  update public.cita c
  set estado = 'reagendada',
      motivo_cancelacion = coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), c.motivo_cancelacion)
  where c.id = p_cita_id;

  insert into public.cita (
    persona_id,
    area_id,
    programada_en,
    estado,
    prioridad,
    recomendada_por,
    origen,
    reagendada_de,
    creado_por
  ) values (
    v_cita.persona_id,
    v_cita.area_id,
    p_nueva_fecha,
    'agendada',
    coalesce(p_prioridad, v_cita.prioridad),
    v_cita.recomendada_por,
    v_cita.origen,
    p_cita_id,
    v_actor_id
  )
  returning id into v_nueva_id;

  return query select p_cita_id, v_nueva_id, p_nueva_fecha, 'agendada'::public.estado_cita;
end;
$$;

revoke execute on function public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel) from public, anon;
grant  execute on function public.reagendar_cita(uuid, timestamptz, text, public.prioridad_nivel) to authenticated;


-- ---------------------------------------------------------------------
-- 4c. registrar_seguimiento: la próxima cita respeta la regla de creación
-- ---------------------------------------------------------------------
create or replace function public.registrar_seguimiento(
  p_ficha_id            uuid,
  p_cita_id             uuid default null,
  p_tipo_atencion_id    smallint default null,
  p_acciones_realizadas text default null,
  p_proxima_accion      text default null,
  p_prioridad           public.prioridad_nivel default null,
  p_observaciones       text default null,
  p_proxima_cita_en     timestamptz default null
)
returns table (
  atencion_id             uuid,
  cita_proxima_id         uuid,
  es_primera_vez_area     boolean,
  tiene_historial_clinico boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id              uuid := auth.uid();
  v_area_id               smallint;
  v_ficha                 record;
  v_cita                  record;
  v_celular               text;
  v_domicilio_id          uuid;
  v_es_primera_vez        boolean;
  v_tiene_historial       boolean;
  v_atencion_id           uuid;
  v_cita_proxima_id       uuid;
begin
  if not public.tiene_permiso('seguimiento.registrar') then
    raise exception 'Sin permiso para registrar seguimiento' using errcode = '42501';
  end if;

  v_area_id := public.auth_area_id();
  if v_area_id is null then
    raise exception 'El actor no tiene área asignada' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  select f.id, f.persona_id, f.estado, f.estado_civil, f.ocupacion_id, f.ocupacion_otra
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if p_tipo_atencion_id is null or not exists (
    select 1
    from public.cat_tipo_atencion ta
    where ta.id = p_tipo_atencion_id
      and ta.area_id = v_area_id
  ) then
    raise exception 'El tipo de atención no corresponde al área del actor' using errcode = '23514';
  end if;

  if p_cita_id is not null then
    select c.id, c.persona_id, c.area_id, c.estado
    into v_cita
    from public.cita c
    where c.id = p_cita_id
      and c.activo;

    if not found then
      raise exception 'Cita no encontrada o inactiva' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.atencion a
      where a.cita_id = p_cita_id
    ) then
      raise exception 'Esta cita ya cuenta con una hoja de seguimiento registrada' using errcode = '23505';
    end if;

    if v_cita.persona_id <> v_ficha.persona_id then
      raise exception 'La cita no pertenece a la persona de este expediente' using errcode = '23514';
    end if;

    if v_cita.area_id <> v_area_id then
      raise exception 'La cita no pertenece al área del actor' using errcode = '23514';
    end if;

    if v_cita.estado not in ('agendada', 'confirmada') then
      raise exception 'Solo se puede registrar seguimiento sobre citas agendadas o confirmadas' using errcode = '23514';
    end if;
  end if;

  -- Agendar la próxima cita es crear una cita: solo recepcion y juridico (su área).
  if p_proxima_cita_en is not null and not public.puede_crear_cita_en_area(v_area_id) then
    raise exception 'Sin permiso para agendar la próxima cita; solicítela a Recepción'
      using errcode = '42501';
  end if;

  if p_proxima_cita_en is not null and p_proxima_cita_en <= now() then
    raise exception 'La fecha de la próxima cita debe ser futura' using errcode = '23514';
  end if;

  -- Evaluar antes de insertar la nueva atención (RN-19)
  v_es_primera_vez := not exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.area_id = v_area_id
      and a.activo
  );

  if p_cita_id is not null then
    update public.cita c
    set estado = 'asistio'
    where c.id = p_cita_id;
  end if;

  select p.celular
  into v_celular
  from public.persona p
  where p.id = v_ficha.persona_id;

  select d.id
  into v_domicilio_id
  from public.domicilio d
  where d.persona_id = v_ficha.persona_id
    and d.activo
    and d.es_actual
  limit 1;

  insert into public.atencion (
    ficha_id,
    cita_id,
    area_id,
    tipo_atencion_id,
    atendida_por,
    estado_civil,
    ocupacion_id,
    ocupacion_otra,
    celular,
    domicilio_id,
    acciones_realizadas,
    proxima_accion,
    prioridad,
    observaciones,
    creado_por
  ) values (
    v_ficha.id,
    p_cita_id,
    v_area_id,
    p_tipo_atencion_id,
    v_actor_id,
    v_ficha.estado_civil,
    v_ficha.ocupacion_id,
    v_ficha.ocupacion_otra,
    v_celular,
    v_domicilio_id,
    nullif(btrim(coalesce(p_acciones_realizadas, '')), ''),
    nullif(btrim(coalesce(p_proxima_accion, '')), ''),
    p_prioridad,
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    v_actor_id
  )
  returning id into v_atencion_id;

  if v_ficha.estado = 'abierto' then
    update public.ficha_registro f
    set estado = 'en_seguimiento'
    where f.id = v_ficha.id;
  end if;

  if p_proxima_cita_en is not null then
    insert into public.cita (
      persona_id,
      area_id,
      programada_en,
      estado,
      origen,
      creado_por
    ) values (
      v_ficha.persona_id,
      v_area_id,
      p_proxima_cita_en,
      'agendada',
      'regular',
      v_actor_id
    )
    returning id into v_cita_proxima_id;
  end if;

  v_tiene_historial := exists (
    select 1
    from public.historial_clinico hc
    where hc.ficha_id = v_ficha.id
      and hc.activo
  );

  return query select v_atencion_id, v_cita_proxima_id, v_es_primera_vez, v_tiene_historial;
end;
$$;

revoke execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) from public, anon;
grant  execute on function public.registrar_seguimiento(uuid, uuid, smallint, text, text, public.prioridad_nivel, text, timestamptz) to authenticated;
