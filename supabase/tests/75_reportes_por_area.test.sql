create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 75_reportes_por_area.test.sql (pgTAP · RF-13 · Estadísticas y reportes)
-- Pruebas de la migración 75_reportes_por_area.sql (public.get_reporte):
--   - RBAC: anon, inactivo, recepción y UMECA reciben 42501.
--   - Validaciones 23514 (tipo, fechas nulas, rango invertido, rango > 5
--     años, agrupación).
--   - Atenciones: Dirección ve todas las áreas y filtra por p_area_id; las
--     áreas de atención se fuerzan a la suya aunque pidan otra; agrupación
--     por mes / periodo; primera vez vs seguimiento y mujeres / hombres.
--   - Citas, canalizaciones, órdenes de protección, actividades y alertas
--     con su alcance por área.
--   - La salida es solo agregada: sin columnas de CURP, nombres ni ids.
-- Todo el fixture cae en marzo de 2024 para no mezclarse con datos semilla.
-- =====================================================================

begin;

select plan(28);

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
  v_area_ts    smallint;
  v_area_psic  smallint;
  v_tipo_ts    smallint;
  v_tipo_psic  smallint;
  v_tipo_act   smallint;
  v_uid_dir    uuid := '75000000-0000-4000-a000-000000000001';
  v_uid_ts     uuid := '75000000-0000-4000-a000-000000000002';
  v_uid_psic   uuid := '75000000-0000-4000-a000-000000000003';
  v_uid_rec    uuid := '75000000-0000-4000-a000-000000000004';
  v_uid_inact  uuid := '75000000-0000-4000-a000-000000000005';
  v_uid_umeca  uuid := '75000000-0000-4000-a000-000000000006';
  v_per_1      uuid := '75000000-0000-4000-a000-000000000101';
  v_per_2      uuid := '75000000-0000-4000-a000-000000000102';
  v_fic_1      uuid := '75000000-0000-4000-a000-000000000201';
  v_fic_2      uuid := '75000000-0000-4000-a000-000000000202';
  v_der_juri   uuid := '75000000-0000-4000-a000-000000000301';
  v_der_psic   uuid := '75000000-0000-4000-a000-000000000302';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';

  select cta.id into v_tipo_ts   from public.cat_tipo_atencion cta where cta.area_id = v_area_ts   order by cta.id limit 1;
  select cta.id into v_tipo_psic from public.cat_tipo_atencion cta where cta.area_id = v_area_psic order by cta.id limit 1;
  select cat.id into v_tipo_act  from public.cat_tipo_actividad cat order by cat.id limit 1;

  insert into auth.users (id, email) values
    (v_uid_dir,   'test75.dir@semujeres.local'),
    (v_uid_ts,    'test75.ts@semujeres.local'),
    (v_uid_psic,  'test75.psic@semujeres.local'),
    (v_uid_rec,   'test75.rec@semujeres.local'),
    (v_uid_inact, 'test75.inact@semujeres.local'),
    (v_uid_umeca, 'test75.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_dir,   'Titular Reportes75',  'titular',        null,        true),
    (v_uid_ts,    'TS Reportes75',       'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psic Reportes75',     'psicologia',     v_area_psic, true),
    (v_uid_rec,   'Recep Reportes75',    'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Reportes75', 'titular',        null,        false)
  on conflict (id) do nothing;
  update auth.users u
     set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true)
   where exists (select 1 from public.empleado e where e.id = u.id)
     and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umeca, 'UMECA Reportes75', 'umeca', true)
  on conflict (id) do nothing;
  update auth.users u
     set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('externo'::text), true)
   where u.id = v_uid_umeca;

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_1, 'RACA930410MSLRRR75', 'Lucia',  'Reporte', v_uid_ts),
    (v_per_2, 'RACB910615HSLRRR75', 'Carlos', 'Reporte', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_1, 'SEM-TEST75-01', v_per_1, now(), v_uid_ts),
    (v_fic_2, 'SEM-TEST75-02', v_per_2, now(), v_uid_ts);

  -- Atenciones: Lucía (M) en TS dos veces (primera vez + seguimiento); Carlos (H) en Psicología una vez.
  insert into public.atencion (ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en, creado_por) values
    (v_fic_1, v_area_ts,   v_tipo_ts,   v_uid_ts,   '2024-03-05T18:00:00Z'::timestamptz, v_uid_ts),
    (v_fic_1, v_area_ts,   v_tipo_ts,   v_uid_ts,   '2024-03-20T18:00:00Z'::timestamptz, v_uid_ts),
    (v_fic_2, v_area_psic, v_tipo_psic, v_uid_psic, '2024-03-12T18:00:00Z'::timestamptz, v_uid_psic);

  -- Citas: TS agendada; Psicología asistió y no asistió.
  insert into public.cita (persona_id, area_id, programada_en, estado, creado_por) values
    (v_per_1, v_area_ts,   '2024-03-10T17:00:00Z', 'agendada',   v_uid_ts),
    (v_per_2, v_area_psic, '2024-03-11T17:00:00Z', 'asistio',    v_uid_psic),
    (v_per_2, v_area_psic, '2024-03-18T17:00:00Z', 'no_asistio', v_uid_psic);

  -- Canalizaciones de TS: a Jurídico (concluida a los 4 días) y a Psicología (pendiente).
  insert into public.derivacion (id, ficha_id, destino, area_destino_id, area_origen_id, fecha_derivacion, estado, motivo) values
    (v_der_juri, v_fic_1, 'juridico',   (select id from public.cat_area where clave = 'juridico'),   v_area_ts, '2024-03-05', 'concluida', 'Reporte75 a Juridico'),
    (v_der_psic, v_fic_1, 'psicologia', v_area_psic,                                                  v_area_ts, '2024-03-06', 'pendiente', 'Reporte75 a Psicologia');
  insert into public.canalizacion_evento (derivacion_id, estado_anterior, estado_nuevo, creado_por, creado_en) values
    (v_der_juri, 'en_proceso', 'concluida', v_uid_ts, '2024-03-09T18:00:00Z');

  -- Orden de protección registrada por TS.
  insert into public.orden_proteccion (ficha_id, numero_oficio, fecha_emision, fecha_vigencia, estado, creado_por) values
    (v_fic_1, 'OF-REP75-1', '2024-03-10', '2024-04-10', 'vigente', v_uid_ts);

  -- Actividades preventivas: dos realizadas (40 + 25 asistentes) y una cancelada.
  insert into public.actividad_preventiva
    (titulo, tipo_actividad_id, tipo_institucion, sede, programada_en, numero_asistentes, estado, realizada_en) values
    ('Reportes75 A', v_tipo_act, 'comunidad', 'Sede A', '2024-03-12T18:00:00Z', 40, 'realizada', '2024-03-12T20:00:00Z'),
    ('Reportes75 B', v_tipo_act, 'escuela',   'Sede B', '2024-03-13T18:00:00Z', 25, 'realizada', '2024-03-13T20:00:00Z'),
    ('Reportes75 C', v_tipo_act, 'comunidad', 'Sede C', '2024-03-14T18:00:00Z', null, 'pendiente', null);
  update public.actividad_preventiva set estado = 'cancelada' where titulo = 'Reportes75 C';

  -- Alertas telefónicas: atendidas a los 30 y 10 minutos (promedio 20) y una presencial nueva.
  insert into public.alerta (origen, estado, creado_en, atendida_en) values
    ('telefono',   'atendida', '2024-03-08T10:00:00Z', '2024-03-08T10:30:00Z'),
    ('telefono',   'atendida', '2024-03-09T10:00:00Z', '2024-03-09T10:10:00Z'),
    ('presencial', 'nueva',    '2024-03-10T10:00:00Z', null);
