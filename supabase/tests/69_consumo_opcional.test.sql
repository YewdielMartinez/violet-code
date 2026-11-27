create extension if not exists pgtap with schema extensions;

begin;
select plan(8);

-- =====================================================================
-- 69_consumo_opcional.test.sql
-- Confirma (sin migración nueva) que el consumo de drogas es OPCIONAL y de
-- selección múltiple para la persona usuaria (crear_ficha_completa /
-- actualizar_ficha) y la persona agresora (guardar_agresor):
--   - Alta sin drogas, o con arreglo vacío, no exige nada y guarda null.
--   - Un arreglo vacío ('{}') al editar LIMPIA drogas y especificacion_droga
--     (null conserva el valor, por eso el front envía '{}' para vaciar).
--   - 'otra' sin especificación es válido (la especificación es opcional).
-- =====================================================================

do $$
declare
  v_uid_ts  uuid := '11111111-1111-4111-8111-111111111103';
  v_per     uuid := '69000000-0000-4000-a000-000000000101';
  v_fic     uuid := '69000000-0000-4000-a000-000000000201';
  v_agr     uuid := '69000000-0000-4000-a000-000000000301';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per, 'PEGA900101MSLRRN03', 'Ana', 'Pérez', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por,
    drogas, especificacion_droga
  ) values (
    v_fic, 'SEM-S69A-0001', v_per, 'abierto', now(), v_uid_ts,
    array['marihuana', 'otra']::public.tipo_droga[], 'Pegamento'
  );

  insert into public.agresor (id, ficha_id, nombres, creado_por, drogas, especificacion_droga) values
    (v_agr, v_fic, 'Historico', v_uid_ts, array['cristal', 'otra']::public.tipo_droga[], 'Diario');
end;
$$;

create temp table pg_temp.res_crear (ficha_id uuid, folio text, persona_id uuid) on commit drop;
create temp table pg_temp.res_crear2 (ficha_id uuid, folio text, persona_id uuid) on commit drop;
grant all on pg_temp.res_crear to authenticated;
grant all on pg_temp.res_crear2 to authenticated;

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

set local role authenticated;
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

-- 1) crear_ficha_completa sin drogas
insert into pg_temp.res_crear
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'ROMA900505MSLDRN07',
      'nombres', 'Rosa',
      'apellidoPaterno', 'Mora',
      'avisoPrivacidadAceptado', true
    ),
    'domicilio', jsonb_build_object('zona', 'urbana'),
    'estudio', jsonb_build_object()
  )
);

select ok(
  (select drogas is null and especificacion_droga is null
   from public.ficha_registro
   where id = (select ficha_id from pg_temp.res_crear)),
  'crear_ficha_completa sin drogas guarda null (no es obligatorio)'
);

-- 2) crear_ficha_completa con arreglo vacío
insert into pg_temp.res_crear2
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'LOPE910707HSLPRD05',
      'nombres', 'Luis',
      'apellidoPaterno', 'Lopez',
      'avisoPrivacidadAceptado', true,
      'drogas', jsonb_build_array()
    ),
    'domicilio', jsonb_build_object('zona', 'urbana'),
    'estudio', jsonb_build_object()
  )
);

select ok(
  (select drogas is null and especificacion_droga is null
   from public.ficha_registro
   where id = (select ficha_id from pg_temp.res_crear2)),
  'crear_ficha_completa con drogas = [] guarda null'
);

-- 3) actualizar_ficha con arreglo vacío limpia drogas y especificación
select ok(
  (
    select drogas is null and especificacion_droga is null
    from public.actualizar_ficha(
      '69000000-0000-4000-a000-000000000201',
      (select actualizado_en from public.ficha_registro where id = '69000000-0000-4000-a000-000000000201'),
      null, null, null, null, null, null, null, null, null, null, null,
      array[]::public.tipo_droga[],
      ''
    )
  ),
  'actualizar_ficha con {} limpia drogas y especificacion_droga'
);

-- 4) actualizar_ficha: «otra» sin especificación es válido
select ok(
  (
    select drogas = array['otra']::public.tipo_droga[] and especificacion_droga is null
    from public.actualizar_ficha(
      '69000000-0000-4000-a000-000000000201',
      (select actualizado_en from public.ficha_registro where id = '69000000-0000-4000-a000-000000000201'),
      null, null, null, null, null, null, null, null, null, null, null,
      array['otra']::public.tipo_droga[],
      ''
    )
  ),
  'actualizar_ficha acepta «otra» sin especificación'
);

-- 5) guardar_agresor: edición con arreglo vacío limpia drogas y especificación
select ok(
  (
    select drogas is null and especificacion_droga is null
    from public.guardar_agresor(
      p_agresor_id => '69000000-0000-4000-a000-000000000301',
      p_actualizado_en => (select actualizado_en from public.agresor where id = '69000000-0000-4000-a000-000000000301'),
      p_drogas => array[]::public.tipo_droga[],
      p_especificacion_droga => ''
    )
  ),
  'guardar_agresor con {} limpia drogas y especificacion_droga'
);

-- 6) guardar_agresor: alta sin drogas
select ok(
  (
    select drogas is null and especificacion_droga is null
    from public.guardar_agresor(
      null, '69000000-0000-4000-a000-000000000201', null, 'Carlos', 'Mendez',
      p_parentesco_id => (select id from public.cat_parentesco order by id limit 1),
      p_ocupacion_id => (select id from public.cat_ocupacion order by id limit 1)
    )
  ),
  'guardar_agresor sin drogas guarda null (no es obligatorio)'
);

-- 7) guardar_agresor: «otra» sin especificación es válido
select ok(
  (
    select drogas = array['otra']::public.tipo_droga[] and especificacion_droga is null
    from public.guardar_agresor(
      p_agresor_id => '69000000-0000-4000-a000-000000000301',
      p_actualizado_en => (select actualizado_en from public.agresor where id = '69000000-0000-4000-a000-000000000301'),
      p_drogas => array['otra']::public.tipo_droga[]
    )
  ),
  'guardar_agresor acepta «otra» sin especificación'
);

-- 8) La regla de exclusividad se mantiene
select throws_ok(
  $$select * from public.guardar_agresor(
    p_agresor_id => '69000000-0000-4000-a000-000000000301',
    p_actualizado_en => (select actualizado_en from public.agresor where id = '69000000-0000-4000-a000-000000000301'),
    p_drogas => array['no_consume', 'cristal']::public.tipo_droga[]
  )$$,
  '23514',
  null,
  'guardar_agresor mantiene no_consume excluyente'
);

select * from finish();
rollback;
