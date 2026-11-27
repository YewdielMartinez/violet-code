create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 67_historial_clinico_psicologia.test.sql
-- Verifica la migración 20261128002600_67_historial_clinico_psicologia.sql:
--   - Solo `psicologia` guarda el historial clínico (historial_clinico.escribir);
--     titular, subdirección, trabajo social, jurídico, recepción y UMECA
--     reciben 42501.
--   - Cada guardado con cambios crea una versión (autor, snapshot y campos
--     modificados); un guardado sin cambios no crea versión.
--   - get_historial_clinico_versiones: lectura con historial_clinico.acceder
--     (psicología, titular, subdirección); trabajo social, jurídico y recepción
--     reciben 42501.
--   - historial_clinico_version es append-only para el cliente.
--   - El trigger también versiona escrituras que no pasan por el RPC.
-- =====================================================================

begin;

select plan(31);

do $$
declare
  v_uid_ts   uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_psic uuid := '11111111-1111-4111-8111-111111111104';
  v_per_a    uuid := '67000000-0000-4000-a000-000000000101';
  v_per_b    uuid := '67000000-0000-4000-a000-000000000102';
  v_fic_a    uuid := '67000000-0000-4000-a000-000000000201';
  v_fic_b    uuid := '67000000-0000-4000-a000-000000000202';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values
    (v_per_a, 'PEHM900101MSLRRN67', 'Marina', 'Pérez', v_uid_ts),
    (v_per_b, 'LOGA910202HSLPRN67', 'Alma', 'López', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por
  ) values
    (v_fic_a, 'SEM-S367-0001', v_per_a, 'abierto', now(), v_uid_ts),
    (v_fic_b, 'SEM-S367-0002', v_per_b, 'abierto', now(), v_uid_ts);

  -- Escritura directa (sin RPC), como superusuario: el trigger la versiona
  insert into public.historial_clinico (ficha_id, motivo_consulta, creado_por)
  values (v_fic_b, 'Carga directa', v_uid_psic);
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

-- 1-4) Psicología crea el historial: versión 1
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select lives_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', null, 'Ant', 'Per', 'Motivo A'
    )$$,
  'psicologia crea el historial clínico'
);

select is(
  (select count(*)::int from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201'),
  1,
  'el primer guardado crea la versión 1'
);

select is(
  (select campos_modificados::text from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201' and version = 1),
  '{antecedentes_familiares,antecedentes_personales,motivo_consulta}',
  'la versión 1 lista los campos capturados'
);

select is(
  (select creado_por from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201' and version = 1),
  '11111111-1111-4111-8111-111111111104'::uuid,
  'la versión 1 registra a la psicóloga como autora'
);

-- 5-8) Edición: versión 2 solo con el campo cambiado
select lives_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201',
      (select actualizado_en from public.historial_clinico
       where ficha_id = '67000000-0000-4000-a000-000000000201'),
      null, null, 'Motivo B'
    )$$,
  'psicologia edita el historial clínico'
);

select is(
  (select count(*)::int from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201'),
  2,
  'la edición crea la versión 2'
);

select is(
  (select campos_modificados::text from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201' and version = 2),
  '{motivo_consulta}',
  'la versión 2 solo marca el campo modificado'
);

select is(
  (select antecedentes_familiares || '|' || motivo_consulta from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201' and version = 2),
  'Ant|Motivo B',
  'la versión 2 guarda el snapshot completo (conserva lo no editado)'
);

-- 9-10) Guardado sin cambios: no crea versión
select lives_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201',
      (select actualizado_en from public.historial_clinico
       where ficha_id = '67000000-0000-4000-a000-000000000201'),
      null, null, 'Motivo B'
    )$$,
  'psicologia guarda sin cambios'
);

select is(
  (select count(*)::int from public.historial_clinico_version
   where ficha_id = '67000000-0000-4000-a000-000000000201'),
  2,
  'un guardado sin cambios no crea versión'
);

-- 11-12) Psicología lista las versiones
select is(
  (select array_agg(version order by ord)::text
   from (
     select v.version, row_number() over () as ord
     from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201') v
   ) s),
  '{2,1}',
  'get_historial_clinico_versiones devuelve la más reciente primero'
);

