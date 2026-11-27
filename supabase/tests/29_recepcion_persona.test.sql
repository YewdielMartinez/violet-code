-- =====================================================================
-- 29_recepcion_persona.test.sql (pgTAP · B-08 · RNF-02, RN-04)
-- Pruebas de integración para migración 29_recepcion_sin_curp.sql:
--   - Recepción obtiene 0 filas al consultar public.persona directo
--   - Recepción sigue viendo nombre_completo y celular en get_agenda
--     y get_lista_urgencias (sin CURP)
--   - titular, trabajo_social, psicologia y juridico conservan persona_select
--   - umeca e inactivo obtienen 0 filas; anon es rechazado con 42501
-- =====================================================================

begin;

select plan(10);

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
  v_area_jur   smallint;
  v_tipo_ts    smallint;
  v_uid_dir    uuid := '99000000-0000-4000-a000-000000000001';
  v_uid_ts     uuid := '99000000-0000-4000-a000-000000000002';
  v_uid_psic   uuid := '99000000-0000-4000-a000-000000000003';
  v_uid_jur    uuid := '99000000-0000-4000-a000-000000000004';
  v_uid_rec    uuid := '99000000-0000-4000-a000-000000000005';
  v_uid_inact  uuid := '99000000-0000-4000-a000-000000000006';
  v_uid_umeca  uuid := '99000000-0000-4000-a000-000000000007';
  v_per_ag     uuid := '99000000-0000-4000-a000-000000000101';
  v_per_urg    uuid := '99000000-0000-4000-a000-000000000102';
  v_fic_urg    uuid := '99000000-0000-4000-a000-000000000202';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';
  select ca.id into v_area_jur  from public.cat_area ca where ca.clave = 'juridico';

  select cta.id into v_tipo_ts
  from public.cat_tipo_atencion cta
  where cta.area_id = v_area_ts
  order by cta.id
  limit 1;

  insert into auth.users (id, email) values
    (v_uid_dir,   'test29.dir@semujeres.local'),
    (v_uid_ts,    'test29.ts@semujeres.local'),
    (v_uid_psic,  'test29.psic@semujeres.local'),
    (v_uid_jur,   'test29.jur@semujeres.local'),
    (v_uid_rec,   'test29.rec@semujeres.local'),
    (v_uid_inact, 'test29.inact@semujeres.local'),
    (v_uid_umeca, 'test29.umeca@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_dir,   'Titular Persona Test',    'titular',        null,        true),
    (v_uid_ts,    'TS Persona Test',         'trabajo_social', v_area_ts,   true),
    (v_uid_psic,  'Psicologia Persona Test', 'psicologia',     v_area_psic, true),
    (v_uid_jur,   'Juridico Persona Test',   'juridico',       v_area_jur,  true),
    (v_uid_rec,   'Recepcion Persona Test',  'recepcion',      null,        true),
    (v_uid_inact, 'Inactivo Persona Test',   'trabajo_social', v_area_ts,   false)
  on conflict (id) do nothing;
  update auth.users u set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true) where exists (select 1 from public.empleado e where e.id = u.id) and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umeca, 'UMECA Persona Test', 'umeca', true)
  on conflict (id) do nothing;

  insert into public.persona (id, curp, nombres, apellido_paterno, celular, creado_por) values
    (v_per_ag,  'TETA900210MSLRRR01', 'AgendaNombre',   'Prueba', '6681002001', v_uid_ts),
    (v_per_urg, 'TETU910315MSLRRR02', 'UrgenciaNombre', 'Prueba', '6681002002', v_uid_ts);

  -- Cita agendada en TS para comprobar get_agenda
  insert into public.cita (persona_id, area_id, programada_en, estado, origen, creado_por) values
    (v_per_ag, v_area_ts, now() + interval '2 days', 'agendada', 'regular', v_uid_rec);

  -- Ficha + atención prioridad alta sin cita futura para comprobar get_lista_urgencias
  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_urg, 'SEM-TEST29-02', v_per_urg, now(), v_uid_ts);

  insert into public.atencion (ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en, prioridad, creado_por) values
    (v_fic_urg, v_area_ts, v_tipo_ts, v_uid_ts, now() - interval '2 days', 'alta', v_uid_ts);
end $$;

-- 1-3. Recepción: 0 filas en public.persona, pero ve nombres y celulares en get_agenda y get_lista_urgencias
select pg_temp.as_user('99000000-0000-4000-a000-000000000005');
select is(
  (select count(*)::integer from public.persona),
  0,
  'recepcion obtiene 0 filas al consultar public.persona directo'
);

select ok(
  exists (
    select 1
    from public.get_agenda(now(), now() + interval '5 days', null, null, 100) ga
    where ga.persona_id = '99000000-0000-4000-a000-000000000101'
      and ga.nombre_completo like 'AgendaNombre%'
      and ga.celular = '6681002001'
  ),
  'recepcion sigue viendo nombre_completo y celular por get_agenda sin exponer CURP'
);

select ok(
  exists (
    select 1
    from public.get_lista_urgencias(null) glu
    where glu.persona_id = '99000000-0000-4000-a000-000000000102'
      and glu.nombre_completo like 'UrgenciaNombre%'
      and glu.celular = '6681002002'
  ),
  'recepcion sigue viendo nombre_completo y celular por get_lista_urgencias sin exponer CURP'
);

-- 4-7. Roles con expediente.ver conservan lectura de public.persona
select pg_temp.as_user('99000000-0000-4000-a000-000000000001');
select ok((select count(*) >= 1 from public.persona where id = '99000000-0000-4000-a000-000000000101'), 'titular lee public.persona');

select pg_temp.as_user('99000000-0000-4000-a000-000000000002');
select ok((select count(*) >= 1 from public.persona where id = '99000000-0000-4000-a000-000000000101'), 'trabajo_social lee public.persona');

select pg_temp.as_user('99000000-0000-4000-a000-000000000003');
select ok((select count(*) >= 1 from public.persona where id = '99000000-0000-4000-a000-000000000101'), 'psicologia lee public.persona');

select pg_temp.as_user('99000000-0000-4000-a000-000000000004');
select ok((select count(*) >= 1 from public.persona where id = '99000000-0000-4000-a000-000000000101'), 'juridico lee public.persona');

-- 8-10. UMECA, inactivo y anon bloqueados
select pg_temp.as_user('99000000-0000-4000-a000-000000000007');
select is((select count(*)::integer from public.persona), 0, 'umeca obtiene 0 filas de public.persona');

select pg_temp.as_user('99000000-0000-4000-a000-000000000006');
select is((select count(*)::integer from public.persona), 0, 'empleado inactivo obtiene 0 filas de public.persona');

set local role anon;
select throws_ok(
  $$select * from public.persona limit 1$$,
  '42501',
  null,
  'anon recibe 42501 al consultar public.persona'
);

select * from finish();

rollback;
