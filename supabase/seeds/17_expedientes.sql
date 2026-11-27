-- =====================================================================
-- supabase/seeds/17_expedientes.sql (A-02 · Sprint 01)
-- Datos sintéticos deterministas para pruebas de verificar_curp() y
-- buscar_expedientes(): persona con ficha (con acentos), persona sin
-- ficha y pre-registro móvil activo sin expediente.
-- =====================================================================

do $$
declare
  v_uid_ts     uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_app_3  uuid := '22222222-2222-4222-8222-222222222203';
  v_per_ficha  uuid := '33333333-3333-4333-8333-333333333311';
  v_per_sin    uuid := '33333333-3333-4333-8333-333333333312';
  v_ficha_a02  uuid := '55555555-5555-4555-8555-555555555511';
  v_pre_a02    uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11';
  v_oc_hogar   smallint;
begin
  if not exists (select 1 from public.empleado where id = v_uid_ts) then
    return;
  end if;

  select id into v_oc_hogar from public.cat_ocupacion where clave = 'hogar' limit 1;

  -- Persona 1: con ficha activa y nombre con acentos
  insert into public.persona (
    id, curp, nombres, apellido_paterno, apellido_materno, celular,
    escolaridad, discapacidad, religion, grupo_etnico, creado_por
  ) values (
    v_per_ficha, 'AAML920410MSLNRR01', 'Lucía Fernanda', 'Álvarez', 'Méndez',
    '6681000011', 'preparatoria', 'Ninguna', 'Católica', 'Ninguno', v_uid_ts
  )
  on conflict (id) do nothing;

  insert into public.ficha_registro (
    id, persona_id, folio, estado, aviso_privacidad_aceptado_en,
    estado_civil, ocupacion_id, creado_por
  ) values (
    v_ficha_a02, v_per_ficha, 'SEM-2026-9091', 'abierto', now() - interval '2 days',
    'soltero', v_oc_hogar, v_uid_ts
  )
  on conflict (id) do nothing;

  -- Persona 2: registrada en persona pero sin ficha
  insert into public.persona (
    id, curp, nombres, apellido_paterno, apellido_materno, celular,
    escolaridad, discapacidad, religion, grupo_etnico, creado_por
  ) values (
    v_per_sin, 'RACS930615MSLRRN02', 'Sofía', 'Ramírez', 'Cortés',
    '6681000012', 'secundaria', 'Ninguna', 'Ninguna', 'Ninguno', v_uid_ts
  )
  on conflict (id) do nothing;

  -- Pre-registro 3: usuaria móvil sin persona ni ficha todavía
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_uid_app_3,
    'authenticated', 'authenticated',
    'usuaria.a02@demo.violetcode.local',
    extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nombre":"Elena Torres (Demo A02)"}'::jsonb,
    now(), now()
  )
  on conflict (id) do nothing;

  insert into public.pre_registro (
    id, auth_user_id, curp, nombres, apellido_paterno, apellido_materno,
    celular, aviso_privacidad_aceptado_en
  ) values (
    v_pre_a02, v_uid_app_3, 'TOVE960820MSLVRN03', 'Elena', 'Torres', 'Vázquez',
    '6681000013', now() - interval '1 day'
  )
  on conflict (id) do nothing;
end;
$$;