select is(
  (select v.creado_por_nombre
   from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201') v
   where v.version = 2),
  (select e.nombre from public.empleado e where e.id = '11111111-1111-4111-8111-111111111104'),
  'las versiones incluyen el nombre de quien guardó'
);

-- 13-18) Los demás roles no pueden guardar
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select throws_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', now(), null, null, 'Intento titular'
    )$$,
  '42501', 'Solo Psicología puede registrar o editar el historial clínico',
  'titular no puede guardar el historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid); -- subdireccion
select throws_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', now(), null, null, 'Intento subdireccion'
    )$$,
  '42501', 'Solo Psicología puede registrar o editar el historial clínico',
  'subdireccion no puede guardar el historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', now(), null, null, 'Intento TS'
    )$$,
  '42501', 'Solo Psicología puede registrar o editar el historial clínico',
  'trabajo_social no puede guardar el historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', now(), null, null, 'Intento jur'
    )$$,
  '42501', 'Solo Psicología puede registrar o editar el historial clínico',
  'juridico no puede guardar el historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', now(), null, null, 'Intento recepcion'
    )$$,
  '42501', 'Solo Psicología puede registrar o editar el historial clínico',
  'recepcion no puede guardar el historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111107'::uuid); -- umeca
select throws_ok(
  $$select * from public.guardar_historial_clinico(
      '67000000-0000-4000-a000-000000000201', now(), null, null, 'Intento umeca'
    )$$,
  '42501', 'Solo Psicología puede registrar o editar el historial clínico',
  'umeca no puede guardar el historial clínico'
);

-- 19) Los intentos rechazados no alteraron el historial
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select motivo_consulta from public.historial_clinico
   where ficha_id = '67000000-0000-4000-a000-000000000201'),
  'Motivo B',
  'los intentos rechazados no modifican el historial'
);

-- 20-21) Dirección puede leer las versiones
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  (select count(*)::int
   from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201')),
  2,
  'titular lista las versiones del historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111102'::uuid); -- subdireccion
select is(
  (select count(*)::int
   from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201')),
  2,
  'subdireccion lista las versiones del historial clínico'
);

-- 22-24) Sin permiso de lectura: 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'trabajo_social no puede listar versiones del historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'juridico no puede listar versiones del historial clínico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.get_historial_clinico_versiones('67000000-0000-4000-a000-000000000201')$$,
  '42501', null,
  'recepcion no puede listar versiones del historial clínico'
);

-- 25-27) historial_clinico_version es append-only para el cliente
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$insert into public.historial_clinico_version (historial_clinico_id, ficha_id, version)
    select hc.id, hc.ficha_id, 99 from public.historial_clinico hc
    where hc.ficha_id = '67000000-0000-4000-a000-000000000201'$$,
  '42501', null,
  'no se inserta directo en historial_clinico_version'
);

select throws_ok(
  $$update public.historial_clinico_version set motivo_consulta = 'Alterado'
    where ficha_id = '67000000-0000-4000-a000-000000000201'$$,
  '42501', null,
  'no se actualiza directo historial_clinico_version'
);

select throws_ok(
  $$delete from public.historial_clinico_version
    where ficha_id = '67000000-0000-4000-a000-000000000201'$$,
  '42501', null,
  'no se borra directo de historial_clinico_version'
);

-- 28) La política de UPDATE directo exige historial_clinico.escribir
select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'historial_clinico'
      and p.policyname = 'historial_clinico_update'
      and p.qual like '%historial_clinico.escribir%'
  ),
  'historial_clinico_update exige historial_clinico.escribir'
);

-- 29-30) Matriz de permisos
select is(
  public.tiene_permiso('historial_clinico.escribir'),
  true,
  'psicologia: historial_clinico.escribir = true'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select is(
  public.tiene_permiso('historial_clinico.escribir')::text || '|' || public.tiene_permiso('historial_clinico.acceder')::text,
  'false|false',
  'titular: escribir = false y acceder = false'
);

-- 31) Una escritura directa (sin RPC) también queda versionada por el trigger
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select is(
  (select v.campos_modificados::text || '|' || v.creado_por::text
   from public.historial_clinico_version v
   where v.ficha_id = '67000000-0000-4000-a000-000000000202' and v.version = 1),
  '{motivo_consulta}|11111111-1111-4111-8111-111111111104',
  'el trigger versiona una escritura directa del historial'
);

select * from finish();
rollback;
