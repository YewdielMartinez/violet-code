-- =====================================================================
-- 18_detalle_y_archivo.test.sql (A-03 · Sprint 01)
-- Verifica:
--   1. get_expediente_detalle() con y sin agresores + bitácora + 42501/23514.
--   2. archivar_ficha() rechaza con cita futura o alerta abierta (23514) y
--      archiva correctamente sin bloqueos.
--   3. crear_ficha_completa() guarda consumo de drogas/alcohol, valida
--      permisos con tiene_permiso(), y al crear dos veces misma CURP da
--      23505 sin borrar nada.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(14);

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
-- Desde la migración 31, las funciones nuevas no tienen EXECUTE para PUBLIC por defecto.
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1) get_expediente_detalle: Recepción -> 42501; ficha inexistente -> 23514
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select public.get_expediente_detalle('55555555-5555-4555-8555-555555555501'::uuid)$$,
  '42501',
  'Sin permiso para consultar el detalle del expediente',
  'get_expediente_detalle rechaza a recepcion con 42501'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select public.get_expediente_detalle('00000000-0000-4000-8000-000000000000'::uuid)$$,
  '23514',
  'Expediente no encontrado o inactivo',
  'get_expediente_detalle rechaza ficha inexistente con 23514'
);

-- 2) get_expediente_detalle sin agresores vs con agresores + bitácora
select is(
  (
    select (res ? 'ficha') and (res ? 'persona') and not (res ? 'agresores')
    from (select public.get_expediente_detalle('55555555-5555-4555-8555-555555555501'::uuid, false) as res) t
  ),
  true,
  'get_expediente_detalle(false) devuelve ficha y persona sin clave agresores'
);

select is(
  (
    select (res ? 'agresores') and jsonb_array_length(res -> 'agresores') >= 1
    from (select public.get_expediente_detalle('55555555-5555-4555-8555-555555555501'::uuid, true) as res) t
  ),
  true,
  'get_expediente_detalle(true) incluye agresores activos'
);

select is(
  (
    select count(*)::int >= 1
    from public.bitacora_acceso b
    where b.empleado_id = '11111111-1111-4111-8111-111111111103'::uuid
      and b.accion = 'ver'
      and b.tabla_afectada = 'agresor'
      and b.registro_id = '55555555-5555-4555-8555-555555555501'
  ),
  true,
  'get_expediente_detalle(true) registra lectura de agresor en bitacora_acceso'
);

-- 3) archivar_ficha: Psicología -> 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.archivar_ficha('55555555-5555-4555-8555-555555555511'::uuid)$$,
  '42501',
  'Sin permiso para archivar expedientes',
  'archivar_ficha rechaza a psicologia con 42501'
);

-- 4) archivar_ficha: bloqueado si tiene cita futura agendada -> 23514
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
insert into public.cita (persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '33333333-3333-4333-8333-333333333311'::uuid,
  ca.id,
  now() + interval '2 days',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'::uuid
from public.cat_area ca
where ca.clave = 'trabajo_social'
limit 1;

select throws_ok(
  $$select * from public.archivar_ficha('55555555-5555-4555-8555-555555555511'::uuid, 'cierre')$$,
  '23514',
  'No se puede archivar un expediente con citas futuras agendadas o confirmadas',
  'archivar_ficha con cita futura lanza 23514'
);

-- Cancelar la cita futura y agregar alerta abierta -> también bloquea con 23514
update public.cita
set estado = 'cancelada'
where persona_id = '33333333-3333-4333-8333-333333333311'::uuid;

insert into public.alerta (persona_id, origen, estado, prioridad, creado_por)
values (
  '33333333-3333-4333-8333-333333333311'::uuid,
  'telefono',
  'nueva',
  'media',
  '11111111-1111-4111-8111-111111111103'::uuid
);

select throws_ok(
  $$select * from public.archivar_ficha('55555555-5555-4555-8555-555555555511'::uuid, 'cierre')$$,
  '23514',
  'No se puede archivar un expediente con alertas abiertas',
  'archivar_ficha con alerta abierta lanza 23514'
);

-- Cerrar alerta abierta -> ahora sí archiva
update public.alerta
set estado = 'atendida',
    tomada_en = now(),
    atendida_en = now()
where persona_id = '33333333-3333-4333-8333-333333333311'::uuid;

select is(
  (select estado::text from public.archivar_ficha('55555555-5555-4555-8555-555555555511'::uuid, 'concluido')),
  'archivado',
  'archivar_ficha archiva correctamente sin citas futuras ni alertas abiertas'
);

-- 5) crear_ficha_completa: acepta consumo de drogas/alcohol y segunda vez da 23505 sin borrar nada
select lives_ok(
  $$select * from public.crear_ficha_completa(
      jsonb_build_object(
        'identidad', jsonb_build_object(
          'curp', 'GOME940512MSLRRN08',
          'nombres', 'Paola',
          'apellidoPaterno', 'Gómez',
          'apellidoMaterno', 'Núñez',
          'avisoPrivacidadAceptado', true,
          'serviciosSolicitadosAreaIds', jsonb_build_array((select id from public.cat_area where clave = 'trabajo_social')),
          'drogas', jsonb_build_array('marihuana'),
          'especificacionDroga', 'Ocasional',
          'consumoAlcohol', 'ocasional'
        ),
        'domicilio', jsonb_build_object('zona', 'urbana'),
        'estudio', jsonb_build_object('servicios', jsonb_build_array('agua'), 'bienes', jsonb_build_array())
      )
    )$$,
  'crear_ficha_completa ejecuta sin error con consumo de drogas y alcohol'
);

select is(
  (
    select f.drogas = array['marihuana']::public.tipo_droga[]
       and f.consumo_alcohol = 'ocasional'::public.consumo_alcohol
    from public.ficha_registro f
    join public.persona p on p.id = f.persona_id
    where p.curp = 'GOME940512MSLRRN08'
  ),
  true,
  'crear_ficha_completa guarda drogas y consumo_alcohol'
);

select throws_ok(
  $$select * from public.crear_ficha_completa(
      jsonb_build_object(
        'identidad', jsonb_build_object(
          'curp', 'GOME940512MSLRRN08',
          'nombres', 'Paola',
          'apellidoPaterno', 'Gómez',
          'avisoPrivacidadAceptado', true,
          'serviciosSolicitadosAreaIds', jsonb_build_array((select id from public.cat_area where clave = 'trabajo_social'))
        ),
        'domicilio', jsonb_build_object('zona', 'urbana'),
        'estudio', jsonb_build_object()
      )
    )$$,
  '23505',
  null,
  'crear_ficha_completa dos veces con misma CURP lanza 23505'
);

select is(
  (
    select count(*)::int
    from public.ficha_registro f
    join public.persona p on p.id = f.persona_id
    where p.curp = 'GOME940512MSLRRN08'
  ),
  1,
  'crear_ficha_completa no borra la ficha existente al detectar duplicado'
);

-- 6) crear_ficha_completa rechaza a Psicología con 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.crear_ficha_completa('{}'::jsonb)$$,
  '42501',
  'Sin permiso para crear expedientes',
  'crear_ficha_completa rechaza a psicologia con 42501'
);

select * from finish();
rollback;
