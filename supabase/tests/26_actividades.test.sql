-- =====================================================================
-- 26_actividades.test.sql (pgTAP · B-05 · RF-16)
-- Pruebas de integración para migración 26_rpc_actividades_preventivas.sql:
--   - Seguridad RBAC: anon, empleado inactivo y UMECA rechazados (42501)
--   - Regla explícita de tarjeta #61: Recepción puede listar pero NO registrar
--   - Alta atómica con participantes + deduplicación + alta sin participantes/asentamiento
--   - Listado con asentamiento, participantes jsonb y filtros por rango/límite
--   - Validaciones 23514 y atomicidad (sin actividad huérfana si falla un participante)
-- =====================================================================

begin;

select plan(22);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

do $$
declare
  v_area_ts    smallint;
  v_area_psic  smallint;
  v_uid_ts     uuid := '96000000-0000-4000-a000-000000000001';
  v_uid_psic   uuid := '96000000-0000-4000-a000-000000000002';
  v_uid_rec    uuid := '96000000-0000-4000-a000-000000000003';
  v_uid_inact  uuid := '96000000-0000-4000-a000-000000000004';
  v_uid_umeca  uuid := '96000000-0000-4000-a000-000000000005';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';

  insert into auth.users (id, email) values
    (v_uid_ts,    'test26.ts@semujeres.local'),
    (v_uid_psic,  'test26.psic@semujeres.local'),
    (v_uid_rec,   'test26.rec@semujeres.local'),
    (v_uid_inact, 'test26.inact@semujeres.local'),
    (v_uid_umeca, 'test26.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,    'TS Actividades Test',       'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psic Actividades Test',     'psicologia',     v_area_psic, true),
    (v_uid_rec,   'Recepción Actividades Test','recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Actividades Test', 'trabajo_social', v_area_ts,   false)
  on conflict (id) do nothing;

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umeca, 'UMECA Actividades Test', 'umeca', true)
  on conflict (id) do nothing;
end $$;

-- 1-2. Seguridad: anon rechazado con 42501
set local role anon;
select throws_ok(
  $$select * from public.get_actividades_preventivas()$$,
  '42501',
  null,
  'anon no puede consultar get_actividades_preventivas'
);
select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Charla anon',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-01T10:00:00Z'
      )
    )
  $$,
  '42501',
  null,
  'anon no puede ejecutar registrar_actividad_preventiva'
);

-- 3-4. Seguridad: empleado inactivo rechazado con 42501
select pg_temp.as_user('96000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.get_actividades_preventivas()$$,
  '42501',
  null,
  'empleado inactivo no puede consultar actividades preventivas'
);
select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Charla inactivo',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-01T10:00:00Z'
      )
    )
  $$,
  '42501',
  null,
  'empleado inactivo no puede registrar actividades preventivas'
);

-- 5-6. Seguridad: UMECA rechazado con 42501
select pg_temp.as_user('96000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_actividades_preventivas()$$,
  '42501',
  null,
  'UMECA no puede consultar actividades preventivas'
);
select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Charla UMECA',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-01T10:00:00Z'
      )
    )
  $$,
  '42501',
  null,
  'UMECA no puede registrar actividades preventivas'
);

-- 7-8. Recepción puede listar pero NO registrar
select pg_temp.as_user('96000000-0000-4000-a000-000000000003');
select ok(
  (select count(*) >= 2 from public.get_actividades_preventivas()),
  'recepcion puede listar actividades preventivas (incluyendo seeds)'
);
select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Charla recepcion',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-01T10:00:00Z'
      )
    )
  $$,
  '42501',
  null,
  'recepcion no puede registrar actividades preventivas (42501)'
);

-- 9-10. Trabajo Social registra actividad escolar con asentamiento y 2 participantes
select pg_temp.as_user('96000000-0000-4000-a000-000000000001');
select is(
  (
    select r.total_participantes
    from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'TEST26 Taller Escolar',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'escuela',
        'nivel_educativo', 'preparatoria',
        'sede', 'CBTis 43',
        'direccion', 'Blvd. Jiquilpan 100',
        'referencias', 'Auditorio B',
        'asentamiento_id', (select id from public.cat_asentamiento order by id limit 1),
        'programada_en', '2026-12-15T16:00:00Z',
        'numero_asistentes', 65,
        'participantes_ids', jsonb_build_array(
          '96000000-0000-4000-a000-000000000001',
          '96000000-0000-4000-a000-000000000002'
        )
      )
    ) r
  ),
  2,
  'trabajo_social registra actividad escolar con 2 participantes en una transacción'
);

