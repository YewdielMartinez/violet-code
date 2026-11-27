-- =====================================================================
-- 37_historial_estudio.test.sql (A-05 · Sprint 02)
-- Pruebas pgTAP para migración 20261127000600_37_rpc_historial_clinico_y_estudio.sql:
--   - guardar_historial_clinico / get_historial_clinico: permiso
--     historial_clinico.acceder (TS, Jur, Rec -> 42501), RN-01 menor de
--     edad (23514), ficha archivada (23514), bloqueo optimista (23505)
--     y registro automático de 'ver' y 'actualizar' en bitacora_acceso.
--   - registrar_estudio_socioeconomico: permiso expediente.escribir,
--     desmarca estudio previo (es_actual = false), corrige estudio de
--     hoy de la misma persona (fue_correccion = true) y crea nueva
--     versión si lo registra otra persona el mismo día.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(25);

create temp table pg_temp.res_a05_hc (
  id                                uuid,
  ficha_id                          uuid,
  antecedentes_familiares           text,
  antecedentes_personales           text,
  motivo_consulta                   text,
  observaciones_iniciales           text,
  tiene_atencion_psicologica_previa boolean,
  actualizado_en                    timestamptz
) on commit drop;
grant select, insert, update on pg_temp.res_a05_hc to authenticated;

create temp table pg_temp.res_a05_est (
  caso           text,
  estudio_id     uuid,
  ficha_id       uuid,
  fecha_estudio  date,
  es_actual      boolean,
  fue_correccion boolean,
  actualizado_en timestamptz
) on commit drop;
grant select, insert on pg_temp.res_a05_est to authenticated;

do $$
declare
  v_uid_ts     uuid := '11111111-1111-4111-8111-111111111103';
  v_per_act    uuid := '97000000-0000-4000-a000-000000000101';
  v_per_menor  uuid := '97000000-0000-4000-a000-000000000102';
  v_per_arch   uuid := '97000000-0000-4000-a000-000000000103';
  v_fic_act    uuid := '97000000-0000-4000-a000-000000000201';
  v_fic_menor  uuid := '97000000-0000-4000-a000-000000000202';
  v_fic_arch   uuid := '97000000-0000-4000-a000-000000000203';
  v_est_prev   uuid := '97000000-0000-4000-a000-000000000301';
begin
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_act,   'SAHL920415MSLGRN01', 'Ana',   'Lopez', v_uid_ts),
    (v_per_menor, 'SAHM150512MSLRRNA3', 'Sofia', 'Perez', v_uid_ts),
    (v_per_arch,  'SAHA880620MSLRRN02', 'Laura', 'Diaz',  v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, estado, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_act,   'SEM-S2A5-0001', v_per_act,   'abierto',   now(), v_uid_ts),
    (v_fic_menor, 'SEM-S2A5-0002', v_per_menor, 'abierto',   now(), v_uid_ts),
    (v_fic_arch,  'SEM-S2A5-0003', v_per_arch,  'archivado', now(), v_uid_ts);

  -- Estudio previo de hace 5 dias para probar es_actual = false
  insert into public.estudio_socioeconomico (
    id, ficha_id, fecha_estudio, es_actual, ingreso_mensual_propio, numero_dependientes, creado_por
  ) values (
    v_est_prev, v_fic_act, current_date - 5, true, 5000.00, 1, v_uid_ts
  );
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

