-- =====================================================================
-- 41_folio_seguimiento.test.sql (Tarjeta #89)
-- Verifica generación automática en servidor de atencion.folio_seguimiento
-- con formato SEG-AAAA-NNNNN, unicidad, inmutabilidad y rechazo desde front.
-- =====================================================================

begin;

select plan(8);

-- Helper local para simular actor JWT
create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;

-- Datos base aislados para #89
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

insert into public.cita (id, persona_id, area_id, programada_en, estado, confirmada_en, origen, creado_por)
select
  '95000000-0000-4000-a000-000000000302',
  '95000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '11 hours',
  'confirmada',
  now(),
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '95000000-0000-4000-a000-000000000303',
  '95000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '12 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- 1) Filas existentes tienen folio_seguimiento no nulo y con formato SEG-AAAA-NNNNN
select ok(
  not exists (
    select 1 from public.atencion
    where folio_seguimiento is null
       or folio_seguimiento !~ '^SEG-\d{4}-\d{5}$'
  ),
  'todas las filas existentes de atencion tienen folio_seguimiento con formato SEG-AAAA-NNNNN'
);

-- 2) anon no puede ejecutar generar_folio_seguimiento()
select is(
  has_function_privilege('anon', 'public.generar_folio_seguimiento()', 'execute'),
  false,
  'anon no tiene EXECUTE sobre generar_folio_seguimiento()'
);

-- 3) registrar_seguimiento devuelve folio_seguimiento con formato SEG-AAAA-NNNNN
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

create temp table tmp_seg1 as
select * from public.registrar_seguimiento(
  '95000000-0000-4000-a000-000000000201',
  '95000000-0000-4000-a000-000000000301',
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  'Primer seguimiento con folio.'
);

select matches(
  (select folio_seguimiento from tmp_seg1),
  '^SEG-\d{4}-\d{5}$',
  'registrar_seguimiento devuelve folio_seguimiento con formato SEG-AAAA-NNNNN'
);

-- 4) El folio devuelto coincide con el persistido en public.atencion
select is(
  (select a.folio_seguimiento from public.atencion a where a.id = (select atencion_id from tmp_seg1)),
  (select folio_seguimiento from tmp_seg1),
  'el folio devuelto coincide con atencion.folio_seguimiento'
);

-- 5) Dos registros consecutivos generan folios únicos y distintos
create temp table tmp_seg2 as
select * from public.registrar_seguimiento(
  '95000000-0000-4000-a000-000000000201',
  '95000000-0000-4000-a000-000000000302',
  (select id from public.cat_tipo_atencion where clave = 'orientacion'),
  'Segundo seguimiento con folio.'
);

select isnt(
  (select folio_seguimiento from tmp_seg2),
  (select folio_seguimiento from tmp_seg1),
  'dos seguimientos consecutivos generan folios únicos distintos'
);

-- 6) registrar_seguimiento no acepta parámetro p_folio_seguimiento desde el front (42883)
select throws_ok(
  $$select * from public.registrar_seguimiento(
      p_ficha_id => '95000000-0000-4000-a000-000000000201',
      p_cita_id => '95000000-0000-4000-a000-000000000303',
      p_tipo_atencion_id => (select id from public.cat_tipo_atencion where clave = 'orientacion'),
      p_folio_seguimiento => 'SEG-MANUAL-99999'
    )$$,
  '42883',
  null,
  'registrar_seguimiento rechaza parámetro p_folio_seguimiento desde el front'
);

-- 7) Si un INSERT directo intenta enviar un folio manual, el trigger del servidor lo sobrescribe
reset role;
insert into public.atencion (
  id, ficha_id, cita_id, area_id, tipo_atencion_id, atendida_por, folio_seguimiento, creado_por
)
select
  '95000000-0000-4000-a000-000000000401',
  '95000000-0000-4000-a000-000000000201',
  '95000000-0000-4000-a000-000000000303',
  ca.id,
  (select id from public.cat_tipo_atencion where clave = 'orientacion'),
  '11111111-1111-4111-8111-111111111103',
  'MANUAL-00001',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

select matches(
  (select folio_seguimiento from public.atencion where id = '95000000-0000-4000-a000-000000000401'),
  '^SEG-\d{4}-\d{5}$',
  'insert directo no puede imponer folio manual; el trigger asigna SEG-AAAA-NNNNN'
);

-- 8) Intentar modificar folio_seguimiento vía UPDATE lanza 23514
select throws_ok(
  $$update public.atencion
    set folio_seguimiento = 'SEG-2099-99999'
    where id = '95000000-0000-4000-a000-000000000401'$$,
  '23514',
  null,
  'folio_seguimiento es inmutable ante UPDATE (23514)'
);

select * from finish();
rollback;