select ok(
  exists (
    select 1
    from public.get_actividades_preventivas() g
    where g.titulo = 'TEST26 Taller Escolar'
      and g.asentamiento_nombre is not null
      and g.codigo_postal is not null
      and g.nivel_educativo = 'preparatoria'
      and jsonb_array_length(g.participantes) = 2
  ),
  'get_actividades_preventivas devuelve asentamiento, código postal y 2 participantes en jsonb'
);

-- 11-12. Psicología registra actividad sin participantes ni asentamiento
select pg_temp.as_user('96000000-0000-4000-a000-000000000002');
select is(
  (
    select r.total_participantes
    from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'TEST26 Plática Comunitaria',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'conversatorio'),
        'tipo_institucion', 'comunidad',
        'sede', 'Parque Sinaloa',
        'programada_en', '2026-12-20T18:00:00Z'
      )
    ) r
  ),
  0,
  'actividad sin participantes ni asentamiento devuelve total_participantes = 0'
);

select ok(
  exists (
    select 1
    from public.get_actividades_preventivas() g
    where g.titulo = 'TEST26 Plática Comunitaria'
      and g.asentamiento_nombre is null
      and g.participantes = '[]'::jsonb
  ),
  'get_actividades_preventivas devuelve participantes = [] cuando no hay empleados asignados'
);

-- 13. Deduplicación de participantes repetidos
select is(
  (
    select r.total_participantes
    from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'TEST26 Participante Duplicado',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'conferencia'),
        'tipo_institucion', 'otro',
        'sede', 'Casa de la Cultura',
        'programada_en', '2026-12-22T12:00:00Z',
        'participantes_ids', jsonb_build_array(
          '96000000-0000-4000-a000-000000000002',
          '96000000-0000-4000-a000-000000000002'
        )
      )
    ) r
  ),
  1,
  'participantes_ids duplicados se deduplican antes de insertar'
);

-- 14-16. Filtros de rango y validaciones de consulta
select ok(
  (
    select count(*) = 1
    from public.get_actividades_preventivas(
      '2026-12-15T00:00:00Z'::timestamptz,
      '2026-12-16T00:00:00Z'::timestamptz,
      50
    ) g
    where g.titulo like 'TEST26%'
  ),
  'filtro por rango p_desde/p_hasta devuelve solo actividades dentro del intervalo'
);

select throws_ok(
  $$
    select * from public.get_actividades_preventivas(
      '2026-12-20T00:00:00Z'::timestamptz,
      '2026-12-10T00:00:00Z'::timestamptz,
      50
    )
  $$,
  '23514',
  null,
  'p_desde > p_hasta lanza 23514'
);

select throws_ok(
  $$select * from public.get_actividades_preventivas(null, null, 0)$$,
  '23514',
  null,
  'p_limite fuera de rango (0) lanza 23514'
);

-- 17-21. Validaciones 23514 en registrar_actividad_preventiva
select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Nivel fuera de escuela',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'nivel_educativo', 'secundaria',
        'sede', 'Cancha Ejidal',
        'programada_en', '2026-12-25T10:00:00Z'
      )
    )
  $$,
  '23514',
  null,
  'nivel_educativo con tipo_institucion <> escuela lanza 23514'
);

select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', '   ',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-25T10:00:00Z'
      )
    )
  $$,
  '23514',
  null,
  'titulo vacío lanza 23514'
);

select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Tipo inexistente',
        'tipo_actividad_id', 9999,
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-25T10:00:00Z'
      )
    )
  $$,
  '23514',
  null,
  'tipo_actividad_id inexistente lanza 23514'
);

select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'Asentamiento inexistente',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'asentamiento_id', -1,
        'sede', 'Plaza',
        'programada_en', '2026-12-25T10:00:00Z'
      )
    )
  $$,
  '23514',
  null,
  'asentamiento_id inexistente lanza 23514'
);

select throws_ok(
  $$
    select * from public.registrar_actividad_preventiva(
      jsonb_build_object(
        'titulo', 'TEST26 Fallo Participante Inactivo',
        'tipo_actividad_id', (select id from public.cat_tipo_actividad where clave = 'taller'),
        'tipo_institucion', 'comunidad',
        'sede', 'Plaza',
        'programada_en', '2026-12-25T10:00:00Z',
        'participantes_ids', jsonb_build_array(
          '96000000-0000-4000-a000-000000000001',
          '96000000-0000-4000-a000-000000000004'
        )
      )
    )
  $$,
  '23514',
  null,
  'participantes_ids con empleado inactivo lanza 23514'
);

-- 22. Atomicidad: la actividad con participante inactivo no debe quedar persistida
select is(
  (
    select count(*)::integer
    from public.actividad_preventiva ap
    where ap.titulo = 'TEST26 Fallo Participante Inactivo'
  ),
  0,
  'fallo en validación de participantes no deja actividad huérfana'
);

select * from finish();

rollback;