-- 1-4) Historial clínico: rechazos 42501
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.guardar_historial_clinico('97000000-0000-4000-a000-000000000201', null, 'Ant', 'Per', 'Motivo')$$,
  '42501', null, 'trabajo_social recibe 42501 en guardar_historial_clinico'
);
select throws_ok(
  $$select * from public.get_historial_clinico('97000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'trabajo_social recibe 42501 en get_historial_clinico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.get_historial_clinico('97000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'juridico recibe 42501 en get_historial_clinico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.guardar_historial_clinico('97000000-0000-4000-a000-000000000201', null, 'Ant')$$,
  '42501', null, 'recepcion recibe 42501 en guardar_historial_clinico'
);

-- 5-12) Historial clínico como Psicología
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia

select throws_ok(
  $$select * from public.guardar_historial_clinico('97000000-0000-4000-a000-000000000202', null, null, null, 'Menor RN-01')$$,
  '23514', null, 'guardar_historial_clinico rechaza menor de 18 anos (RN-01)'
);

select throws_ok(
  $$select * from public.guardar_historial_clinico('97000000-0000-4000-a000-000000000203', null, null, null, 'Archivado')$$,
  '23514', 'Reabre el expediente para editarlo', 'guardar_historial_clinico rechaza expediente archivado'
);

insert into pg_temp.res_a05_hc
select *
from public.guardar_historial_clinico(
  '97000000-0000-4000-a000-000000000201',
  null,
  'Red materna',
  'Sin antecedentes',
  'Ansiedad leve',
  'Observacion inicial',
  false
);

select is(
  (select motivo_consulta || '|' || tiene_atencion_psicologica_previa::text from pg_temp.res_a05_hc),
  'Ansiedad leve|false',
  'psicologia crea historial_clinico con guardar_historial_clinico'
);

select is(
  (select motivo_consulta from public.get_historial_clinico('97000000-0000-4000-a000-000000000201')),
  'Ansiedad leve',
  'get_historial_clinico devuelve el historial guardado'
);

reset role;
select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'historial_clinico'
      and b.registro_id = (select id::text from pg_temp.res_a05_hc)
      and b.accion = 'ver'
  ),
  1,
  'get_historial_clinico deja accion ver en bitacora_acceso'
);
set local role authenticated;

select throws_ok(
  $$select * from public.guardar_historial_clinico('97000000-0000-4000-a000-000000000201', now() - interval '1 hour', 'Otro')$$,
  '23505', 'Este registro fue modificado por otra persona. Recarga los datos.',
  'guardar_historial_clinico con actualizado_en viejo lanza 23505'
);

with upd as (
  select *
  from public.guardar_historial_clinico(
    '97000000-0000-4000-a000-000000000201',
    (select actualizado_en from pg_temp.res_a05_hc),
    '',
    null,
    null,
    'Observacion actualizada',
    true
  )
)
select is(
  (select coalesce(antecedentes_familiares, '<null>') || '|' || motivo_consulta || '|' || observaciones_iniciales from upd),
  '<null>|Ansiedad leve|Observacion actualizada',
  'guardar_historial_clinico conserva con null y borra opcional con cadena vacia'
);

reset role;
select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.tabla_afectada = 'historial_clinico'
      and b.registro_id = (select id::text from pg_temp.res_a05_hc)
      and b.accion = 'actualizar'
  ),
  1,
  'edicion de historial_clinico deja accion actualizar en bitacora_acceso'
);
set local role authenticated;

-- 13-18) registrar_estudio_socioeconomico: permisos y validaciones 23514
select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico('97000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'psicologia recibe 42501 en registrar_estudio_socioeconomico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111105'::uuid); -- juridico
select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico('97000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'juridico recibe 42501 en registrar_estudio_socioeconomico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico('97000000-0000-4000-a000-000000000201')$$,
  '42501', null, 'recepcion recibe 42501 en registrar_estudio_socioeconomico'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico('97000000-0000-4000-a000-000000000203')$$,
  '23514', 'Reabre el expediente para editarlo', 'registrar_estudio_socioeconomico rechaza expediente archivado'
);

select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico('97000000-0000-4000-a000-000000000201', 4000, 1::smallint, false, 'Beca sin marcar tiene_apoyo')$$,
  '23514', null, 'registrar_estudio_socioeconomico rechaza especificacion_apoyo sin tiene_apoyo'
);

