create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 74_bitacora_consulta.test.sql (pgTAP · RF-22 / RF-22.1)
-- Pruebas de la migración 74_bitacora_consulta.sql:
--   - RBAC: solo titular y subdirección leen consultar_bitacora() y
--     get_bitacora_filtros(); anon, inactivo, recepción, UMECA, TS y
--     Psicología reciben 42501.
--   - Filtros por tabla, acción y rango de fechas; orden descendente.
--   - Paginación (limite / offset) con el total de filas en cada fila.
--   - Actor: empleado, usuario externo (UMECA) y sistema.
--   - Validaciones 23514 (acción inválida, límite, offset, rango).
--   - get_bitacora_filtros(): tablas con eventos y acciones del enum.
-- =====================================================================

begin;

select plan(31);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.as_user(uuid) to public;

do $$
declare
  v_area_ts   smallint;
  v_area_psic smallint;
  v_uid_dir   uuid := '74000000-0000-4000-a000-000000000001';
  v_uid_sub   uuid := '74000000-0000-4000-a000-000000000002';
  v_uid_ts    uuid := '74000000-0000-4000-a000-000000000003';
  v_uid_psic  uuid := '74000000-0000-4000-a000-000000000004';
  v_uid_rec   uuid := '74000000-0000-4000-a000-000000000005';
  v_uid_inact uuid := '74000000-0000-4000-a000-000000000006';
  v_uid_umeca uuid := '74000000-0000-4000-a000-000000000007';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';

  insert into auth.users (id, email) values
    (v_uid_dir,   'test74.dir@semujeres.local'),
    (v_uid_sub,   'test74.sub@semujeres.local'),
    (v_uid_ts,    'test74.ts@semujeres.local'),
    (v_uid_psic,  'test74.psic@semujeres.local'),
    (v_uid_rec,   'test74.rec@semujeres.local'),
    (v_uid_inact, 'test74.inact@semujeres.local'),
    (v_uid_umeca, 'test74.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_dir,   'Titular Bitacora74',  'titular',        null,        true),
    (v_uid_sub,   'Subdir Bitacora74',   'subdireccion',   null,        true),
    (v_uid_ts,    'TS Bitacora74',       'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psic Bitacora74',     'psicologia',     v_area_psic, true),
    (v_uid_rec,   'Recep Bitacora74',    'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Bitacora74', 'titular',        null,        false)
  on conflict (id) do nothing;
  update auth.users u
     set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true)
   where exists (select 1 from public.empleado e where e.id = u.id)
     and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umeca, 'UMECA Bitacora74', 'umeca', true)
  on conflict (id) do nothing;
  update auth.users u
     set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('externo'::text), true)
   where u.id = v_uid_umeca;

  -- Eventos controlados en tablas propias de la prueba (no chocan con los triggers).
  insert into public.bitacora_acceso (empleado_id, usuario_externo_id, accion, tabla_afectada, registro_id, creado_en) values
    (v_uid_dir, null,        'ver',        'test74_a', 'reg-1', '2026-01-10T12:00:00Z'),
    (v_uid_ts,  null,        'crear',      'test74_a', 'reg-2', '2026-01-15T12:00:00Z'),
    (null,      v_uid_umeca, 'actualizar', 'test74_a', 'reg-3', '2026-02-01T12:00:00Z'),
    (null,      null,        'ver',        'test74_b', 'reg-4', '2026-01-20T12:00:00Z');
end $$;

-- 1-6. Sin permiso: consultar_bitacora rechaza con 42501
set local role anon;
select throws_ok(
  $$select * from public.consultar_bitacora()$$,
  '42501', null,
  'anon no puede consultar la bitácora'
);

select pg_temp.as_user('74000000-0000-4000-a000-000000000006');
select throws_ok(
  $$select * from public.consultar_bitacora()$$,
  '42501', null,
  'titular inactivo no puede consultar la bitácora'
);

select pg_temp.as_user('74000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.consultar_bitacora()$$,
  '42501', null,
  'recepcion no puede consultar la bitácora'
);

select pg_temp.as_user('74000000-0000-4000-a000-000000000007');
select throws_ok(
  $$select * from public.consultar_bitacora()$$,
  '42501', null,
  'UMECA no puede consultar la bitácora'
);

select pg_temp.as_user('74000000-0000-4000-a000-000000000003');
select throws_ok(
  $$select * from public.consultar_bitacora()$$,
  '42501', null,
  'trabajo_social no puede consultar la bitácora'
);

select pg_temp.as_user('74000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.consultar_bitacora()$$,
  '42501', null,
  'psicologia no puede consultar la bitácora'
);

-- 7-8. Sin permiso: get_bitacora_filtros rechaza con 42501
select throws_ok(
  $$select * from public.get_bitacora_filtros()$$,
  '42501', null,
  'psicologia no puede leer los filtros de la bitácora'
);

select pg_temp.as_user('74000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_bitacora_filtros()$$,
  '42501', null,
  'recepcion no puede leer los filtros de la bitácora'
);

-- 9. Subdirección sí puede
select pg_temp.as_user('74000000-0000-4000-a000-000000000002');
select is(
  (select count(*) from public.consultar_bitacora('test74_a', null, null, null, 50, 0)),
  3::bigint,
  'subdireccion consulta la bitácora (3 eventos en test74_a)'
);

-- 10-12. Titular: filtros
select pg_temp.as_user('74000000-0000-4000-a000-000000000001');
select is(
  (select count(*) from public.consultar_bitacora('test74_a', null, null, null, 50, 0)),
  3::bigint,
  'filtro por tabla devuelve solo esa tabla'
);