end $$;

-- 1. anon rechazado
set local role anon;
select throws_ok(
  $$select * from public.get_reporte('atenciones', '2024-03-01', '2024-03-31')$$,
  '42501', null, 'anon no puede consultar get_reporte'
);

-- 2. empleado inactivo
select pg_temp.as_user('75000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.get_reporte('atenciones', '2024-03-01', '2024-03-31')$$,
  '42501', null, 'empleado inactivo no puede consultar get_reporte'
);

-- 3. recepción
select pg_temp.as_user('75000000-0000-4000-a000-000000000004');
select throws_ok(
  $$select * from public.get_reporte('citas', '2024-03-01', '2024-03-31')$$,
  '42501', null, 'recepcion no puede consultar get_reporte'
);

-- 4. UMECA
select pg_temp.as_user('75000000-0000-4000-a000-000000000006');
select throws_ok(
  $$select * from public.get_reporte('citas', '2024-03-01', '2024-03-31')$$,
  '42501', null, 'UMECA no puede consultar get_reporte'
);

-- 5-9. Validaciones (Dirección)
select pg_temp.as_user('75000000-0000-4000-a000-000000000001');
select throws_ok(
  $$select * from public.get_reporte('inexistente', '2024-03-01', '2024-03-31')$$,
  '23514', null, 'p_tipo desconocido lanza 23514'
);
select throws_ok(
  $$select * from public.get_reporte('citas', null, '2024-03-31')$$,
  '23514', null, 'p_desde nulo lanza 23514'
);
select throws_ok(
  $$select * from public.get_reporte('citas', '2024-04-01', '2024-03-01')$$,
  '23514', null, 'p_desde > p_hasta lanza 23514'
);
select throws_ok(
  $$select * from public.get_reporte('citas', '2015-01-01', '2024-03-31')$$,
  '23514', null, 'un rango mayor a 5 años lanza 23514'
);
select throws_ok(
  $$select * from public.get_reporte('citas', '2024-03-01', '2024-03-31', null, 'semana')$$,
  '23514', null, 'p_agrupar inválido lanza 23514'
);

