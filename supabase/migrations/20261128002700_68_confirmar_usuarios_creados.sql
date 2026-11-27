-- =====================================================================
-- 68 · Cuentas creadas por Dirección entran confirmadas
--
-- Bug: el panel daba de alta al personal con `auth.signUp()`. Con
-- `[auth.email] enable_confirmations = true`, GoTrue deja la cuenta sin
-- `email_confirmed_at` y el primer inicio de sesión responde
-- "Email not confirmed" ("Tu cuenta aún no ha sido confirmada").
--
-- Solución: el alta pasa a un RPC con permiso `cuentas.gestionar` que
-- crea la credencial (auth.users + auth.identities) YA confirmada y el
-- perfil (empleado / usuario_externo) en una sola transacción. Así:
--   * no depende del correo de confirmación ni de su rate limit/SMTP;
--   * el registro público (signUp) ya no es necesario y puede
--     deshabilitarse en Auth (`enable_signup = false`) sin romper el alta;
--   * si falla el perfil, no queda una credencial huérfana.
-- Además confirma las cuentas de personal que ya habían quedado sin
-- confirmar por este bug.
-- =====================================================================

create or replace function public.crear_cuenta_acceso(
  p_correo     text,
  p_contrasena text,
  p_nombre     text,
  p_rol        text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_correo   text := lower(btrim(coalesce(p_correo, '')));
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_uid      uuid := gen_random_uuid();
  v_area_id  smallint;
  v_externo  boolean := (p_rol = 'umeca');
begin
  if not public.tiene_permiso('cuentas.gestionar') then
    raise exception 'No tienes permiso para gestionar cuentas.'
      using errcode = '42501';
  end if;

  if v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo electrónico no es válido.' using errcode = '23514';
  end if;
  if char_length(v_nombre) not between 1 and 120 then
    raise exception 'El nombre es obligatorio (máximo 120 caracteres).' using errcode = '23514';
  end if;
  if char_length(coalesce(p_contrasena, '')) < 8
     or p_contrasena !~ '[A-Za-z]' or p_contrasena !~ '[0-9]' then
    raise exception 'La contraseña temporal debe tener al menos 8 caracteres, con letras y números.'
      using errcode = '23514';
  end if;
  if not v_externo and p_rol not in
     ('titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico', 'recepcion') then
    raise exception 'Rol no válido.' using errcode = '23514';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_correo) then
    raise exception 'Ya existe una cuenta con ese correo electrónico.' using errcode = '23505';
  end if;

  if p_rol in ('trabajo_social', 'psicologia', 'juridico') then
    select a.id into v_area_id from public.cat_area a where a.clave = p_rol;
    if v_area_id is null then
      raise exception 'No existe el área correspondiente al rol seleccionado.' using errcode = '23514';
    end if;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_correo, extensions.crypt(p_contrasena, extensions.gen_salt('bf')),
    now(), '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', v_nombre),
    false, false, now(), now()
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_correo,
                       'email_verified', true, 'phone_verified', false),
    'email', null, now(), now()
  );

  if v_externo then
    insert into public.usuario_externo (id, nombre, dependencia, creado_por)
    values (v_uid, v_nombre, 'umeca', v_actor);
  else
    insert into public.empleado (id, nombre, rol, area_id, creado_por)
    values (v_uid, v_nombre, p_rol::public.rol_empleado, v_area_id, v_actor);
  end if;

  return v_uid;
end;
$$;

revoke all on function public.crear_cuenta_acceso(text, text, text, text) from public, anon;
grant execute on function public.crear_cuenta_acceso(text, text, text, text) to authenticated;

-- Cuentas de personal / UMECA que ya existían sin confirmar por el bug anterior.
update auth.users u
   set email_confirmed_at = now()
 where u.email_confirmed_at is null
   and (exists (select 1 from public.empleado e where e.id = u.id)
        or exists (select 1 from public.usuario_externo x where x.id = u.id));
