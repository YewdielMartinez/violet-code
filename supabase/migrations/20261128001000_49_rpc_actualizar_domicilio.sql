-- =====================================================================
-- 49_rpc_actualizar_domicilio.sql (Tarjeta #112)
-- 1. Cierra INSERT/UPDATE directos sobre public.domicilio (with check false).
-- 2. Crea RPC actualizar_domicilio(p_persona_id, p_actualizado_en, ...)
--    con permiso 'expediente.escribir', bloqueo de expediente archivado,
--    bloqueo optimista (SQLSTATE 23505), validación asentamiento/CP y
--    rotación atómica de es_actual = true al nuevo domicilio.
-- =====================================================================

-- 1) Cerrar INSERT y UPDATE directos sobre public.domicilio
drop policy if exists domicilio_insert on public.domicilio;
create policy domicilio_insert on public.domicilio
  for insert to authenticated
  with check (false and (select public.tiene_permiso('expediente.escribir')));

drop policy if exists domicilio_update on public.domicilio;
create policy domicilio_update on public.domicilio
  for update to authenticated
  using ((select public.tiene_permiso('expediente.ver')))
  with check (false and (select public.tiene_permiso('expediente.escribir')));

-- 2) RPC actualizar_domicilio(...)
create or replace function public.actualizar_domicilio(
  p_persona_id      uuid,
  p_actualizado_en  timestamptz default null,
  p_asentamiento_id integer default null,
  p_calle           text default null,
  p_numero_exterior text default null,
  p_numero_interior text default null,
  p_referencias     text default null,
  p_codigo_postal   text default null,
  p_zona            public.zona_geografica default null
)
returns table (
  domicilio_id   uuid,
  persona_id     uuid,
  es_actual      boolean,
  actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id     uuid := auth.uid();
  v_cp           text := nullif(btrim(coalesce(p_codigo_postal, '')), '');
  v_calle        text := nullif(btrim(coalesce(p_calle, '')), '');
  v_num_ext      text := nullif(btrim(coalesce(p_numero_exterior, '')), '');
  v_num_int      text := nullif(btrim(coalesce(p_numero_interior, '')), '');
  v_ref          text := nullif(btrim(coalesce(p_referencias, '')), '');
  v_dom_actual   record;
  v_nuevo_id     uuid;
  v_nuevo_act_en timestamptz;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para actualizar domicilios' using errcode = '42501';
  end if;

  if p_persona_id is null then
    raise exception 'El identificador de la persona es obligatorio' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.persona p
    where p.id = p_persona_id
      and p.activo
  ) then
    raise exception 'Persona no encontrada o inactiva' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.ficha_registro f
    where f.persona_id = p_persona_id
      and f.activo
      and f.estado = 'archivado'
  ) and not exists (
    select 1
    from public.ficha_registro f
    where f.persona_id = p_persona_id
      and f.activo
      and f.estado <> 'archivado'
  ) then
    raise exception 'No se puede actualizar el domicilio de un expediente archivado'
      using errcode = '23514';
  end if;

  if p_asentamiento_id is not null and v_cp is not null then
    raise exception 'Indica asentamiento o código postal, no ambos' using errcode = '23514';
  end if;

  if p_asentamiento_id is not null and not exists (
    select 1
    from public.cat_asentamiento ca
    where ca.id = p_asentamiento_id
  ) then
    raise exception 'El asentamiento indicado no existe' using errcode = '23514';
  end if;

  if v_cp is not null and v_cp !~ '^[0-9]{5}$' then
    raise exception 'El código postal debe tener exactamente 5 dígitos' using errcode = '23514';
  end if;

  select d.id, d.actualizado_en
  into v_dom_actual
  from public.domicilio d
  where d.persona_id = p_persona_id
    and d.activo
    and d.es_actual
  limit 1
  for update;

  if found then
    if p_actualizado_en is null
       or date_trunc('milliseconds', v_dom_actual.actualizado_en) <> date_trunc('milliseconds', p_actualizado_en) then
      raise exception 'El domicilio fue modificado por otra persona. Recarga antes de guardar.'
        using errcode = '23505';
    end if;

    update public.domicilio d
    set es_actual = false
    where d.id = v_dom_actual.id;
  end if;

  insert into public.domicilio (
    persona_id,
    asentamiento_id,
    calle,
    numero_exterior,
    numero_interior,
    referencias,
    codigo_postal,
    zona,
    es_actual,
    creado_por
  ) values (
    p_persona_id,
    p_asentamiento_id,
    v_calle,
    v_num_ext,
    v_num_int,
    v_ref,
    v_cp,
    p_zona,
    true,
    v_actor_id
  )
  returning id, public.domicilio.actualizado_en
  into v_nuevo_id, v_nuevo_act_en;

  return query select v_nuevo_id, p_persona_id, true, v_nuevo_act_en;
end;
$$;

revoke all on function public.actualizar_domicilio(uuid, timestamptz, integer, text, text, text, text, text, public.zona_geografica) from public, anon;
grant  execute on function public.actualizar_domicilio(uuid, timestamptz, integer, text, text, text, text, text, public.zona_geografica) to authenticated;
