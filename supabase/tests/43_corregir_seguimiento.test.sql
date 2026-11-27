-- =====================================================================
-- 43_corregir_seguimiento.test.sql (Tarjeta #91)
-- Verifica:
--   - registrar_seguimiento() ya no copia estado_civil, ocupacion, celular ni domicilio.
--   - INSERT/UPDATE directos sobre atencion bloqueados (42501).
--   - corregir_seguimiento(): creador mismo día ok; otra persona misma área -> 42501;
--     creador al día siguiente -> 42501; Dirección en cualquier momento -> ok;
--     concurrencia optimista p_actualizado_en -> 40001; bitácora 'actualizar'.
-- =====================================================================

begin;

select plan(12);

create or replace function pg_temp.set_actor(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

-- Segundo empleado de Trabajo Social para probar "otra persona de la misma área"
insert into auth.users (id, email)
values ('97000000-0000-4000-a000-000000000009', 'ts2@semujeres.test');

insert into public.empleado (id, nombre, rol, area_id, creado_por)
select
  '97000000-0000-4000-a000-000000000009',
  'Karla TS Dos', 'trabajo_social', ca.id, '11111111-1111-4111-8111-111111111101'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- Persona con datos generales completos + ficha + domicilio + cita de hoy
insert into public.persona (
  id, curp, nombres, apellido_paterno, apellido_materno, celular, creado_por
) values (
  '97000000-0000-4000-a000-000000000101',
  'CORR900510MSLRNR01',
  'Sofía', 'Corrección', 'Folio', '6681234567',
  '11111111-1111-4111-8111-111111111103'
);

insert into public.domicilio (
  id, persona_id, calle, es_actual, creado_por
) values (
  '97000000-0000-4000-a000-000000000151',
  '97000000-0000-4000-a000-000000000101',
  'Calle Prueba 123', true,
  '11111111-1111-4111-8111-111111111103'
);

insert into public.ficha_registro (
  id, persona_id, estado_civil, ocupacion_otra, aviso_privacidad_aceptado_en, creado_por
) values (
  '97000000-0000-4000-a000-000000000201',
  '97000000-0000-4000-a000-000000000101',
  'soltero', 'Comerciante', now(),
  '11111111-1111-4111-8111-111111111103'
);

insert into public.cita (id, persona_id, area_id, programada_en, estado, origen, creado_por)
select
  '97000000-0000-4000-a000-000000000301',
  '97000000-0000-4000-a000-000000000101',
  ca.id,
  (date_trunc('day', now() at time zone 'America/Mazatlan') at time zone 'America/Mazatlan') + interval '10 hours',
  'agendada',
  'regular',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- Atención de ayer creada por TS 1 (para probar "al día siguiente -> 42501 salvo Dirección")
insert into public.atencion (
  id, ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en, acciones_realizadas, creado_por
)
select
  '97000000-0000-4000-a000-000000000401',
  '97000000-0000-4000-a000-000000000201',
  ca.id,
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  '11111111-1111-4111-8111-111111111103',
  now() - interval '2 days',
  'Acción previa de hace dos días',
  '11111111-1111-4111-8111-111111111103'
from public.cat_area ca where ca.clave = 'trabajo_social' limit 1;

-- 1) registrar_seguimiento() ya no copia estado_civil, ocupacion, celular ni domicilio
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- TS 1

create temp table tmp_reg as
select * from public.registrar_seguimiento(
  '97000000-0000-4000-a000-000000000201',
  '97000000-0000-4000-a000-000000000301',
  (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
  'Acción inicial sin copia.'
);

select is(
  (select json_build_object(
    'estado_civil', a.estado_civil,
    'ocupacion_id', a.ocupacion_id,
    'ocupacion_otra', a.ocupacion_otra,
    'celular', a.celular,
    'domicilio_id', a.domicilio_id
  )::text
  from public.atencion a where a.id = (select atencion_id from tmp_reg)),
  json_build_object(
    'estado_civil', null,
    'ocupacion_id', null,
    'ocupacion_otra', null,
    'celular', null,
    'domicilio_id', null
  )::text,
  'registrar_seguimiento deja de copiar datos generales en atencion'
);

-- 2-3) INSERT y UPDATE directos sobre atencion bloqueados (42501)
select throws_ok(
  $$insert into public.atencion (ficha_id, area_id, tipo_atencion_id)
    values ('97000000-0000-4000-a000-000000000201', (select id from public.cat_area where clave = 'trabajo_social'), (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'))$$,
  '42501',
  null,
  'INSERT directo en atencion rechazado con 42501'
);

select throws_ok(
  $$update public.atencion
    set observaciones = 'Intento directo'
    where id = (select atencion_id from tmp_reg)$$,
  '42501',
  null,
  'UPDATE directo en atencion rechazado con 42501'
);

-- 4-5) anon y recepcion -> 42501
select is(
  has_function_privilege('anon', 'public.corregir_seguimiento(uuid, timestamptz, smallint, text, text, public.prioridad_nivel, text)', 'execute'),
  false,
  'anon no puede ejecutar corregir_seguimiento'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.corregir_seguimiento(
      (select atencion_id from tmp_reg),
      (select a.actualizado_en from public.atencion a where a.id = (select atencion_id from tmp_reg))
    )$$,
  '42501',
  null,
  'recepcion no tiene permiso para corregir_seguimiento'
);

-- 6) Otra persona de la misma área -> 42501
select pg_temp.set_actor('97000000-0000-4000-a000-000000000009'::uuid); -- TS 2
select throws_ok(
  $$select * from public.corregir_seguimiento(
      (select atencion_id from tmp_reg),
      (select a.actualizado_en from public.atencion a where a.id = (select atencion_id from tmp_reg)),
      null,
      'Intento de otro compañero'
    )$$,
  '42501',
  null,
  'otra persona de la misma área recibe 42501'
);

-- 7) Creador al día siguiente -> 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- TS 1
select throws_ok(
  $$select * from public.corregir_seguimiento(
      '97000000-0000-4000-a000-000000000401',
      (select a.actualizado_en from public.atencion a where a.id = '97000000-0000-4000-a000-000000000401'),
      null,
      'Intento fuera de día'
    )$$,
  '42501',
  null,
  'creador no puede corregir seguimiento de otro día (42501)'
);