select results_eq(
  $$select actor_nombre, registro_id
      from public.consultar_bitacora('test74_a', 'ver', null, null, 50, 0)$$,
  $$values ('Titular Bitacora74'::text, 'reg-1'::text)$$,
  'filtro por acción (ver) devuelve solo ese evento con su actor'
);

select results_eq(
  $$select registro_id
      from public.consultar_bitacora(
        'test74_a', null,
        '2026-01-12T00:00:00Z'::timestamptz, '2026-01-31T23:59:59Z'::timestamptz, 50, 0)$$,
  $$values ('reg-2'::text)$$,
  'filtro por rango de fechas devuelve solo los eventos dentro del rango'
);

-- 13. Orden descendente por fecha
select results_eq(
  $$select registro_id from public.consultar_bitacora('test74_a', null, null, null, 50, 0)$$,
  $$values ('reg-3'::text), ('reg-2'::text), ('reg-1'::text)$$,
  'los eventos se ordenan del más reciente al más antiguo'
);

-- 14-16. Paginación y total
select results_eq(
  $$select registro_id from public.consultar_bitacora('test74_a', null, null, null, 2, 0)$$,
  $$values ('reg-3'::text), ('reg-2'::text)$$,
  'primera página (limite 2, offset 0)'
);

select results_eq(
  $$select registro_id from public.consultar_bitacora('test74_a', null, null, null, 2, 2)$$,
  $$values ('reg-1'::text)$$,
  'segunda página (limite 2, offset 2)'
);

select is(
  (select max(total) from public.consultar_bitacora('test74_a', null, null, null, 1, 1)),
  3::bigint,
  'total refleja todas las filas filtradas aunque la página sea menor'
);

-- 17-19. Actor: empleado, UMECA y sistema
select results_eq(
  $$select actor_tipo, actor_nombre, actor_rol
      from public.consultar_bitacora('test74_a', 'crear', null, null, 50, 0)$$,
  $$values ('empleado'::text, 'TS Bitacora74'::text, 'trabajo_social'::text)$$,
  'actor empleado con su nombre y rol'
);

select results_eq(
  $$select actor_tipo, actor_nombre, actor_rol
      from public.consultar_bitacora('test74_a', 'actualizar', null, null, 50, 0)$$,
  $$values ('usuario_externo'::text, 'UMECA Bitacora74'::text, 'umeca'::text)$$,
  'actor UMECA con su nombre y dependencia'
);

select results_eq(
  $$select actor_tipo, actor_nombre, actor_rol
      from public.consultar_bitacora('test74_b', null, null, null, 50, 0)$$,
  $$values ('sistema'::text, 'Sistema / App'::text, null::text)$$,
  'evento sin actor se muestra como Sistema / App'
);

-- 20. Sin payload: la tabla solo guarda quién, qué, tabla y registro
select results_eq(
  $$select column_name::text
      from information_schema.columns
     where table_schema = 'public' and table_name = 'bitacora_acceso'
     order by ordinal_position$$,
  $$values ('id'::text), ('empleado_id'::text), ('usuario_externo_id'::text), ('accion'::text),
           ('tabla_afectada'::text), ('registro_id'::text), ('creado_en'::text)$$,
  'bitacora_acceso no guarda payload ni contenido (solo quién, qué, tabla y registro)'
);

-- 21-25. Validaciones 23514
select throws_ok(
  $$select * from public.consultar_bitacora(null, 'borrar', null, null, 50, 0)$$,
  '23514', null,
  'acción fuera del enum lanza 23514'
);

select throws_ok(
  $$select * from public.consultar_bitacora(null, null, null, null, 0, 0)$$,
  '23514', null,
  'p_limite = 0 lanza 23514'
);

select throws_ok(
  $$select * from public.consultar_bitacora(null, null, null, null, 201, 0)$$,
  '23514', null,
  'p_limite > 200 lanza 23514'
);

select throws_ok(
  $$select * from public.consultar_bitacora(null, null, null, null, 50, -1)$$,
  '23514', null,
  'p_offset negativo lanza 23514'
);

select throws_ok(
  $$select * from public.consultar_bitacora(
      null, null, '2026-12-10T00:00:00Z'::timestamptz, '2026-11-01T00:00:00Z'::timestamptz, 50, 0)$$,
  '23514', null,
  'p_desde > p_hasta lanza 23514'
);

-- 26-28. get_bitacora_filtros
select ok(
  exists (select 1 from public.get_bitacora_filtros() f where f.tipo = 'tabla' and f.valor = 'test74_a'),
  'get_bitacora_filtros lista las tablas con eventos'
);

select results_eq(
  $$select valor from public.get_bitacora_filtros() where tipo = 'accion' order by valor$$,
  $$values ('actualizar'::text), ('crear'::text), ('desactivar'::text), ('ver'::text)$$,
  'get_bitacora_filtros lista las acciones del enum'
);

select is(
  (select count(*) from public.get_bitacora_filtros() f where f.tipo = 'tabla' and f.valor = 'test74_a'),
  1::bigint,
  'las tablas no se repiten'
);

-- 29-30. Subdirección también lee los filtros; la acción vacía equivale a «todas»
select pg_temp.as_user('74000000-0000-4000-a000-000000000002');
select ok(
  exists (select 1 from public.get_bitacora_filtros() f where f.tipo = 'tabla'),
  'subdireccion puede leer los filtros'
);

select is(
  (select count(*) from public.consultar_bitacora('  test74_a  ', '', null, null, 50, 0)),
  3::bigint,
  'tabla con espacios y acción vacía se normalizan (sin filtro de acción)'
);

-- 31. anon no ejecuta get_bitacora_filtros
set local role anon;
select throws_ok(
  $$select * from public.get_bitacora_filtros()$$,
  '42501', null,
  'anon no puede leer los filtros de la bitácora'
);

select * from finish();

rollback;
