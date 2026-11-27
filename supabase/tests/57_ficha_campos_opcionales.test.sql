create extension if not exists pgtap with schema extensions;

begin;
select plan(19);

-- =====================================================================
-- Fixtures y helpers (A-14 · Sprint 02)
--   - crear_ficha_completa sin serviciosSolicitadosAreaIds (omitido / [])
--     y con aportantes sin nombre.
--   - actualizar_ficha acepta '{}'::smallint[] para vaciar servicios
--     (auditado en bitácora) y null para conservarlos; rechaza área inexistente.
--   - guardar_agresor permite alta y edición sin p_nombres y rechaza >100.
--   - registrar_estudio_socioeconomico permite aportantes sin nombre y
--     rechaza >150.
--   - CHECK constraints agresor_nombres_check y aportante_hogar_nombre_check
--     permiten NULL y rechazan cadenas de solo espacios.
-- =====================================================================
insert into public.persona (id, curp, nombres, apellido_paterno)
values
  ('57000000-0000-4000-a000-000000000101', 'MARL900101MSLGRN01', 'Martha', 'Ruiz')
on conflict (id) do nothing;

insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en)
values
  ('57000000-0000-4000-a000-000000000201', 'SEM-2026-5701', '57000000-0000-4000-a000-000000000101', 'abierto', now())
on conflict (id) do nothing;

insert into public.ficha_servicio_solicitado (ficha_id, area_id)
select '57000000-0000-4000-a000-000000000201', id
from public.cat_area
where clave in ('trabajo_social', 'psicologia')
on conflict do nothing;

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

create temp table pg_temp.res_crear_1 (ficha_id uuid, folio text, persona_id uuid) on commit drop;
create temp table pg_temp.res_crear_2 (ficha_id uuid, folio text, persona_id uuid) on commit drop;
create temp table pg_temp.res_act (
  id uuid, folio text, persona_id uuid, estado public.estado_ficha,
  estado_civil public.estado_civil, ocupacion_id smallint, ocupacion_otra text,
  tiene_trabajo boolean, numero_hijas smallint, numero_hijos_hombres smallint,
  servicio_medico public.servicio_medico, servicio_medico_otro text,
  tiene_embarazo boolean, tiene_denuncia boolean, es_victima_delito boolean,
  drogas public.tipo_droga[], especificacion_droga text,
  consumo_alcohol public.consumo_alcohol, servicios_solicitados_area_ids smallint[],
  actualizado_en timestamptz
) on commit drop;
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
create temp table pg_temp.res_est (
  estudio_id uuid, ficha_id uuid, fecha_estudio date, es_actual boolean,
  fue_correccion boolean, actualizado_en timestamptz
) on commit drop;

grant all on pg_temp.res_crear_1 to authenticated;
grant all on pg_temp.res_crear_2 to authenticated;
grant all on pg_temp.res_act to authenticated;
grant all on pg_temp.res_agr to authenticated;
grant all on pg_temp.res_est to authenticated;

set local role authenticated;
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

-- 1-4) crear_ficha_completa sin serviciosSolicitadosAreaIds y con [] + aportantes sin nombre
insert into pg_temp.res_crear_1
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'LOAL950312MSLGRN01',
      'nombres', 'Alma',
      'apellidoPaterno', 'Lopez',
      'avisoPrivacidadAceptado', true
    ),
    'domicilio', jsonb_build_object('codigoPostalForaneo', '81200'),
    'estudio', jsonb_build_object('ingresoMensualPropio', 2000)
  )
);

select is(
  (select count(*)::int from public.ficha_servicio_solicitado where ficha_id = (select ficha_id from pg_temp.res_crear_1)),
  0,
  'crear_ficha_completa permite omitir serviciosSolicitadosAreaIds'
);

insert into pg_temp.res_crear_2
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'GAEL930520MSLGRN02',
      'nombres', 'Elena',
      'apellidoPaterno', 'Garcia',
      'avisoPrivacidadAceptado', true,
      'serviciosSolicitadosAreaIds', '[]'::jsonb
    ),
    'domicilio', jsonb_build_object('codigoPostalForaneo', '81200'),
    'estudio', jsonb_build_object(
      'ingresoMensualPropio', 2500,
      'aportantes', jsonb_build_array(
        jsonb_build_object('monto', 1500, 'frecuencia', 'quincenal'),
        jsonb_build_object('nombre', '   ', 'monto', 800, 'frecuencia', 'semanal')
      )
    )
  )
);