-- 8) Concurrencia optimista: p_actualizado_en viejo -> 40001
select throws_ok(
  $$select * from public.corregir_seguimiento(
      (select atencion_id from tmp_reg),
      now() - interval '1 hour',
      null,
      'Stale timestamp'
    )$$,
  '40001',
  null,
  'p_actualizado_en desactualizado lanza 40001'
);

-- 9-10) Creador el mismo día corrige con éxito y se registra en bitácora
select * from public.corregir_seguimiento(
  (select atencion_id from tmp_reg),
  (select a.actualizado_en from public.atencion a where a.id = (select atencion_id from tmp_reg)),
  null,
  'Acción corregida hoy',
  'Próxima acción ajustada',
  'alta',
  'Observación corregida'
);

select is(
  (select a.acciones_realizadas from public.atencion a where a.id = (select atencion_id from tmp_reg)),
  'Acción corregida hoy',
  'creador el mismo día corrige acciones_realizadas correctamente'
);

reset role;
select ok(
  exists (
    select 1
    from public.bitacora_acceso b
    where b.empleado_id = '11111111-1111-4111-8111-111111111103'::uuid
      and b.accion = 'actualizar'
      and b.tabla_afectada = 'atencion'
      and b.registro_id = (select atencion_id::text from tmp_reg)
  ),
  'corregir_seguimiento registra actualizar en bitacora_acceso'
);

-- 11-12) Dirección (titular) puede corregir seguimiento de otro día
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select * from public.corregir_seguimiento(
  '97000000-0000-4000-a000-000000000401',
  (select a.actualizado_en from public.atencion a where a.id = '97000000-0000-4000-a000-000000000401'),
  null,
  'Corregido por Dirección'
);

select is(
  (select a.acciones_realizadas from public.atencion a where a.id = '97000000-0000-4000-a000-000000000401'),
  'Corregido por Dirección',
  'Dirección puede corregir seguimiento de días anteriores'
);

select is(
  (select a.prioridad::text from public.atencion a where a.id = (select atencion_id from tmp_reg)),
  'alta',
  'prioridad actualizada por corregir_seguimiento'
);

select * from finish();
rollback;