select throws_ok(
  $$select * from public.registrar_estudio_socioeconomico('97000000-0000-4000-a000-000000000201', 4000, 1::smallint, false, null, 'propia'::public.tipo_vivienda, 'block'::public.material_vivienda, 'Adobe')$$,
  '23514', null, 'registrar_estudio_socioeconomico rechaza material_otro si material != otro'
);

-- 19-25) Versionado, desmarcado de estudio previo y corrección el mismo día
insert into pg_temp.res_a05_est
select 'nuevo_ts', estudio_id, ficha_id, fecha_estudio, es_actual, fue_correccion, actualizado_en
from public.registrar_estudio_socioeconomico(
  '97000000-0000-4000-a000-000000000201',
  7500.00,
  2::smallint,
  false,
  null,
  'rentada'::public.tipo_vivienda,
  'block'::public.material_vivienda,
  null,
  array['agua', 'luz']::public.servicio_vivienda[],
  array['estufa']::public.bien_vivienda[],
  '[{"nombre":"Madre Aportante","monto":2500,"frecuencia":"quincenal"}]'::jsonb
);

select is(
  (select fue_correccion::text || '|' || es_actual::text from pg_temp.res_a05_est where caso = 'nuevo_ts'),
  'false|true',
  'primer estudio de hoy crea nueva version (fue_correccion = false, es_actual = true)'
);

select is(
  (select es_actual from public.estudio_socioeconomico where id = '97000000-0000-4000-a000-000000000301'),
  false,
  'registrar_estudio_socioeconomico desmarca el estudio anterior (es_actual = false)'
);

select is(
  (select count(*)::int from public.estudio_socioeconomico where ficha_id = '97000000-0000-4000-a000-000000000201' and es_actual),
  1,
  'solo queda un estudio actual por expediente'
);

insert into pg_temp.res_a05_est
select 'correccion_ts', estudio_id, ficha_id, fecha_estudio, es_actual, fue_correccion, actualizado_en
from public.registrar_estudio_socioeconomico(
  '97000000-0000-4000-a000-000000000201',
  8200.00,
  3::smallint,
  true,
  'Apoyo municipal',
  'rentada'::public.tipo_vivienda,
  'ladrillo'::public.material_vivienda,
  null,
  null,
  null,
  '[{"nombre":"Hermana Aportante","monto":1800,"frecuencia":"mensual"}]'::jsonb
);

select is(
  (
    select (c.fue_correccion and c.estudio_id = n.estudio_id)
    from pg_temp.res_a05_est c, pg_temp.res_a05_est n
    where c.caso = 'correccion_ts' and n.caso = 'nuevo_ts'
  ),
  true,
  'segunda llamada el mismo dia por el mismo actor corrige el estudio actual'
);

select is(
  (
    select count(*) filter (where activo)::text || '|' || count(*) filter (where not activo)::text
    from public.aportante_hogar
    where estudio_socioeconomico_id = (select estudio_id from pg_temp.res_a05_est where caso = 'correccion_ts')
  ),
  '1|1',
  'correccion del mismo dia desactiva aportante previo y registra el nuevo'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular mismo dia
insert into pg_temp.res_a05_est
select 'nueva_titular', estudio_id, ficha_id, fecha_estudio, es_actual, fue_correccion, actualizado_en
from public.registrar_estudio_socioeconomico(
  '97000000-0000-4000-a000-000000000201',
  9000.00,
  3::smallint
);

select is(
  (
    select (not t.fue_correccion and t.estudio_id <> n.estudio_id)
    from pg_temp.res_a05_est t, pg_temp.res_a05_est n
    where t.caso = 'nueva_titular' and n.caso = 'nuevo_ts'
  ),
  true,
  'llamada el mismo dia por otro usuario crea una nueva version'
);

select is(
  (
    select es_actual
    from public.estudio_socioeconomico
    where id = (select estudio_id from pg_temp.res_a05_est where caso = 'nuevo_ts')
  ),
  false,
  'nueva version de Titular deja el estudio anterior de TS con es_actual = false'
);

reset role;

select * from finish();
rollback;
