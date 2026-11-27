-- =====================================================================
-- 48_edad_expediente.test.sql (Tarjeta #111)
-- Verifica:
--   - calcular_edad(date) en America/Mazatlan (hoy vs 1 día antes, null).
--   - get_expediente_detalle() devuelve edad en persona y en agresores.
--   - buscar_expedientes() devuelve columna edad en CURP, folio y nombre.
-- =====================================================================

begin;

select plan(9);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1-4) calcular_edad(date)
select is(has_function_privilege('anon', 'public.calcular_edad(date)', 'execute'), false, 'anon sin EXECUTE en calcular_edad');
select is(public.calcular_edad(null), null::integer, 'calcular_edad(null) devuelve null');

select is(
  public.calcular_edad(((now() at time zone 'America/Mazatlan')::date - interval '30 years')::date),
  30,
  'cumpleaños de hoy devuelve edad completa (30)'
);

select is(
  public.calcular_edad((((now() at time zone 'America/Mazatlan')::date - interval '30 years') + interval '1 day')::date),
  29,
  'un día antes del cumpleaños devuelve un año menos (29)'
);

-- Datos aislados: persona con fecha conocida + 2 agresores (uno con fecha, otro sin fecha)
insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
values ('9c000000-0000-4000-a000-000000000101', 'EADA960510MSLRNR01', 'Rebeca', 'Edad', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por)
values ('9c000000-0000-4000-a000-000000000201', 'SEM-EDAD-0001', '9c000000-0000-4000-a000-000000000101', now(), '11111111-1111-4111-8111-111111111103');

insert into public.agresor (id, ficha_id, nombres, apellido_paterno, fecha_nacimiento, creado_por) values
  ('9c000000-0000-4000-a000-000000000301', '9c000000-0000-4000-a000-000000000201', 'Agresor Uno', 'Test', ((now() at time zone 'America/Mazatlan')::date - interval '35 years')::date, '11111111-1111-4111-8111-111111111103'),
  ('9c000000-0000-4000-a000-000000000302', '9c000000-0000-4000-a000-000000000201', 'Agresor Dos', 'Test', null, '11111111-1111-4111-8111-111111111103');

-- 5-6) get_expediente_detalle incluye persona.edad y agresores[*].edad
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

create temp table tmp_det as
select public.get_expediente_detalle('9c000000-0000-4000-a000-000000000201', true) as det;

select is(
  (select (det -> 'persona' ->> 'edad')::integer from tmp_det),
  public.calcular_edad('1996-05-10'::date),
  'get_expediente_detalle devuelve persona.edad calculada'
);

select is(
  (
    select json_build_array(
      (det -> 'agresores' -> 0 ->> 'edad')::integer,
      (det -> 'agresores' -> 1 ->> 'edad')::integer
    )::text
    from tmp_det
  ),
  json_build_array(35, null::integer)::text,
  'get_expediente_detalle devuelve edad en agresores cuando hay fecha_nacimiento y null si falta'
);

-- 7-9) buscar_expedientes devuelve edad en CURP, folio y nombre
select is(
  (select edad from public.buscar_expedientes('EADA960510MSLRNR01', 5, false)),
  public.calcular_edad('1996-05-10'::date),
  'buscar_expedientes por CURP devuelve edad'
);

select is(
  (select edad from public.buscar_expedientes('SEM-EDAD-0001', 5, false)),
  public.calcular_edad('1996-05-10'::date),
  'buscar_expedientes por folio devuelve edad'
);

select is(
  (select edad from public.buscar_expedientes('Rebeca Edad', 5, false) where ficha_id = '9c000000-0000-4000-a000-000000000201'),
  public.calcular_edad('1996-05-10'::date),
  'buscar_expedientes por nombre devuelve edad'
);

select * from finish();
rollback;