-- 10-11. Atenciones: Dirección ve todas las áreas con primera vez / seguimiento y sexo
select ok(
  exists (
    select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'periodo') r
    where r.area = 'Trabajo Social' and r.estado = 'primera_vez' and r.total = 1 and r.mujeres = 1 and r.hombres = 0
  )
  and exists (
    select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'periodo') r
    where r.area = 'Trabajo Social' and r.estado = 'seguimiento' and r.total = 1
  ),
  'atenciones: TS tiene una primera vez y un seguimiento con mujeres = 1'
);
select ok(
  exists (
    select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'periodo') r
    where r.area = 'Psicología' and r.total = 1 and r.hombres = 1 and r.mujeres = 0
  ),
  'atenciones: Dirección ve también Psicología (hombres = 1)'
);

-- 12-13. Agrupación mes / periodo
select ok(
  exists (select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'mes') r where r.mes = date '2024-03-01')
  and not exists (select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'mes') r where r.mes is null),
  'agrupar = mes devuelve el primer día del mes'
);
select ok(
  not exists (select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'periodo') r where r.mes is not null),
  'agrupar = periodo devuelve mes nulo'
);

-- 13b. Agrupación total: una fila con personas distintas de todo el rango
select ok(
  (select count(*) from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'total')) = 1
  and exists (
    select 1 from public.get_reporte('atenciones', '2024-03-01', '2024-03-31', null, 'total') r
    where r.total = 3 and r.personas = 2 and r.mujeres = 1 and r.hombres = 1 and r.metrica = 2
      and r.area_id is null and r.categoria is null and r.estado is null and r.mes is null
  ),
  'agrupar = total devuelve una fila (3 atenciones, 2 personas, 1 mujer, 1 hombre, 2 de primera vez)'
);

-- 14. Dirección filtra por área
select ok(
  exists (
    select 1 from public.get_reporte(
      'atenciones', '2024-03-01', '2024-03-31',
      (select id from public.cat_area where clave = 'psicologia'), 'periodo'
    )
  )
  and not exists (
    select 1 from public.get_reporte(
      'atenciones', '2024-03-01', '2024-03-31',
      (select id from public.cat_area where clave = 'psicologia'), 'periodo'
    ) r where r.area <> 'Psicología'
  ),
  'Dirección acota atenciones con p_area_id'
);

-- 15. TS forzada a su área aunque pida Psicología
select pg_temp.as_user('75000000-0000-4000-a000-000000000002');
select ok(
  exists (
    select 1 from public.get_reporte(
      'atenciones', '2024-03-01', '2024-03-31',
      (select id from public.cat_area where clave = 'psicologia'), 'periodo'
    ) r where r.area = 'Trabajo Social'
  )
  and not exists (
    select 1 from public.get_reporte(
      'atenciones', '2024-03-01', '2024-03-31',
      (select id from public.cat_area where clave = 'psicologia'), 'periodo'
    ) r where r.area is distinct from 'Trabajo Social'
  ),
  'trabajo_social ignora p_area_id y solo ve Trabajo Social'
);

-- 16-17. Citas
select pg_temp.as_user('75000000-0000-4000-a000-000000000001');
select ok(
  exists (select 1 from public.get_reporte('citas', '2024-03-01', '2024-03-31', null, 'periodo') r
          where r.area = 'Trabajo Social' and r.estado = 'agendada' and r.total = 1)
  and exists (select 1 from public.get_reporte('citas', '2024-03-01', '2024-03-31', null, 'periodo') r
              where r.area = 'Psicología' and r.estado = 'asistio' and r.total = 1)
  and exists (select 1 from public.get_reporte('citas', '2024-03-01', '2024-03-31', null, 'periodo') r
              where r.area = 'Psicología' and r.estado = 'no_asistio' and r.total = 1),
  'citas: conteo por área y estado'
);
select pg_temp.as_user('75000000-0000-4000-a000-000000000003');
select ok(
  exists (select 1 from public.get_reporte('citas', '2024-03-01', '2024-03-31', null, 'periodo') r where r.area = 'Psicología')
  and not exists (select 1 from public.get_reporte('citas', '2024-03-01', '2024-03-31', null, 'periodo') r where r.area <> 'Psicología'),
  'citas: psicologia solo ve su área'
);

