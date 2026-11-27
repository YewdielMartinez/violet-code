create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 71_notas_psicologia_privadas.test.sql
-- Verifica la migración 20261128003000_71_notas_psicologia_privadas.sql:
--   - Las notas privadas de Psicología (nota_area con área 'psicologia')
--     solo las lee y escribe el rol `psicologia`.
--   - Titular, subdirección, trabajo social, jurídico y recepción ven 0
--     notas de Psicología y no pueden insertarlas ni editarlas.
--   - Las notas de trabajo social y jurídico no cambian: Dirección las
--     sigue leyendo (solo lectura) y cada área escribe las suyas.
--   - tiene_permiso conserva las claves existentes y suma
--     `nota_psicologia.acceder` solo para psicología.
-- =====================================================================

begin;

select plan(29);

do $$
declare
  v_uid_ts    uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_psic  uuid := '11111111-1111-4111-8111-111111111104';
  v_uid_jur   uuid := '11111111-1111-4111-8111-111111111105';
  v_area_ts   smallint;
  v_area_psic smallint;
  v_area_jur  smallint;
  v_per_a     uuid := '71000000-0000-4000-a000-000000000101';
  v_fic_a     uuid := '71000000-0000-4000-a000-000000000201';
begin
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values (v_per_a, 'PEHM900101MSLRRN71', 'Marina', 'Pérez', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por
  ) values (v_fic_a, 'SEM-S371-0001', v_per_a, 'abierto', now(), v_uid_ts);

  insert into public.nota_area (id, ficha_id, area_id, contenido, creado_por) values
    ('71000000-0000-4000-a000-000000000301', v_fic_a, v_area_ts,   'Nota privada TS A71',   v_uid_ts),
    ('71000000-0000-4000-a000-000000000302', v_fic_a, v_area_psic, 'Nota privada Psic A71', v_uid_psic),
    ('71000000-0000-4000-a000-000000000303', v_fic_a, v_area_jur,  'Nota privada Jur A71',  v_uid_jur);
end;
$$;

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
  end if;
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

set local role authenticated;

-- ---------------------------------------------------------------------
-- Psicología: ve y escribe sus notas, no las de otras áreas
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select count(*)::int from public.nota_area where id = '71000000-0000-4000-a000-000000000302'),
  1, 'psicologia ve su nota privada'
);
select is(
  (select count(*)::int from public.nota_area where id in (
    '71000000-0000-4000-a000-000000000301', '71000000-0000-4000-a000-000000000303')),
  0, 'psicologia no ve las notas de trabajo social ni juridico'
);
select lives_ok(
  $$insert into public.nota_area (id, ficha_id, area_id, contenido) values (
      '71000000-0000-4000-a000-000000000304', '71000000-0000-4000-a000-000000000201',
      (select id from public.cat_area where clave = 'psicologia'), 'Nota nueva Psic A71')$$,
  'psicologia crea una nota de su area'
);
select lives_ok(
  $$update public.nota_area set contenido = 'Psic editada A71'
    where id = '71000000-0000-4000-a000-000000000302'$$,
  'psicologia edita su nota'
);
select is(
  (select contenido from public.nota_area where id = '71000000-0000-4000-a000-000000000302'),
  'Psic editada A71', 'la edicion de psicologia se aplica'
);
select throws_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values (
      '71000000-0000-4000-a000-000000000201',
      (select id from public.cat_area where clave = 'trabajo_social'), 'Nota ajena')$$,
  '42501', null, 'psicologia no inserta notas de otra area'
);
select is(
  public.tiene_permiso('nota_psicologia.acceder'),
  true, 'psicologia tiene nota_psicologia.acceder'
);
select is(
  public.tiene_permiso('historial_clinico.escribir'),
  true, 'psicologia conserva historial_clinico.escribir'
);

