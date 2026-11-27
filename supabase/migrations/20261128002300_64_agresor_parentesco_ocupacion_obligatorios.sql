-- =====================================================================
-- 64_agresor_parentesco_ocupacion_obligatorios.sql
-- Qué contiene:
--   Actualiza public.guardar_agresor(...) (definición vigente en 58):
--   al crear una persona agresora (p_agresor_id is null) exige
--   p_parentesco_id y p_ocupacion_id (23514). La regla se evalúa después de
--   las demás validaciones y justo antes del INSERT, de modo que el resto de
--   errores conserva su prioridad.
--   - La edición (p_agresor_id not null) NO cambia: agresores previos sin
--     parentesco/ocupación siguen siendo editables.
--   - Una ficha sin persona agresora sigue siendo válida (no se llama la RPC).
-- =====================================================================

create or replace function public.guardar_agresor(
  p_agresor_id           uuid default null,
  p_ficha_id             uuid default null,
  p_actualizado_en       timestamptz default null,
  p_nombres              text default null,
  p_apellido_paterno     text default null,
  p_apellido_materno     text default null,
  p_edad                 smallint default null,
  p_fecha_nacimiento     date default null,
  p_entidad_nacimiento   text default null,
  p_sexo                 public.sexo_biologico default null,
  p_estado_civil         public.estado_civil default null,
  p_curp                 text default null,
  p_parentesco_id        smallint default null,
  p_parentesco_otro      text default null,
  p_asentamiento_id      integer default null,
  p_codigo_postal        text default null,
  p_calle                text default null,
  p_numero_exterior      text default null,
  p_numero_interior      text default null,
  p_referencias          text default null,
  p_zona                 public.zona_geografica default null,
  p_ocupacion_id         smallint default null,
  p_ocupacion_otra       text default null,
  p_tipo_trabajo         public.tipo_trabajo default null,
  p_drogas               public.tipo_droga[] default null,
  p_especificacion_droga text default null,
  p_consumo_alcohol      public.consumo_alcohol default null,
  p_especificacion_arma  text default null,
  p_observaciones        text default null
)
returns table (
  id                   uuid,
  ficha_id             uuid,
  nombres              text,
  apellido_paterno     text,
  apellido_materno     text,
  edad                 smallint,
  fecha_nacimiento     date,
  entidad_nacimiento   text,
  sexo                 public.sexo_biologico,
  estado_civil         public.estado_civil,
  curp                 text,
  parentesco_id        smallint,
  parentesco_otro      text,
  asentamiento_id      integer,
  codigo_postal        text,
  calle                text,
  numero_exterior      text,
  numero_interior      text,
  referencias          text,
  zona                 public.zona_geografica,
  ocupacion_id         smallint,
  ocupacion_otra       text,
  tipo_trabajo         public.tipo_trabajo,
  drogas               public.tipo_droga[],
  especificacion_droga text,
  consumo_alcohol      public.consumo_alcohol,
  especificacion_arma  text,
  observaciones        text,
  activo               boolean,
  actualizado_en       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id             uuid := auth.uid();
  v_actual               public.agresor%rowtype;
  v_ficha_id             uuid;
  v_ficha                record;
  v_nombres              text;
  v_apellido_paterno     text;
  v_apellido_materno     text;
  v_edad                 smallint;
  v_fecha_nacimiento     date;
  v_entidad_nacimiento   text;
  v_curp                 text;
  v_parentesco_id        smallint;
  v_parentesco_clave     text;
  v_parentesco_otro      text;
  v_asentamiento_id      integer;
  v_codigo_postal        text;
  v_calle                text;
  v_numero_exterior      text;
  v_numero_interior      text;
  v_referencias          text;
  v_ocupacion_id         smallint;
  v_ocupacion_otra       text;
  v_drogas               public.tipo_droga[];
  v_especificacion_droga text;
  v_especificacion_arma  text;
  v_observaciones        text;
begin
  if not public.tiene_permiso('agresor.acceder') then
    raise exception 'Sin permiso para gestionar datos de la persona agresora'
      using errcode = '42501';
  end if;

  if p_agresor_id is null then
    if p_ficha_id is null then
      raise exception 'El expediente (p_ficha_id) es obligatorio al registrar agresor'
        using errcode = '23514';
    end if;
    v_ficha_id := p_ficha_id;

    v_nombres := nullif(btrim(coalesce(p_nombres, '')), '');
    if v_nombres is not null and char_length(v_nombres) > 100 then
      raise exception 'El nombre de la persona agresora no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  else
    if p_actualizado_en is null then
      raise exception 'actualizado_en es obligatorio al editar un agresor'
        using errcode = '23514';
    end if;

    select ag.*
    into v_actual
    from public.agresor ag
    where ag.id = p_agresor_id
      and ag.activo
    for update;

    if v_actual.id is null then
      raise exception 'Persona agresora no encontrada o inactiva'
        using errcode = '23514';
    end if;

    if p_ficha_id is not null and p_ficha_id is distinct from v_actual.ficha_id then
      raise exception 'No se puede cambiar el expediente asociado al agresor'
        using errcode = '23514';
    end if;

    v_ficha_id := v_actual.ficha_id;
  end if;

  select fr.id, fr.estado
  into v_ficha
  from public.ficha_registro fr
  where fr.id = v_ficha_id
    and fr.activo;

  if v_ficha.id is null then
    raise exception 'Expediente no encontrado o inactivo'
      using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'Reabre el expediente para editarlo'
      using errcode = '23514';
  end if;

  if p_agresor_id is not null and v_actual.actualizado_en is distinct from p_actualizado_en then
    raise exception 'Este registro fue modificado por otra persona. Recarga los datos.'
      using errcode = '23505';
  end if;

  if p_agresor_id is not null then
    if p_nombres is not null then
      v_nombres := nullif(btrim(p_nombres), '');
      if v_nombres is not null and char_length(v_nombres) > 100 then
        raise exception 'El nombre de la persona agresora no debe exceder 100 caracteres'
          using errcode = '23514';
      end if;
    else
      v_nombres := v_actual.nombres;
    end if;
  end if;

  if p_apellido_paterno is null then
    v_apellido_paterno := v_actual.apellido_paterno;
  else
    v_apellido_paterno := nullif(btrim(p_apellido_paterno), '');
    if v_apellido_paterno is not null and char_length(v_apellido_paterno) > 100 then
      raise exception 'El apellido paterno no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_apellido_materno is null then
    v_apellido_materno := v_actual.apellido_materno;
  else
    v_apellido_materno := nullif(btrim(p_apellido_materno), '');
    if v_apellido_materno is not null and char_length(v_apellido_materno) > 100 then
      raise exception 'El apellido materno no debe exceder 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  v_edad := coalesce(p_edad, v_actual.edad);
  if v_edad is not null and (v_edad < 0 or v_edad > 120) then
    raise exception 'La edad debe estar entre 0 y 120 años'
      using errcode = '23514';
  end if;

  v_fecha_nacimiento := coalesce(p_fecha_nacimiento, v_actual.fecha_nacimiento);
  if v_fecha_nacimiento is not null and v_fecha_nacimiento > current_date then
    raise exception 'La fecha de nacimiento no puede ser futura'
      using errcode = '23514';
  end if;

  if p_entidad_nacimiento is null then
    v_entidad_nacimiento := v_actual.entidad_nacimiento;
  else
    v_entidad_nacimiento := nullif(upper(btrim(p_entidad_nacimiento)), '');
    if v_entidad_nacimiento is not null and v_entidad_nacimiento not in (
      'AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG',
      'JC','MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR',
      'TC','TS','TL','VZ','YN','ZS','NE'
    ) then
      raise exception 'Clave de entidad de nacimiento inválida'
        using errcode = '23514';
    end if;
  end if;

  if p_curp is null then
    v_curp := v_actual.curp;
  else
    v_curp := nullif(upper(btrim(p_curp)), '');
    if v_curp is not null and v_curp !~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$' then
      raise exception 'La CURP no tiene un formato válido'
        using errcode = '23514';
    end if;
  end if;

  if p_parentesco_id is not null then
    select cp.clave
    into v_parentesco_clave
    from public.cat_parentesco cp
    where cp.id = p_parentesco_id;

    if v_parentesco_clave is null then
      raise exception 'Parentesco no encontrado en catálogo'
        using errcode = '23514';
    end if;
    v_parentesco_id := p_parentesco_id;
  else
    v_parentesco_id := v_actual.parentesco_id;
    if v_parentesco_id is not null then
      select cp.clave
      into v_parentesco_clave
      from public.cat_parentesco cp
      where cp.id = v_parentesco_id;
    end if;
  end if;

  if p_parentesco_otro is null then
    v_parentesco_otro := v_actual.parentesco_otro;
  else
    v_parentesco_otro := nullif(btrim(p_parentesco_otro), '');
    if v_parentesco_otro is not null and char_length(v_parentesco_otro) > 120 then
      raise exception 'La especificación de parentesco no debe exceder 120 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_parentesco_clave is distinct from 'otro' then
    if p_parentesco_otro is not null and v_parentesco_otro is not null then
      raise exception 'Solo especifica otro parentesco cuando el parentesco sea "otro"'
        using errcode = '23514';
    end if;
    v_parentesco_otro := null;
  end if;

  if p_codigo_postal is null then
    v_codigo_postal := null;
  else
    v_codigo_postal := nullif(btrim(p_codigo_postal), '');
    if v_codigo_postal is not null and v_codigo_postal !~ '^[0-9]{5}$' then
      raise exception 'El código postal debe contener exactamente 5 dígitos'
        using errcode = '23514';
    end if;
  end if;

  if p_asentamiento_id is not null and v_codigo_postal is not null then
    raise exception 'Indica un asentamiento del catálogo o un código postal manual, no ambos'
      using errcode = '23514';
  elsif p_asentamiento_id is not null then
    if not exists (
      select 1
      from public.cat_asentamiento ca
      where ca.id = p_asentamiento_id
    ) then
      raise exception 'Asentamiento no encontrado en catálogo'
        using errcode = '23514';
    end if;
    v_asentamiento_id := p_asentamiento_id;
    v_codigo_postal   := null;
  elsif p_codigo_postal is not null then
    if v_codigo_postal is not null then
      v_asentamiento_id := null;
    else
      v_asentamiento_id := v_actual.asentamiento_id;
    end if;
  else
    v_asentamiento_id := v_actual.asentamiento_id;
    v_codigo_postal   := v_actual.codigo_postal;
  end if;

  if p_calle is null then
    v_calle := v_actual.calle;
  else
    v_calle := nullif(btrim(p_calle), '');
    if v_calle is not null and char_length(v_calle) > 150 then
      raise exception 'La calle no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_numero_exterior is null then
    v_numero_exterior := v_actual.numero_exterior;
  else
    v_numero_exterior := nullif(btrim(p_numero_exterior), '');
    if v_numero_exterior is not null and char_length(v_numero_exterior) > 30 then
      raise exception 'El número exterior no debe exceder 30 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_numero_interior is null then
    v_numero_interior := v_actual.numero_interior;
  else
    v_numero_interior := nullif(btrim(p_numero_interior), '');
    if v_numero_interior is not null and char_length(v_numero_interior) > 30 then
      raise exception 'El número interior no debe exceder 30 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_referencias is null then
    v_referencias := v_actual.referencias;
  else
    v_referencias := nullif(btrim(p_referencias), '');
    if v_referencias is not null and char_length(v_referencias) > 250 then
      raise exception 'Las referencias no deben exceder 250 caracteres'
        using errcode = '23514';
    end if;
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
    v_ocupacion_id := v_actual.ocupacion_id;
  end if;

  if p_ocupacion_otra is null then
    v_ocupacion_otra := v_actual.ocupacion_otra;
  else
    v_ocupacion_otra := nullif(btrim(p_ocupacion_otra), '');
    if v_ocupacion_otra is not null and char_length(v_ocupacion_otra) > 150 then
      raise exception 'La especificación de ocupación no debe exceder 150 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_drogas is null then
    v_drogas := v_actual.drogas;
  else
    select array_agg(d_item order by idx)
    into v_drogas
    from (
      select distinct on (elem) elem as d_item, min(ord) as idx
      from unnest(p_drogas) with ordinality as u(elem, ord)
      where elem is not null
      group by elem
    ) s;

    if v_drogas is not null
       and 'no_consume'::public.tipo_droga = any(v_drogas)
       and cardinality(v_drogas) > 1 then
      raise exception 'Si seleccionas "no_consume", no puedes seleccionar otras drogas'
        using errcode = '23514';
    end if;
  end if;

  if p_especificacion_droga is null then
    v_especificacion_droga := v_actual.especificacion_droga;
  else
    v_especificacion_droga := nullif(btrim(p_especificacion_droga), '');
    if v_especificacion_droga is not null and char_length(v_especificacion_droga) > 250 then
      raise exception 'La especificación de droga no debe exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if v_drogas is null
     or coalesce(cardinality(v_drogas), 0) = 0
     or 'no_consume'::public.tipo_droga = any(v_drogas) then
    if p_especificacion_droga is not null and v_especificacion_droga is not null then
      raise exception 'No puedes especificar droga cuando no hay consumo o se seleccionó "no_consume"'
        using errcode = '23514';
    end if;
    v_especificacion_droga := null;
  end if;

  if p_especificacion_arma is null then
    v_especificacion_arma := v_actual.especificacion_arma;
  else
    v_especificacion_arma := nullif(btrim(p_especificacion_arma), '');
    if v_especificacion_arma is not null and char_length(v_especificacion_arma) > 250 then
      raise exception 'La especificación de arma no debe exceder 250 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_observaciones is null then
    v_observaciones := v_actual.observaciones;
  else
    v_observaciones := nullif(btrim(p_observaciones), '');
    if v_observaciones is not null and char_length(v_observaciones) > 5000 then
      raise exception 'Las observaciones no deben exceder 5000 caracteres'
        using errcode = '23514';
    end if;
  end if;

  -- Alta: si se registra a la persona agresora, el parentesco con la usuaria y la ocupación son obligatorios.
  if p_agresor_id is null then
    if v_parentesco_id is null then
      raise exception 'El parentesco con la usuaria es obligatorio al registrar a la persona agresora'
        using errcode = '23514';
    end if;
    if v_ocupacion_id is null then
      raise exception 'La ocupación es obligatoria al registrar a la persona agresora'
        using errcode = '23514';
    end if;
  end if;

  if p_agresor_id is null then
    return query
    insert into public.agresor as ag (
      ficha_id,
      nombres,
      apellido_paterno,
      apellido_materno,
      edad,
      fecha_nacimiento,
      entidad_nacimiento,
      sexo,
      estado_civil,
      curp,
      parentesco_id,
      parentesco_otro,
      asentamiento_id,
      codigo_postal,
      calle,
      numero_exterior,
      numero_interior,
      referencias,
      zona,
      ocupacion_id,
      ocupacion_otra,
      tipo_trabajo,
      drogas,
      especificacion_droga,
      consumo_alcohol,
      especificacion_arma,
      observaciones,
      creado_por
    ) values (
      v_ficha_id,
      v_nombres,
      v_apellido_paterno,
      v_apellido_materno,
      v_edad,
      v_fecha_nacimiento,
      v_entidad_nacimiento,
      p_sexo,
      p_estado_civil,
      v_curp,
      v_parentesco_id,
      v_parentesco_otro,
      v_asentamiento_id,
      v_codigo_postal,
      v_calle,
      v_numero_exterior,
      v_numero_interior,
      v_referencias,
      p_zona,
      v_ocupacion_id,
      v_ocupacion_otra,
      p_tipo_trabajo,
      v_drogas,
      v_especificacion_droga,
      p_consumo_alcohol,
      v_especificacion_arma,
      v_observaciones,
      v_actor_id
    )
    returning ag.id, ag.ficha_id, ag.nombres, ag.apellido_paterno, ag.apellido_materno,
              ag.edad, ag.fecha_nacimiento, ag.entidad_nacimiento, ag.sexo, ag.estado_civil,
              ag.curp, ag.parentesco_id, ag.parentesco_otro, ag.asentamiento_id,
              ag.codigo_postal, ag.calle, ag.numero_exterior, ag.numero_interior,
              ag.referencias, ag.zona, ag.ocupacion_id, ag.ocupacion_otra,
              ag.tipo_trabajo, ag.drogas, ag.especificacion_droga,
              ag.consumo_alcohol, ag.especificacion_arma, ag.observaciones,
              ag.activo, ag.actualizado_en;
  else
    return query
    update public.agresor ag
    set nombres              = v_nombres,
        apellido_paterno     = v_apellido_paterno,
        apellido_materno     = v_apellido_materno,
        edad                 = v_edad,
        fecha_nacimiento     = v_fecha_nacimiento,
        entidad_nacimiento   = v_entidad_nacimiento,
        sexo                 = coalesce(p_sexo, v_actual.sexo),
        estado_civil         = coalesce(p_estado_civil, v_actual.estado_civil),
        curp                 = v_curp,
        parentesco_id        = v_parentesco_id,
        parentesco_otro      = v_parentesco_otro,
        asentamiento_id      = v_asentamiento_id,
        codigo_postal        = v_codigo_postal,
        calle                = v_calle,
        numero_exterior      = v_numero_exterior,
        numero_interior      = v_numero_interior,
        referencias          = v_referencias,
        zona                 = coalesce(p_zona, v_actual.zona),
        ocupacion_id         = v_ocupacion_id,
        ocupacion_otra       = v_ocupacion_otra,
        tipo_trabajo         = coalesce(p_tipo_trabajo, v_actual.tipo_trabajo),
        drogas               = v_drogas,
        especificacion_droga = v_especificacion_droga,
        consumo_alcohol      = coalesce(p_consumo_alcohol, v_actual.consumo_alcohol),
        especificacion_arma  = v_especificacion_arma,
        observaciones        = v_observaciones
    where ag.id = p_agresor_id
    returning ag.id, ag.ficha_id, ag.nombres, ag.apellido_paterno, ag.apellido_materno,
              ag.edad, ag.fecha_nacimiento, ag.entidad_nacimiento, ag.sexo, ag.estado_civil,
              ag.curp, ag.parentesco_id, ag.parentesco_otro, ag.asentamiento_id,
              ag.codigo_postal, ag.calle, ag.numero_exterior, ag.numero_interior,
              ag.referencias, ag.zona, ag.ocupacion_id, ag.ocupacion_otra,
              ag.tipo_trabajo, ag.drogas, ag.especificacion_droga,
              ag.consumo_alcohol, ag.especificacion_arma, ag.observaciones,
              ag.activo, ag.actualizado_en;
  end if;
end;
$$;

revoke all on function public.guardar_agresor(
  uuid, uuid, timestamptz, text, text, text, smallint, date, text,
  public.sexo_biologico, public.estado_civil, text, smallint, text, integer,
  text, text, text, text, text, public.zona_geografica, smallint, text,
  public.tipo_trabajo, public.tipo_droga[], text, public.consumo_alcohol, text, text
) from public, anon;

grant execute on function public.guardar_agresor(
  uuid, uuid, timestamptz, text, text, text, smallint, date, text,
  public.sexo_biologico, public.estado_civil, text, smallint, text, integer,
