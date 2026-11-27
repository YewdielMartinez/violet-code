-- =====================================================================
-- 54_quitar_folio_seguimiento.test.sql (Tarjeta #118)
-- Verifica que atencion.folio_seguimiento, su secuencia, trigger y
-- función generadora fueron eliminados y que ninguna RPC devuelve folio.
-- =====================================================================

begin;

select plan(7);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1) La columna folio_seguimiento ya no existe en public.atencion
select is(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'atencion'
      and column_name = 'folio_seguimiento'
  ),
  false,
  'atencion.folio_seguimiento fue eliminada'
);

-- 2) La función generar_folio_seguimiento() ya no existe
select is(
  to_regprocedure('public.generar_folio_seguimiento()'),
  null,
  'generar_folio_seguimiento() fue eliminada'
);

-- 3) La secuencia seguimiento_folio_seq ya no existe
select is(
  to_regclass('public.seguimiento_folio_seq'),
  null,
  'seguimiento_folio_seq fue eliminada'
);

-- Datos base aislados para probar RPCs
insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
values ('9c000000-0000-4000-a000-000000000101', 'NOFL900510MSLRNR01', 'Elena', 'SinFolio', '11111111-1111-4111-8111-111111111103');

insert into public.ficha_registro (id, persona_id, aviso_privacidad_aceptado_en, creado_por)
values ('9c000000-0000-4000-a000-000000000201', '9c000000-0000-4000-a000-000000000101', now(), '11111111-1111-4111-8111-111111111103');

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '9c000000-0000-4000-a000-000000000301',
  '9c000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '10 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- 4) registrar_seguimiento no devuelve folio_seguimiento
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

create temp table tmp_reg as
select * from public.registrar_seguimiento(
  '9c000000-0000-4000-a000-000000000201',
  '9c000000-0000-4000-a000-000000000301',
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  'Atención sin folio.'
);

select is(
  (row_to_json(t)::jsonb ? 'folio_seguimiento'),
  false,
  'registrar_seguimiento ya no devuelve folio_seguimiento'
) from tmp_reg t;

-- 5) corregir_seguimiento no devuelve folio_seguimiento
create temp table tmp_corr as
select * from public.corregir_seguimiento(
  (select atencion_id from tmp_reg),
  (select actualizado_en from public.atencion where id = (select atencion_id from tmp_reg)),
  (select id from public.cat_tipo_atencion where clave = 'orientacion'),
  'Corrección sin folio.'
);

select is(
  (row_to_json(t)::jsonb ? 'folio_seguimiento'),
  false,
  'corregir_seguimiento ya no devuelve folio_seguimiento'
) from tmp_corr t;

-- 6) get_contexto_seguimiento no devuelve ultimo_folio_seguimiento
create temp table tmp_ctx as
select * from public.get_contexto_seguimiento('9c000000-0000-4000-a000-000000000301');

select is(
  (row_to_json(t)::jsonb ? 'ultimo_folio_seguimiento'),
  false,
  'get_contexto_seguimiento ya no devuelve ultimo_folio_seguimiento'
) from tmp_ctx t;

-- 7) get_linea_tiempo muestra título de atención sin (SEG-...)
select ok(
  exists (
    select 1
    from public.get_linea_tiempo('9c000000-0000-4000-a000-000000000201') lt
    where lt.tipo = 'atencion'
      and lt.titulo like 'Atención Trabajo Social · %'
      and lt.titulo !~ '\(SEG-\d{4}-\d{5}\)'
  ),
  'get_linea_tiempo muestra el título de atención sin folio_seguimiento'
);

select * from finish();
rollback;
