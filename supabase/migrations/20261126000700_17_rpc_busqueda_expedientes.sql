-- =====================================================================
-- 17_rpc_busqueda_expedientes.sql (A-02 · Sprint 01)
-- 1. Habilita extensions.unaccent para búsqueda por nombre sin acentos.
-- 2. Crea RPC verificar_curp(p_curp) con permiso 'expediente.verificar_curp',
--    salida reducida para recepción y bitácora al encontrar persona.
-- 3. Crea RPC buscar_expedientes(p_termino, p_limite, p_incluir_archivados)
--    con permiso 'expediente.ver' y búsqueda con unaccent + pg_trgm.
-- 4. Actualiza buscar_pre_registro_por_curp() a tiene_permiso('expediente.escribir').
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- 1. verificar_curp(p_curp text)
-- ---------------------------------------------------------------------
create or replace function public.verificar_curp(p_curp text)
returns table (
  resultado       text,
  persona_id      uuid,
  ficha_id        uuid,
  folio           text,
  estado          public.estado_ficha,
  nombre_completo text,
  pre_registro_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id     uuid := auth.uid();
  v_curp         text := upper(btrim(coalesce(p_curp, '')));
  v_es_recepcion boolean;
  v_persona      record;
  v_ficha        record;
  v_pre          record;
begin
  if not public.tiene_permiso('expediente.verificar_curp') then
    raise exception 'Sin permiso para verificar CURP' using errcode = '42501';
  end if;

  if v_curp !~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$' then
    raise exception 'La CURP no tiene un formato válido' using errcode = '23514';
  end if;

  v_es_recepcion := (public.auth_rol() = 'recepcion');

  select p.id,
         concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno) as nombre_completo
  into v_persona
  from public.persona p
  where p.activo
    and p.curp = v_curp
  limit 1;

  if found then
    insert into public.bitacora_acceso (
      empleado_id,
      accion,
      tabla_afectada,
      registro_id
    ) values (
      v_actor_id,
      'ver',
      'persona',
      v_persona.id::text
    );

    select f.id, f.folio, f.estado
    into v_ficha
    from public.ficha_registro f
    where f.persona_id = v_persona.id
      and f.activo
    order by f.registrada_en desc
    limit 1;

    if found then
      if v_es_recepcion then
        return query select
          'expediente_existente'::text,
          v_persona.id,
          null::uuid,
          v_ficha.folio,
          null::public.estado_ficha,
          v_persona.nombre_completo,
          null::uuid;
      else
        return query select
          'expediente_existente'::text,
          v_persona.id,
          v_ficha.id,
          v_ficha.folio,
          v_ficha.estado,
          v_persona.nombre_completo,
          null::uuid;
      end if;
      return;
    end if;

    return query select
      'persona_sin_ficha'::text,
      v_persona.id,
      null::uuid,
      null::text,
      null::public.estado_ficha,
      v_persona.nombre_completo,
      null::uuid;
    return;
  end if;

  -- pre_registro_movil solo visible para quienes pueden crear/escribir expediente
  if not v_es_recepcion and public.tiene_permiso('expediente.escribir') then
    select pr.id,
           concat_ws(' ', pr.nombres, pr.apellido_paterno, pr.apellido_materno) as nombre_completo
    into v_pre
    from public.pre_registro pr
    where pr.activo
      and pr.curp = v_curp
    limit 1;

    if found then
      return query select
        'pre_registro_movil'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::public.estado_ficha,
        v_pre.nombre_completo,
        v_pre.id;
      return;
    end if;
  end if;

  return query select
    'nuevo'::text,
    null::uuid,
    null::uuid,
    null::text,
    null::public.estado_ficha,
    null::text,
    null::uuid;
end;
$$;

revoke execute on function public.verificar_curp(text) from public, anon;
grant  execute on function public.verificar_curp(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. buscar_expedientes(p_termino, p_limite, p_incluir_archivados)
-- ---------------------------------------------------------------------
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
  v_termino_norm := extensions.unaccent(lower(v_termino));

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
      and f.folio ilike v_upper || '%'
    order by f.registrada_en desc
    limit v_limite;
    return;
  end if;

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
         'nombre'::text as coincidencia,
         greatest(
           extensions.similarity(
             extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))),
             v_termino_norm
           ),
           case
             when extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))) like '%' || v_termino_norm || '%'
             then 0.8::real
             else 0.0::real
           end
         )::real as similitud
  from public.ficha_registro f
  join public.persona p on p.id = f.persona_id
  where f.activo
    and p.activo
    and (v_incluir_arch or f.estado <> 'archivado')
    and (
      extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))) like '%' || v_termino_norm || '%'
      or extensions.similarity(
           extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))),
           v_termino_norm
         ) >= 0.25
    )
  order by similitud desc, f.registrada_en desc
  limit v_limite;
end;
$$;

revoke execute on function public.buscar_expedientes(text, int, boolean) from public, anon;
grant  execute on function public.buscar_expedientes(text, int, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. buscar_pre_registro_por_curp(): migra validación a tiene_permiso()
-- ---------------------------------------------------------------------
create or replace function public.buscar_pre_registro_por_curp(p_curp text)
returns table (
  pre_registro_id    uuid,
  curp               text,
  nombres            text,
  apellido_paterno   text,
  apellido_materno   text,
  sexo               text,
  fecha_nacimiento   date,
  entidad_nacimiento text,
  celular            text,
  persona_id         uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_curp text;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para consultar pre-registros por CURP' using errcode = '42501';
  end if;

  v_curp := upper(btrim(coalesce(p_curp, '')));

  return query
  select pr.id as pre_registro_id,
         pr.curp,
         pr.nombres,
         pr.apellido_paterno,
         pr.apellido_materno,
         pr.sexo,
         pr.fecha_nacimiento,
         pr.entidad_nacimiento,
         pr.celular,
         pr.persona_id
  from public.pre_registro pr
  where pr.activo
    and pr.curp = v_curp
  limit 1;
end;
$$;

revoke execute on function public.buscar_pre_registro_por_curp(text) from public, anon;
grant  execute on function public.buscar_pre_registro_por_curp(text) to authenticated;