-- 18-20. Canalizaciones
select pg_temp.as_user('75000000-0000-4000-a000-000000000001');
select ok(
  exists (select 1 from public.get_reporte('canalizaciones', '2024-03-01', '2024-03-31', null, 'periodo') r
          where r.categoria = 'juridico' and r.estado = 'concluida' and r.total = 1 and r.metrica = 4.0)
  and exists (select 1 from public.get_reporte('canalizaciones', '2024-03-01', '2024-03-31', null, 'periodo') r
              where r.categoria = 'psicologia' and r.estado = 'pendiente' and r.metrica is null),
  'canalizaciones: por destino y estado, con días promedio a conclusión (4) solo en concluidas'
);
select pg_temp.as_user('75000000-0000-4000-a000-000000000003');
select ok(
  exists (select 1 from public.get_reporte('canalizaciones', '2024-03-01', '2024-03-31', null, 'periodo') r where r.categoria = 'psicologia'),
  'canalizaciones: psicologia ve las que tienen a su área como destino'
);
select ok(
  not exists (select 1 from public.get_reporte('canalizaciones', '2024-03-01', '2024-03-31', null, 'periodo') r where r.categoria = 'juridico'),
  'canalizaciones: psicologia no ve las de otras áreas'
);

-- 21-22. Órdenes de protección
select pg_temp.as_user('75000000-0000-4000-a000-000000000001');
select ok(
  exists (select 1 from public.get_reporte('ordenes_proteccion', '2024-03-01', '2024-03-31', null, 'periodo') r
          where r.area = 'Trabajo Social' and r.estado = 'vigente' and r.total = 1),
  'órdenes de protección: conteo por área del registrante y estado'
);
select pg_temp.as_user('75000000-0000-4000-a000-000000000003');
select is(
  (select count(*)::integer from public.get_reporte('ordenes_proteccion', '2024-03-01', '2024-03-31', null, 'periodo')),
  0,
  'órdenes de protección: psicologia no ve las de Trabajo Social'
);

-- 23-24. Actividades preventivas (sin área)
select ok(
  exists (select 1 from public.get_reporte('actividades', '2024-03-01', '2024-03-31', null, 'periodo') r
          where r.categoria = 'comunidad' and r.estado = 'realizada' and r.total = 1 and r.metrica = 40 and r.area_id is null)
  and exists (select 1 from public.get_reporte('actividades', '2024-03-01', '2024-03-31', null, 'periodo') r
              where r.categoria = 'escuela' and r.estado = 'realizada' and r.metrica = 25)
  and exists (select 1 from public.get_reporte('actividades', '2024-03-01', '2024-03-31', null, 'periodo') r
              where r.estado = 'cancelada' and r.total = 1),
  'actividades: por tipo de institución y estado con asistentes de las realizadas'
);

-- 24. Alertas (sin área): minutos promedio a atención
select ok(
  exists (select 1 from public.get_reporte('alertas', '2024-03-01', '2024-03-31', null, 'periodo') r
          where r.categoria = 'telefono' and r.estado = 'atendida' and r.total = 2 and r.metrica = 20.0)
  and exists (select 1 from public.get_reporte('alertas', '2024-03-01', '2024-03-31', null, 'periodo') r
              where r.categoria = 'presencial' and r.estado = 'nueva' and r.metrica is null),
  'alertas: por origen y estado con minutos promedio de atención'
);

-- 25. Sin datos: 0 filas sin error
select is(
  (select count(*)::integer from public.get_reporte('atenciones', '2010-01-01', '2010-01-31', null, 'periodo')),
  0,
  'sin datos en el rango devuelve 0 filas'
);

-- 26-27. Privacidad: salida solo agregada
select ok(
  not exists (
    select 1
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.specific_name like 'get_reporte%'
      and p.parameter_mode = 'OUT'
      -- `personas` es un conteo agregado (no PII); se excluye explícitamente.
      and p.parameter_name <> 'personas'
      and (p.parameter_name ~* '(curp|nombre|apellido|folio|persona|ficha|expediente|celular|telefono|correo)')
  ),
  'get_reporte no expone columnas de CURP, nombres, folios ni ids de persona o ficha'
);
select is(
  (
    select array_agg(p.parameter_name::text order by p.ordinal_position)
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.specific_name like 'get_reporte%'
      and p.parameter_mode = 'OUT'
  ),
  array['tipo', 'mes', 'area_id', 'area', 'categoria', 'estado', 'total', 'personas', 'mujeres', 'hombres', 'metrica'],
  'get_reporte devuelve exactamente las 11 columnas agregadas documentadas'
);

select * from finish();

rollback;
