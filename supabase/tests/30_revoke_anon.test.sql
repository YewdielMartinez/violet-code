-- =====================================================================
-- 30_revoke_anon.test.sql (pgTAP · Hardening / Defensa en profundidad)
-- Verifica que el rol `anon` no conserve privilegios SQL sobre tablas,
-- vistas o secuencias del esquema `public` y que cualquier consulta directa
-- falle con SQLSTATE 42501 sin depender únicamente de RLS.
-- =====================================================================

begin;

select plan(5);

-- 1. Cero privilegios de tabla/vista asignados a `anon` en esquema public
select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants rtg
    where rtg.grantee = 'anon'
      and rtg.table_schema = 'public'
  ),
  0,
  'el rol anon tiene 0 privilegios sobre tablas y vistas de public'
);

-- 2-5. Consultas directas bajo role anon lanzan 42501
set local role anon;

select throws_ok(
  $$select * from public.persona limit 1$$,
  '42501',
  null,
  'anon recibe 42501 al intentar leer public.persona'
);

select throws_ok(
  $$select * from public.ficha_registro limit 1$$,
  '42501',
  null,
  'anon recibe 42501 al intentar leer public.ficha_registro'
);

select throws_ok(
  $$select * from public.alerta limit 1$$,
  '42501',
  null,
  'anon recibe 42501 al intentar leer public.alerta'
);

select throws_ok(
  $$select * from public.bitacora_acceso limit 1$$,
  '42501',
  null,
  'anon recibe 42501 al intentar leer public.bitacora_acceso'
);

select * from finish();

rollback;