select is(
  (select count(*)::int from public.ficha_servicio_solicitado where ficha_id = (select ficha_id from pg_temp.res_crear_2)),
  0,
  'crear_ficha_completa permite serviciosSolicitadosAreaIds vacio []'
);

select is(
  (
    select count(*)::int
    from public.aportante_hogar ah
    join public.estudio_socioeconomico es on es.id = ah.estudio_socioeconomico_id
    where es.ficha_id = (select ficha_id from pg_temp.res_crear_2)
      and ah.nombre is null
      and ah.activo
  ),
  2,
  'crear_ficha_completa guarda nombre = null en aportantes sin nombre o en blanco'
);

select throws_ok(
  $$select * from public.crear_ficha_completa(
    jsonb_build_object(
      'identidad', jsonb_build_object(
        'curp', 'ROBL910410MSLGRN03',
        'nombres', 'Rosa',
        'apellidoPaterno', 'Blanco',
        'avisoPrivacidadAceptado', false
      ),
      'domicilio', jsonb_build_object(),
      'estudio', jsonb_build_object()
    )
  )$$,
  '23514', null, 'crear_ficha_completa sigue exigiendo avisoPrivacidadAceptado'
);

-- 5) crear_ficha_completa sigue validando maximo 150 caracteres en aportante.nombre
select throws_ok(
  $$select * from public.crear_ficha_completa(
    jsonb_build_object(
      'identidad', jsonb_build_object(
        'curp', 'ROBL910410MSLGRN03',
        'nombres', 'Rosa',
        'apellidoPaterno', 'Blanco',
        'avisoPrivacidadAceptado', true
      ),
      'domicilio', jsonb_build_object(),
      'estudio', jsonb_build_object(
        'aportantes', jsonb_build_array(
          jsonb_build_object('nombre', repeat('a', 151), 'monto', 500)
        )
      )
    )
  )$$,
  '23514', null, 'crear_ficha_completa rechaza nombre de aportante mayor a 150 caracteres'
);

-- 6-9) actualizar_ficha con '{}' vacia servicios, con null conserva, con area inexistente -> 23514
insert into pg_temp.res_act
select *
from public.actualizar_ficha(
  '57000000-0000-4000-a000-000000000201',
  (select actualizado_en from public.ficha_registro where id = '57000000-0000-4000-a000-000000000201'),
  null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  null
);

select is(
  cardinality((select servicios_solicitados_area_ids from pg_temp.res_act)),
  2,
  'actualizar_ficha con p_servicios_solicitados_area_ids = null conserva los servicios actuales'
);

truncate pg_temp.res_act;
insert into pg_temp.res_act
select *
from public.actualizar_ficha(
  '57000000-0000-4000-a000-000000000201',
  (select actualizado_en from public.ficha_registro where id = '57000000-0000-4000-a000-000000000201'),
  null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  '{}'::smallint[]
);

select is(
  (select servicios_solicitados_area_ids from pg_temp.res_act),
  '{}'::smallint[],
  'actualizar_ficha con {} vacia los servicios solicitados'
);

reset role;
select ok(
  exists (
    select 1
    from public.bitacora_acceso b
    where b.tabla_afectada = 'ficha_servicio_solicitado'
      and b.accion = 'desactivar'
  ),
  'vaciar servicios en actualizar_ficha audita desactivar en bitacora_acceso'
);
set local role authenticated;

select throws_ok(
  $$select * from public.actualizar_ficha('57000000-0000-4000-a000-000000000201', (select actualizado_en from public.ficha_registro where id = '57000000-0000-4000-a000-000000000201'), null, null, null, null, null, null, null, null, null, null, null, null, null, null, array[9999]::smallint[])$$,
  '23514', null, 'actualizar_ficha sigue rechazando area inexistente'
);

-- 10-14) guardar_agresor: alta y edicion sin p_nombres + limite 100
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia

insert into pg_temp.res_agr
select *
from public.guardar_agresor(
  null,
  '57000000-0000-4000-a000-000000000201',
  null,
  null,
  null, null, 30::smallint
);

select is(
  (select nombres from pg_temp.res_agr),
  null,
  'guardar_agresor permite alta con p_nombres = null'
);

truncate pg_temp.res_agr;
insert into pg_temp.res_agr
select *
from public.guardar_agresor(
  null,
  '57000000-0000-4000-a000-000000000201',
  null,
  '   ',
  null, null, 31::smallint
);

select is(
  (select nombres from pg_temp.res_agr),
  null,
  'guardar_agresor guarda null si p_nombres son espacios al crear'
);

with put_name as (
  select *
  from public.guardar_agresor(
    (select id from pg_temp.res_agr),
    null,
    (select actualizado_en from pg_temp.res_agr),
    'Carlos'
  )
),
keep_name as (
  select *
  from public.guardar_agresor(
    (select id from put_name),
    null,
    (select actualizado_en from put_name),
    null
  )
)
select is(
  (select nombres from keep_name),
  'Carlos',
  'guardar_agresor conserva nombres existente cuando p_nombres = null al editar'
);

with clear_name as (
  select *
  from public.guardar_agresor(
    (select id from pg_temp.res_agr),
    null,
    (select actualizado_en from public.agresor where id = (select id from pg_temp.res_agr)),
    ''
  )
)
select is(
  (select nombres from clear_name),
  null,
  'guardar_agresor permite limpiar nombres a null con cadena vacia al editar'
);

select throws_ok(
  $$select * from public.guardar_agresor(null, '57000000-0000-4000-a000-000000000201', null, repeat('x', 101))$$,
  '23514', null, 'guardar_agresor sigue rechazando nombres mayores a 100 caracteres'
);

-- 15-17) registrar_estudio_socioeconomico con aportantes sin nombre + limite 150
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

insert into pg_temp.res_est
select *
from public.registrar_estudio_socioeconomico(
  '57000000-0000-4000-a000-000000000201',
  4500, 1::smallint, false, null, 'propia'::public.tipo_vivienda, 'block'::public.material_vivienda, null, null, null,
  jsonb_build_array(
    jsonb_build_object('monto', 3000, 'frecuencia', 'mensual'),
    jsonb_build_object('nombre', '', 'monto', 1200, 'frecuencia', 'semanal')
  )
);

select is(
  (
    select count(*)::int
    from public.aportante_hogar ah
    where ah.estudio_socioeconomico_id = (select estudio_id from pg_temp.res_est)
      and ah.nombre is null
      and ah.activo
  ),
  2,
  'registrar_estudio_socioeconomico permite aportantes sin nombre o en blanco'
);

select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico(
    '57000000-0000-4000-a000-000000000201',
    4500, 1::smallint, false, null, null, null, null, null, null,
    jsonb_build_array(jsonb_build_object('nombre', repeat('b', 151), 'monto', 100))
  )$$,
  '23514', null, 'registrar_estudio_socioeconomico rechaza nombre de aportante mayor a 150 caracteres'
);

-- 18-20) CHECK constraints directos en tabla (agresor_nombres_check, aportante_hogar_nombre_check)
reset role;
select throws_ok(
  $$insert into public.agresor (ficha_id, nombres) values ('57000000-0000-4000-a000-000000000201', '   ')$$,
  '23514', null, 'agresor_nombres_check rechaza cadena de solo espacios'
);

select throws_ok(
  $$insert into public.aportante_hogar (estudio_socioeconomico_id, nombre) values ((select estudio_id from pg_temp.res_est), '   ')$$,
  '23514', null, 'aportante_hogar_nombre_check rechaza cadena de solo espacios'
);

select ok(
  (
    select count(*) = 2
    from information_schema.columns
    where table_schema = 'public'
      and is_nullable = 'YES'
      and ((table_name = 'agresor' and column_name = 'nombres')
        or (table_name = 'aportante_hogar' and column_name = 'nombre'))
  ),
  'agresor.nombres y aportante_hogar.nombre permiten NULL en el esquema'
);

select * from finish();
rollback;
