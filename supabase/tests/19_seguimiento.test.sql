-- =====================================================================
-- 19_seguimiento.test.sql (A-04 · Sprint 01)
-- Verifica:
--   1. Permisos RBAC (titular y recepcion -> 42501).
--   2. Validaciones: tipo de atención de otra área (23514), cita de otra
--      persona (23514), menor de edad en Psicología (23514).
--   3. Flujo completo con cita: marca cita 'asistio', inserta atención,
--      cambia ficha 'abierto' -> 'en_seguimiento' y devuelve
--      es_primera_vez_area. La próxima cita solo la puede agendar quien
--      puede crear citas en su área (migración 42: Jurídico y Psicología);
--      Trabajo Social recibe 42501 si la envía.
--   4. Misma cita dos veces -> 23505; segunda atención -> es_primera_vez_area = false.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(13);

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

-- 1) Permisos: titular (sin área) y recepcion -> 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select throws_ok(
  $$select * from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555511'::uuid,
      null,
      (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial')
    )$$,
  '42501',
  'Sin permiso para registrar seguimiento',
  'registrar_seguimiento rechaza a titular con 42501'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555511'::uuid,
      null,
      (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial')
    )$$,
  '42501',
  'Sin permiso para registrar seguimiento',
  'registrar_seguimiento rechaza a recepcion con 42501'
);

-- 2) Tipo de atención de otra área -> 23514
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555511'::uuid,
      null,
      (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial')
    )$$,
  '23514',
  'El tipo de atención no corresponde al área del actor',
  'registrar_seguimiento rechaza tipo de atencion de otra area'
);

-- 3) Cita de otra persona -> 23514
insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '99999999-9999-4999-8999-999999999991'::uuid,
  '33333333-3333-4333-8333-333333333302'::uuid,
  ca.id,
  now() + interval '1 hour',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111104'::uuid
from public.cat_area ca
where ca.clave = 'psicologia'
limit 1;

select throws_ok(
  $$select * from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555511'::uuid,
      '99999999-9999-4999-8999-999999999991'::uuid,
      (select id from public.cat_tipo_atencion where clave = 'terapia_individual')
    )$$,
  '23514',
  'La cita no pertenece a la persona de este expediente',
  'registrar_seguimiento rechaza cita de otra persona'
);

-- 4) Menor de edad en Psicología -> 23514 (trigger RN-01)
insert into public.persona (
  id, curp, nombres, apellido_paterno, apellido_materno, creado_por
) values (
  '33333333-3333-4333-8333-333333333399'::uuid,
  'MENA150510MSLRNRA1',
  'Mariana', 'Méndez', 'Navarro',
  '11111111-1111-4111-8111-111111111103'::uuid
);

insert into public.ficha_registro (
  id, persona_id, aviso_privacidad_aceptado_en, creado_por
) values (
  '55555555-5555-4555-8555-555555555599'::uuid,
  '33333333-3333-4333-8333-333333333399'::uuid,
  now(),
  '11111111-1111-4111-8111-111111111103'::uuid
);

select throws_ok(
  $$select * from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555599'::uuid,
      null,
      (select id from public.cat_tipo_atencion where clave = 'valoracion_inicial')
    )$$,
  '23514',
  'Psicología y Jurídico solo atienden a personas mayores de 18 años (RN-01)',
  'registrar_seguimiento bloquea menor de edad en Psicologia'
);

-- 5) Flujo completo exitoso en Trabajo Social con cita + próxima cita
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

insert into public.cita (id, persona_id, area_id, programada_en, estado, confirmada_en, origen, creado_por)
select
  '99999999-9999-4999-8999-999999999992'::uuid,
  '33333333-3333-4333-8333-333333333311'::uuid,
  ca.id,
  now(),
  'confirmada',
  now(),
  'regular',
  '11111111-1111-4111-8111-111111111103'::uuid
from public.cat_area ca
where ca.clave = 'trabajo_social'
limit 1;

select throws_ok(
  $$select * from public.registrar_seguimiento(
    '55555555-5555-4555-8555-555555555511'::uuid,
    '99999999-9999-4999-8999-999999999992'::uuid,
    (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
    'Se realizó entrevista inicial completa.',
    'Canalizar a Psicología.',
    'media',
    'Sin observaciones adicionales.',
    now() + interval '7 days'
  )$$,
  '42501',
  'Sin permiso para agendar la próxima cita; solicítela a Recepción',
  'trabajo_social no puede agendar proxima cita desde registrar_seguimiento (TS no crea citas)'
);

create temp table tmp_seg_res as
select *
from public.registrar_seguimiento(
  '55555555-5555-4555-8555-555555555511'::uuid,
  '99999999-9999-4999-8999-999999999992'::uuid,
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  'Se realizó entrevista inicial completa.',
  'Canalizar a Psicología.',
  'media',
  'Sin observaciones adicionales.',
  null
);

select is(
  (select count(*)::int from tmp_seg_res where atencion_id is not null and cita_proxima_id is null),
  1,
  'registrar_seguimiento crea atencion sin proxima cita'
);

select is(
  (select es_primera_vez_area from tmp_seg_res),
  true,
  'primera atencion del area devuelve es_primera_vez_area = true'
);

select is(
  (select tiene_historial_clinico from tmp_seg_res),
  false,
  'ficha sin historial clinico devuelve tiene_historial_clinico = false'
);

select is(
  (select estado::text from public.cita where id = '99999999-9999-4999-8999-999999999992'::uuid),
  'asistio',
  'cita original pasa a estado asistio'
);

select is(
  (select estado::text from public.ficha_registro where id = '55555555-5555-4555-8555-555555555511'::uuid),
  'en_seguimiento',
  'ficha pasa de abierto a en_seguimiento'
);

-- 6) Misma cita dos veces -> 23505
select throws_ok(
  $$select * from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555511'::uuid,
      '99999999-9999-4999-8999-999999999992'::uuid,
      (select id from public.cat_tipo_atencion where clave = 'orientacion')
    )$$,
  '23505',
  'Esta cita ya cuenta con una hoja de seguimiento registrada',
  'registrar_seguimiento con la misma cita dos veces lanza 23505'
);

-- 7) Segunda atención sin cita en la misma área -> es_primera_vez_area = false
select is(
  (
    select es_primera_vez_area
    from public.registrar_seguimiento(
      '55555555-5555-4555-8555-555555555511'::uuid,
      null,
      (select id from public.cat_tipo_atencion where clave = 'orientacion'),
      'Segunda visita sin cita.'
    )
  ),
  false,
  'segunda atencion en la misma area devuelve es_primera_vez_area = false'
);

select * from finish();
rollback;
