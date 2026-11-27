-- =====================================================================
-- 64_agresor_parentesco_ocupacion.test.sql
-- Pruebas pgTAP para migración 20261128002300_64_agresor_parentesco_ocupacion_obligatorios.sql:
--   - Alta con guardar_agresor sin parentesco -> 23514.
--   - Alta con parentesco pero sin ocupación -> 23514.
--   - Alta con parentesco y ocupación -> crea el agresor.
--   - Edición de un agresor existente sin parentesco/ocupación sigue permitida.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

do $$
declare
  v_uid_ts  uuid := '11111111-1111-4111-8111-111111111103';
  v_per     uuid := '64000000-0000-4000-a000-000000000101';
  v_fic     uuid := '64000000-0000-4000-a000-000000000201';
  v_agr_old uuid := '64000000-0000-4000-a000-000000000301';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per, 'PEGA900101MSLRRN03', 'Ana', 'Pérez', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic, 'SEM-S64A-0001', v_per, 'abierto', now(), v_uid_ts);

  -- Agresor previo sin parentesco ni ocupación (dato histórico).
  insert into public.agresor (id, ficha_id, nombres, creado_por) values
    (v_agr_old, v_fic, 'Historico', v_uid_ts);
end;
$$;

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
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo social

-- 1) Sin parentesco ni ocupación
select throws_ok(
  $$select * from public.guardar_agresor(null, '64000000-0000-4000-a000-000000000201', null, 'Carlos', 'Mendez')$$,
  '23514',
  'El parentesco con la usuaria es obligatorio al registrar a la persona agresora',
  'alta sin parentesco lanza 23514'
);

-- 2) Con parentesco, sin ocupación
select throws_ok(
  $$select * from public.guardar_agresor(
    null, '64000000-0000-4000-a000-000000000201', null, 'Carlos', 'Mendez',
    p_parentesco_id => (select id from public.cat_parentesco order by id limit 1)
  )$$,
  '23514',
  'La ocupación es obligatoria al registrar a la persona agresora',
  'alta con parentesco pero sin ocupación lanza 23514'
);

-- 3) Con ocupación, sin parentesco
select throws_ok(
  $$select * from public.guardar_agresor(
    null, '64000000-0000-4000-a000-000000000201', null, 'Carlos', 'Mendez',
    p_ocupacion_id => (select id from public.cat_ocupacion order by id limit 1)
  )$$,
  '23514',
  'El parentesco con la usuaria es obligatorio al registrar a la persona agresora',
  'alta con ocupación pero sin parentesco lanza 23514'
);

-- 4) Con ambos: crea
select is(
  (
    select nombres
    from public.guardar_agresor(
      null, '64000000-0000-4000-a000-000000000201', null, 'Carlos', 'Mendez',
      p_parentesco_id => (select id from public.cat_parentesco order by id limit 1),
      p_ocupacion_id => (select id from public.cat_ocupacion order by id limit 1)
    )
  ),
  'Carlos',
  'alta con parentesco y ocupación crea el agresor'
);

-- 5) Edición de un registro histórico sin parentesco/ocupación sigue permitida
select is(
  (
    select nombres
    from public.guardar_agresor(
      '64000000-0000-4000-a000-000000000301',
      null,
      (select actualizado_en from public.agresor where id = '64000000-0000-4000-a000-000000000301'),
      'Historico editado'
    )
  ),
  'Historico editado',
  'editar un agresor existente sin parentesco/ocupación no se bloquea'
);

select * from finish();
rollback;
