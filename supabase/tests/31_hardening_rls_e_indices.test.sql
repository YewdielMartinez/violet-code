-- =====================================================================
-- 31_hardening_rls_e_indices.test.sql (pgTAP · Auditoría best practices)
-- Verifica que:
--   * los documentos en Storage no se puedan sobrescribir (sin UPDATE),
--   * ninguna política llame a funciones por fila sin (select ...),
--   * la búsqueda por nombre tenga su índice trigram y siga funcionando,
--   * existan los índices en llaves foráneas usadas por RLS/RPCs,
--   * las funciones nuevas no queden ejecutables por PUBLIC/anon.
-- =====================================================================

begin;

select plan(9);

-- 1. Sin política UPDATE en el bucket documentos
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'documentos_storage_update'),
  0,
  'storage.objects no tiene política UPDATE para documentos'
);

-- 2. Todas las políticas envuelven sus llamadas a funciones
select is(
  (select count(*)::integer from pg_policies
   where schemaname in ('public', 'storage')
     and ((qual ~ '(tiene_permiso|auth\.uid|es_empleado_activo)\(' and qual !~ 'SELECT')
       or (with_check ~ '(tiene_permiso|auth\.uid|es_empleado_activo)\(' and with_check !~ 'SELECT'))),
  0,
  'ninguna política evalúa tiene_permiso/auth.uid/es_empleado_activo por fila'
);

-- 3-4. Búsqueda por nombre indexable
select has_index('public', 'persona', 'persona_nombre_busqueda_trgm_idx',
  'existe índice trigram sobre el nombre completo normalizado');

select is(
  public.f_nombre_busqueda('María José', 'Núñez', null),
  'maria jose nunez',
  'f_nombre_busqueda normaliza minúsculas y acentos'
);

-- 5. Folio por prefijo
select has_index('public', 'ficha_registro', 'ficha_registro_folio_upper_prefix_idx',
  'existe índice de prefijo para folio');

-- 6-7. Índices en llaves foráneas usadas por RLS y RPCs
select has_index('public', 'derivacion', 'derivacion_area_destino_id_idx',
  'derivacion.area_destino_id indexada');
select has_index('public', 'derivacion', 'derivacion_area_origen_id_idx',
  'derivacion.area_origen_id indexada');

-- 8-9. Funciones nuevas sin EXECUTE para PUBLIC/anon
create function public.zz_prueba_default_privs() returns int language sql as 'select 1';

select ok(
  not has_function_privilege('anon', 'public.zz_prueba_default_privs()', 'execute'),
  'anon no puede ejecutar funciones nuevas de public por defecto'
);

select ok(
  has_function_privilege('authenticated', 'public.zz_prueba_default_privs()', 'execute'),
  'authenticated conserva EXECUTE por defecto en public'
);

select * from finish();

rollback;
