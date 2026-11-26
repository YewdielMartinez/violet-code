-- =====================================================================
-- 09_grants_authenticated.sql
-- Qué contiene: otorga privilegios SQL base al rol `authenticated`
-- sobre el esquema `public` (tablas, vistas y secuencias).
-- Motivo: en Supabase Cloud los privilegios por defecto pueden no
-- otorgar SELECT/INSERT/UPDATE/DELETE al rol `authenticated` al aplicar
-- migraciones con `supabase db push`, provocando error 42501 incluso
-- cuando las políticas RLS existen. La autorización real por fila y
-- rol sigue controlada estrictamente por RLS (07_rls.sql).
-- =====================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant select on public.vista_lista_urgencias to authenticated;
grant select on public.vista_informe_mensual to authenticated;
grant select on public.vista_informe_anual to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;
