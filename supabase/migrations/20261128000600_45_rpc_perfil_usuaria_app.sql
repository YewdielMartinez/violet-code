-- =====================================================================
-- 45_rpc_perfil_usuaria_app.sql (Tarjeta #93)
-- 1. Cierra INSERT directo en public.pre_registro (with check false).
-- 2. Crea RPC registrar_mi_perfil(...) solo para es_usuaria_app(), con
--    aviso de privacidad obligatorio y liga silenciosa por CURP intacta.
-- 3. Crea RPC get_mi_estado_app() (sin exponer persona_id ni estado).
-- 4. Crea RPC desactivar_mi_cuenta() que desactiva pre_registro e impide
--    enviar alertas.
-- =====================================================================

-- 1) Cerrar INSERT directo en public.pre_registro
drop policy if exists pre_registro_insert on public.pre_registro;
create policy pre_registro_insert on public.pre_registro
  for insert to authenticated
  with check (false and (select public.tiene_permiso('expediente.escribir')));

-- 2) registrar_mi_perfil(...)
create or replace function public.registrar_mi_perfil(
  p_curp                      text,
  p_nombres                   text,
  p_apellido_paterno          text,
  p_apellido_materno          text default null,
  p_celular                   text default null,
  p_aviso_privacidad_aceptado boolean default false
)
returns table (
  id                           uuid,
  curp                         text,
  nombres                      text,
  apellido_paterno             text,
  apellido_materno             text,
  celular                      text,
  aviso_privacidad_aceptado_en timestamptz,
  creado_en                    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_curp       text := upper(nullif(btrim(coalesce(p_curp, '')), ''));
  v_nombres    text := nullif(btrim(coalesce(p_nombres, '')), '');
  v_ap_pat     text := nullif(btrim(coalesce(p_apellido_paterno, '')), '');
  v_ap_mat     text := nullif(btrim(coalesce(p_apellido_materno, '')), '');
  v_celular    text := nullif(btrim(coalesce(p_celular, '')), '');
  v_pr_id      uuid;
begin
  if not public.es_usuaria_app() then
    raise exception 'Solo las usuarias de la app móvil pueden registrar su perfil'
      using errcode = '42501';
  end if;

  if coalesce(p_aviso_privacidad_aceptado, false) is not true then
    raise exception 'Debes aceptar el aviso de privacidad para continuar'
      using errcode = '23514';
  end if;

  if v_curp is null or v_nombres is null or v_ap_pat is null then
    raise exception 'CURP, nombres y apellido paterno son obligatorios'
      using errcode = '23514';
  end if;

  if v_celular is not null and v_celular !~ '^[0-9]{10}$' then
    raise exception 'El celular debe tener exactamente 10 dígitos'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.pre_registro pr
    where pr.auth_user_id = v_uid
      and pr.activo
  ) then
    raise exception 'Ya existe un perfil activo registrado para esta cuenta'
      using errcode = '23505';
  end if;

  insert into public.pre_registro (
    auth_user_id,
    curp,
    nombres,
    apellido_paterno,
    apellido_materno,
    celular,
    aviso_privacidad_aceptado_en
  ) values (
    v_uid,
    v_curp,
    v_nombres,
    v_ap_pat,
    v_ap_mat,
    v_celular,
    now()
  )
  returning pre_registro.id into v_pr_id;

  return query
  select
    pr.id,
    pr.curp,
    pr.nombres,
    pr.apellido_paterno,
    pr.apellido_materno,
    pr.celular,
    pr.aviso_privacidad_aceptado_en,
    pr.creado_en
  from public.pre_registro pr
  where pr.id = v_pr_id;
end;
$$;

revoke all on function public.registrar_mi_perfil(text, text, text, text, text, boolean) from public, anon;
grant  execute on function public.registrar_mi_perfil(text, text, text, text, text, boolean) to authenticated;

-- 3) get_mi_estado_app()
create or replace function public.get_mi_estado_app()
returns table (
  tiene_perfil        boolean,
  puede_enviar_alerta boolean,
  alertas_ultima_hora integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pre_id        uuid;
  v_alertas_hora  integer := 0;
begin
  if not public.es_usuaria_app() then
    raise exception 'Solo disponible para usuarias de la app móvil'
      using errcode = '42501';
  end if;

  v_pre_id := public.mi_pre_registro_id();

  if v_pre_id is not null then
    select count(*)::integer
    into v_alertas_hora
    from public.alerta a
    where a.pre_registro_id = v_pre_id
      and a.origen = 'app_movil'
      and a.activo
      and a.creado_en >= now() - interval '1 hour';
  end if;

  return query
  select
    (v_pre_id is not null),
    (v_pre_id is not null and v_alertas_hora < 3),
    v_alertas_hora;
end;
$$;

revoke all on function public.get_mi_estado_app() from public, anon;
grant  execute on function public.get_mi_estado_app() to authenticated;

-- 4) desactivar_mi_cuenta()
create or replace function public.desactivar_mi_cuenta()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.es_usuaria_app() then
    raise exception 'Solo las usuarias de la app móvil pueden desactivar su cuenta'
      using errcode = '42501';
  end if;

  update public.pre_registro pr
  set activo = false
  where pr.auth_user_id = v_uid
    and pr.activo;

  update auth.users u
  set banned_until = '2099-12-31T23:59:59Z'::timestamptz
  where u.id = v_uid;

  return true;
end;
$$;

revoke all on function public.desactivar_mi_cuenta() from public, anon;
grant  execute on function public.desactivar_mi_cuenta() to authenticated;
