create extension if not exists pgtap with schema extensions;

begin;
select plan(16);

-- =====================================================================
-- Pruebas A-15 · Sprint 02 (58_consumo_como_lista.sql)
--   1. Esquema: elimina tiene_consumo_droga / tiene_consumo_alcohol,
--      agrega consumo_alcohol ('no_consume', 'ocasional', 'frecuente')
--      y 'no_consume' en tipo_droga.
--   2. Seed migrado con los valores nuevos.
--   3. 'no_consume' combinado con otra droga o con especificacion_droga
--      lanza 23514 en tablas y en crear_ficha_completa / actualizar_ficha /
--      guardar_agresor.
--   4. Las tres RPC guardan drogas y consumo_alcohol, y
--      get_expediente_detalle devuelve los campos nuevos.
-- =====================================================================

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}', true);
  else
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid::text)::text, true);
  end if;
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

create temp table pg_temp.res_crear (ficha_id uuid, folio text, persona_id uuid) on commit drop;
create temp table pg_temp.res_agr (
  id uuid, ficha_id uuid, nombres text, apellido_paterno text, apellido_materno text,
  edad smallint, fecha_nacimiento date, entidad_nacimiento text, sexo public.sexo_biologico,
  estado_civil public.estado_civil, curp text, parentesco_id smallint, parentesco_otro text,
  asentamiento_id integer, codigo_postal text, calle text, numero_exterior text,
  numero_interior text, referencias text, zona public.zona_geografica,
  ocupacion_id smallint, ocupacion_otra text, tipo_trabajo public.tipo_trabajo,
  drogas public.tipo_droga[], especificacion_droga text,
  consumo_alcohol public.consumo_alcohol, especificacion_arma text, observaciones text,
  activo boolean, actualizado_en timestamptz
) on commit drop;

grant all on pg_temp.res_crear to authenticated;
grant all on pg_temp.res_agr to authenticated;

-- 1-3) Esquema y enums nuevos
select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('ficha_registro', 'agresor')
      and column_name in ('tiene_consumo_droga', 'tiene_consumo_alcohol')
  ),
  0,
  'columnas tiene_consumo_droga y tiene_consumo_alcohol fueron eliminadas'
);

select is(
  (
    select array_agg(e.enumlabel order by e.enumsortorder)::text[]
    from pg_enum e
    where e.enumtypid = 'public.consumo_alcohol'::regtype
  ),
  array['no_consume', 'ocasional', 'frecuente'],
  'enum consumo_alcohol contiene no_consume, ocasional y frecuente'
);

select ok(
  'no_consume' = any (
    select e.enumlabel
    from pg_enum e
    where e.enumtypid = 'public.tipo_droga'::regtype
  ),
  'enum tipo_droga incluye no_consume'
);

-- 4-5) Seed con valores nuevos (equivalentes a datos migrados)
select ok(
  (
    select drogas = array['no_consume']::public.tipo_droga[]
       and consumo_alcohol = 'no_consume'::public.consumo_alcohol
    from public.ficha_registro
    where id = '55555555-5555-4555-8555-555555555501'
  ),
  'ficha seed conserva drogas = {no_consume} y consumo_alcohol = no_consume'
);

select ok(
  (
    select a1.drogas = array['marihuana']::public.tipo_droga[]
       and a1.consumo_alcohol = 'ocasional'::public.consumo_alcohol
       and a2.drogas = array['no_consume']::public.tipo_droga[]
       and a2.consumo_alcohol = 'ocasional'::public.consumo_alcohol
    from public.agresor a1
    join public.agresor a2 on a2.id = '77777777-7777-4777-8777-777777777702'
    where a1.id = '77777777-7777-4777-8777-777777777701'
  ),
  'agresores seed conservan drogas y consumo_alcohol'
);

-- 6-7) Constraints directos en tabla (23514)
select throws_ok(
  $$update public.ficha_registro
    set drogas = array['no_consume', 'marihuana']::public.tipo_droga[]
    where id = '55555555-5555-4555-8555-555555555501'$$,
  '23514', null, 'ficha_registro_drogas_check rechaza no_consume con otra droga'
);

select throws_ok(
  $$insert into public.agresor (ficha_id, drogas, especificacion_droga)
    values ('55555555-5555-4555-8555-555555555501', array['no_consume']::public.tipo_droga[], 'Frecuente')$$,
  '23514', null, 'agresor_especificacion_droga_consistencia_check rechaza especificacion con no_consume'
);

-- 8-12) crear_ficha_completa y get_expediente_detalle
set local role authenticated;
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select throws_ok(
  $$select * from public.crear_ficha_completa(
    jsonb_build_object(
      'identidad', jsonb_build_object(
        'curp', 'CARL920115MSLGRN01',
        'nombres', 'Carla',
        'apellidoPaterno', 'Rojas',
        'avisoPrivacidadAceptado', true,
        'drogas', jsonb_build_array('no_consume', 'cristal')
      ),
      'domicilio', jsonb_build_object(),
      'estudio', jsonb_build_object()
    )
  )$$,
  '23514', null, 'crear_ficha_completa rechaza no_consume con otra droga (23514)'
);