-- ---------------------------------------------------------------------
-- Titular: 0 notas de Psicología; sigue leyendo las demás áreas
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'
     and area_id = (select id from public.cat_area where clave = 'psicologia')),
  0, 'titular ve 0 notas de psicologia'
);
select is(
  (select count(*)::int from public.nota_area
   where id in ('71000000-0000-4000-a000-000000000301', '71000000-0000-4000-a000-000000000303')),
  2, 'titular sigue leyendo las notas de trabajo social y juridico'
);
select throws_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values (
      '71000000-0000-4000-a000-000000000201',
      (select id from public.cat_area where clave = 'psicologia'), 'Nota titular')$$,
  '42501', null, 'titular no inserta notas de psicologia'
);
select lives_ok(
  $$update public.nota_area set contenido = 'Titular manipula'
    where id = '71000000-0000-4000-a000-000000000302'$$,
  'titular intenta editar una nota de psicologia (0 filas, sin error)'
);
select is(
  public.tiene_permiso('nota_psicologia.acceder'),
  false, 'titular no tiene nota_psicologia.acceder'
);
select is(
  public.tiene_permiso('historial_clinico.acceder'),
  true, 'titular conserva historial_clinico.acceder'
);

-- ---------------------------------------------------------------------
-- Subdirección
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid); -- subdireccion
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'
     and area_id = (select id from public.cat_area where clave = 'psicologia')),
  0, 'subdireccion ve 0 notas de psicologia'
);
select is(
  (select count(*)::int from public.nota_area
   where id in ('71000000-0000-4000-a000-000000000301', '71000000-0000-4000-a000-000000000303')),
  2, 'subdireccion sigue leyendo las notas de trabajo social y juridico'
);

-- ---------------------------------------------------------------------
-- Trabajo Social: ve y escribe las suyas, 0 de Psicología
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'
     and area_id = (select id from public.cat_area where clave = 'psicologia')),
  0, 'trabajo_social ve 0 notas de psicologia'
);
select is(
  (select count(*)::int from public.nota_area where id = '71000000-0000-4000-a000-000000000301'),
  1, 'trabajo_social sigue viendo su nota'
);
select lives_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values (
      '71000000-0000-4000-a000-000000000201',
      (select id from public.cat_area where clave = 'trabajo_social'), 'Nota nueva TS A71')$$,
  'trabajo_social sigue creando notas de su area'
);
select throws_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values (
      '71000000-0000-4000-a000-000000000201',
      (select id from public.cat_area where clave = 'psicologia'), 'Nota TS en psic')$$,
  '42501', null, 'trabajo_social no inserta notas de psicologia'
);
select is(
  public.tiene_permiso('nota_psicologia.acceder'),
  false, 'trabajo_social no tiene nota_psicologia.acceder'
);

-- ---------------------------------------------------------------------
-- Jurídico
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'
     and area_id = (select id from public.cat_area where clave = 'psicologia')),
  0, 'juridico ve 0 notas de psicologia'
);
select is(
  (select count(*)::int from public.nota_area where id = '71000000-0000-4000-a000-000000000303'),
  1, 'juridico sigue viendo su nota'
);
select throws_ok(
  $$insert into public.nota_area (ficha_id, area_id, contenido) values (
      '71000000-0000-4000-a000-000000000201',
      (select id from public.cat_area where clave = 'psicologia'), 'Nota Jur en psic')$$,
  '42501', null, 'juridico no inserta notas de psicologia'
);

-- ---------------------------------------------------------------------
-- Recepción: no lee ninguna nota
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'),
  0, 'recepcion no lee notas'
);
select is(
  public.tiene_permiso('agenda.crear'),
  true, 'recepcion conserva agenda.crear'
);

-- ---------------------------------------------------------------------
-- La manipulación de Dirección no alteró la nota de Psicología
-- ---------------------------------------------------------------------
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select contenido from public.nota_area where id = '71000000-0000-4000-a000-000000000302'),
  'Psic editada A71', 'la nota de psicologia no fue alterada por Dirección'
);
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'
     and area_id = (select id from public.cat_area where clave = 'psicologia')),
  2, 'psicologia ve sus dos notas (fixture + nueva)'
);
select is(
  (select count(*)::int from public.nota_area
   where ficha_id = '71000000-0000-4000-a000-000000000201'
     and area_id <> (select id from public.cat_area where clave = 'psicologia')),
  0, 'psicologia sigue sin ver notas de otras areas'
);

select * from finish();
rollback;
