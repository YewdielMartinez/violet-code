-- =====================================================================
-- 41_folio_seguimiento.test.sql (Tarjeta #89, revertida por #118)
-- Verifica que registrar_seguimiento() funciona sin folio_seguimiento,
-- rechaza p_folio_seguimiento desde front y la columna/función ya no existen.
-- =====================================================================

begin;

select plan(4);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;

-- Datos base aislados
insert into public.persona (
  id, curp, nombres, apellido_paterno, apellido_materno, creado_por
) values (
  '95000000-0000-4000-a000-000000000101',
  'FOLI900510MSLRNRA1',
  'Valeria', 'Folio', 'Seguimiento',
  '11111111-1111-4111-8111-111111111103'
);

insert into public.ficha_registro (
  id, persona_id, aviso_privacidad_aceptado_en, creado_por
) values (
  '95000000-0000-4000-a000-000000000201',
  '95000000-0000-4000-a000-000000000101',
  now(),
  '11111111-1111-4111-8111-111111111103'
);

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '95000000-0000-4000-a000-000000000301',
  '95000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '10 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- 1) La columna folio_seguimiento y función generadora ya no existen (#118)
select is(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'atencion'
      and column_name = 'folio_seguimiento'
  ),
  false,
  'atencion.folio_seguimiento fue eliminada por #118'
);

-- 2) generar_folio_seguimiento() ya no existe
select is(
  to_regprocedure('public.generar_folio_seguimiento()'),
  null,
  'generar_folio_seguimiento() fue eliminada por #118'
);

-- 3) registrar_seguimiento registra la atención sin devolver folio_seguimiento
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

create temp table tmp_seg1 as
select * from public.registrar_seguimiento(
  '95000000-0000-4000-a000-000000000201',
  '95000000-0000-4000-a000-000000000301',
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  'Seguimiento sin folio.'
);

select ok(
  (select atencion_id is not null from tmp_seg1),
  'registrar_seguimiento crea atencion_id sin folio_seguimiento'
);

-- 4) registrar_seguimiento no acepta parámetro p_folio_seguimiento desde el front (42883)
select throws_ok(
  $$select * from public.registrar_seguimiento(
      p_ficha_id => '95000000-0000-4000-a000-000000000201',
      p_cita_id => '95000000-0000-4000-a000-000000000301',
      p_tipo_atencion_id => (select id from public.cat_tipo_atencion where clave = 'orientacion'),
      p_folio_seguimiento => 'SEG-MANUAL-99999'
    )$$,
  '42883',
  null,
  'registrar_seguimiento rechaza parámetro p_folio_seguimiento desde el front'
);

select * from finish();
rollback;