select throws_ok(
  $$select * from public.crear_ficha_completa(
    jsonb_build_object(
      'identidad', jsonb_build_object(
        'curp', 'CARL920115MSLGRN01',
        'nombres', 'Carla',
        'apellidoPaterno', 'Rojas',
        'avisoPrivacidadAceptado', true,
        'drogas', jsonb_build_array('no_consume'),
        'especificacionDroga', 'Detalle indebido'
      ),
      'domicilio', jsonb_build_object(),
      'estudio', jsonb_build_object()
    )
  )$$,
  '23514', null, 'crear_ficha_completa rechaza especificacionDroga con no_consume (23514)'
);

insert into pg_temp.res_crear
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'CARL920115MSLGRN01',
      'nombres', 'Carla',
      'apellidoPaterno', 'Rojas',
      'avisoPrivacidadAceptado', true,
      'drogas', jsonb_build_array('marihuana', 'otra'),
      'especificacionDroga', 'Fin de semana',
      'consumoAlcohol', 'frecuente'
    ),
    'domicilio', jsonb_build_object('zona', 'urbana'),
    'estudio', jsonb_build_object()
  )
);

select is(
  (
    select (d -> 'ficha' ->> 'consumo_alcohol')
        || '|' || (d -> 'ficha' ->> 'especificacion_droga')
        || '|' || ((d -> 'ficha') ? 'tiene_consumo_droga')::text
        || '|' || ((d -> 'ficha') ? 'tiene_consumo_alcohol')::text
    from (select public.get_expediente_detalle((select ficha_id from pg_temp.res_crear), false) as d) s
  ),
  'frecuente|Fin de semana|false|false',
  'get_expediente_detalle devuelve drogas/especificacion_droga/consumo_alcohol sin booleanos viejos'
);

select is(
  (
    select array(
      select jsonb_array_elements_text(d -> 'ficha' -> 'drogas')
    )
    from (select public.get_expediente_detalle((select ficha_id from pg_temp.res_crear), false) as d) s
  ),
  array['marihuana', 'otra'],
  'get_expediente_detalle devuelve arreglo drogas guardado por crear_ficha_completa'
);

-- 13-14) actualizar_ficha: rechaza no_consume + otra droga y limpia especificacion al pasar a no_consume
select throws_ok(
  $$select * from public.actualizar_ficha(
    (select ficha_id from pg_temp.res_crear),
    (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear)),
    null, null, null, null, null, null, null, null, null, null, null,
    array['no_consume', 'cocaina']::public.tipo_droga[]
  )$$,
  '23514', null, 'actualizar_ficha rechaza no_consume con otra droga (23514)'
);

select is(
  (
    select (drogas = array['no_consume']::public.tipo_droga[])
       and especificacion_droga is null
       and consumo_alcohol = 'ocasional'::public.consumo_alcohol
    from public.actualizar_ficha(
      (select ficha_id from pg_temp.res_crear),
      (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear)),
      null, null, null, null, null, null, null, null, null, null, null,
      array['no_consume']::public.tipo_droga[],
      null,
      'ocasional'::public.consumo_alcohol
    )
  ),
  true,
  'actualizar_ficha guarda no_consume, limpia especificacion_droga y actualiza consumo_alcohol'
);

-- 15-17) guardar_agresor y detalle con agresores
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia

select throws_ok(
  $$select * from public.guardar_agresor(
    null,
    (select ficha_id from pg_temp.res_crear),
    null, 'Pedro', null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null,
    array['no_consume', 'inhalantes']::public.tipo_droga[]
  )$$,
  '23514', null, 'guardar_agresor rechaza no_consume con otra droga (23514)'
);

insert into pg_temp.res_agr
select *
from public.guardar_agresor(
  null,
  (select ficha_id from pg_temp.res_crear),
  null, 'Pedro', null, null, null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null, null, null,
  array['cristal']::public.tipo_droga[],
  'Diario',
  'frecuente'::public.consumo_alcohol,
  p_parentesco_id => (select id from public.cat_parentesco order by id limit 1),
  p_ocupacion_id => (select id from public.cat_ocupacion order by id limit 1)
);

select is(
  (select (drogas = array['cristal']::public.tipo_droga[]) and especificacion_droga = 'Diario' and consumo_alcohol = 'frecuente'::public.consumo_alcohol from pg_temp.res_agr),
  true,
  'guardar_agresor persiste drogas, especificacion_droga y consumo_alcohol'
);

select is(
  (
    select (d -> 'agresores' -> 0 ->> 'consumo_alcohol')
        || '|' || ((d -> 'agresores' -> 0) ? 'tiene_consumo_droga')::text
        || '|' || ((d -> 'agresores' -> 0) ? 'tiene_consumo_alcohol')::text
    from (select public.get_expediente_detalle((select ficha_id from pg_temp.res_crear), true) as d) s
  ),
  'frecuente|false|false',
  'get_expediente_detalle(true) devuelve consumo_alcohol en agresores sin booleanos viejos'
);

select * from finish();
rollback;
