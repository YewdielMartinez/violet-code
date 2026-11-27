-- =====================================================================
-- seeds/44_tipos_cuenta.sql (Tarjeta #92)
-- Marca app_metadata.tipo ('empleado', 'externo', 'usuaria_app') en
-- todas las cuentas sembradas en auth.users.
-- =====================================================================

update auth.users u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{tipo}',
  '"empleado"'::jsonb,
  true
)
where exists (select 1 from public.empleado e where e.id = u.id);

update auth.users u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{tipo}',
  '"externo"'::jsonb,
  true
)
where exists (select 1 from public.usuario_externo ue where ue.id = u.id)
  and not exists (select 1 from public.empleado e where e.id = u.id);

update auth.users u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{tipo}',
  '"usuaria_app"'::jsonb,
  true
)
where not exists (select 1 from public.empleado e where e.id = u.id)
  and not exists (select 1 from public.usuario_externo ue where ue.id = u.id);
