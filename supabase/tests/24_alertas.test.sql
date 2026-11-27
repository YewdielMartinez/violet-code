-- =====================================================================
-- 24_alertas.test.sql (pgTAP)
-- Pruebas de integración para migración 24_rpc_cola_alertas.sql:
--   - Seguridad: anon, recepcion en get_cola_alertas, trabajo_social en tomar_alerta (42501)
--   - Prioridad automática con orden de protección (alta al crear y al registrar orden después)
--   - Cola ordenada con tiene_orden_vigente y bitacora_acceso
--   - tomar_alerta (23505 en segunda toma) y atender_alerta (transiciones y validaciones)
-- =====================================================================

begin;

select plan(17);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;
-- Desde la migración 31, las funciones nuevas no tienen EXECUTE para PUBLIC por defecto.
grant execute on function pg_temp.as_user(uuid) to public;

do $$
declare
  v_area_ts      smallint;
  v_uid_dir      uuid := '93000000-0000-4000-a000-000000000001';
  v_uid_ts       uuid := '93000000-0000-4000-a000-000000000002';
  v_uid_rec      uuid := '93000000-0000-4000-a000-000000000003';
  v_uid_app_1    uuid := '93000000-0000-4000-a000-000000000011';
  v_uid_app_2    uuid := '93000000-0000-4000-a000-000000000012';
  v_per_con_ord  uuid := '93000000-0000-4000-a000-000000000101';
  v_per_sin_ord  uuid := '93000000-0000-4000-a000-000000000102';
  v_fic_con_ord  uuid := '93000000-0000-4000-a000-000000000201';
  v_fic_sin_ord  uuid := '93000000-0000-4000-a000-000000000202';
  v_pre_1        uuid := '93000000-0000-4000-a000-000000000401';
  v_pre_2        uuid := '93000000-0000-4000-a000-000000000402';
begin
  select id into v_area_ts from public.cat_area where clave = 'trabajo_social';

  insert into auth.users (id, email) values
    (v_uid_dir,   'alerta.dir@semujeres.local'),
    (v_uid_ts,    'alerta.ts@semujeres.local'),
    (v_uid_rec,   'alerta.rec@semujeres.local'),
    (v_uid_app_1, 'alerta.app1@semujeres.local'),
    (v_uid_app_2, 'alerta.app2@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_dir, 'Subdir Alerta',    'subdireccion',   null,      true),
    (v_uid_ts,  'TS Alerta',        'trabajo_social', v_area_ts, true),
    (v_uid_rec, 'Recepcion Alerta', 'recepcion',      null,      true)
  on conflict (id) do nothing;
  update auth.users u set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', to_jsonb('empleado'::text), true) where exists (select 1 from public.empleado e where e.id = u.id) and coalesce(u.raw_app_meta_data ->> 'tipo', '') <> 'empleado';

  insert into public.persona (id, curp, nombres, apellido_paterno, celular, creado_por) values
    (v_per_con_ord, 'AERT900512MSLRRR01', 'Patricia', 'ConOrden', '6684444444', v_uid_ts),
    (v_per_sin_ord, 'AERT910512MSLRRR02', 'Valeria',  'SinOrden', '6685555555', v_uid_ts);

  insert into public.ficha_registro (id, folio, persona_id, aviso_privacidad_aceptado_en, creado_por) values
    (v_fic_con_ord, 'SEM-ALR-0001', v_per_con_ord, now(), v_uid_ts),
    (v_fic_sin_ord, 'SEM-ALR-0002', v_per_sin_ord, now(), v_uid_ts);

  -- Pre-registros ligados por CURP
  insert into public.pre_registro (id, auth_user_id, curp, nombres, apellido_paterno, celular, aviso_privacidad_aceptado_en) values
    (v_pre_1, v_uid_app_1, 'AERT900512MSLRRR01', 'Patricia', 'ConOrden', '6684444444', now()),
    (v_pre_2, v_uid_app_2, 'AERT910512MSLRRR02', 'Valeria',  'SinOrden', '6685555555', now());

  -- Orden vigente para Patricia
  insert into public.orden_proteccion (ficha_id, numero_oficio, fecha_emision, fecha_vigencia, estado, creado_por) values
    (v_fic_con_ord, 'OF-ALR-1', current_date - 2, current_date + 30, 'vigente', v_uid_ts);
end $$;

-- 1-3. Seguridad: anon rechazado en los 3 RPCs
set local role anon;
select throws_ok(
  $$select * from public.get_cola_alertas()$$,
  '42501',
  null,
  'anon no puede consultar get_cola_alertas'
);
select throws_ok(
  $$select * from public.tomar_alerta('93000000-0000-4000-a000-000000000501')$$,
  '42501',
  null,
  'anon no puede tomar_alerta'
);
select throws_ok(
  $$select * from public.atender_alerta('93000000-0000-4000-a000-000000000501')$$,
  '42501',
  null,
  'anon no puede atender_alerta'
);

-- 4. Seguridad: recepcion rechazado en get_cola_alertas (42501)
select pg_temp.as_user('93000000-0000-4000-a000-000000000003');
select throws_ok(
  $$select * from public.get_cola_alertas()$$,
  '42501',
  null,
  'recepcion no puede consultar get_cola_alertas'
);

-- 5. Seguridad: trabajo_social rechazado en tomar_alerta (42501)
select pg_temp.as_user('93000000-0000-4000-a000-000000000002');
select throws_ok(
  $$select * from public.tomar_alerta('93000000-0000-4000-a000-000000000501')$$,
  '42501',
  null,
  'trabajo_social no puede tomar_alerta de linea 24/7'
);

-- 6. Prioridad inicial: Patricia (con orden vigente) -> alerta app_movil entra en 'alta'
reset role;
insert into public.alerta (id, origen, pre_registro_id)
values ('93000000-0000-4000-a000-000000000501', 'app_movil', '93000000-0000-4000-a000-000000000401');

select pg_temp.as_user('93000000-0000-4000-a000-000000000011');
select is(
  (select prioridad from public.alerta where id = '93000000-0000-4000-a000-000000000501'),
  'alta'::public.prioridad_nivel,
  'alerta app_movil de persona con orden vigente entra en prioridad alta'
);

-- 7. Prioridad inicial: Valeria (sin orden) -> alerta entra en 'media'
reset role;
insert into public.alerta (id, origen, pre_registro_id)
values ('93000000-0000-4000-a000-000000000502', 'app_movil', '93000000-0000-4000-a000-000000000402');

select pg_temp.as_user('93000000-0000-4000-a000-000000000012');
select is(
  (select prioridad from public.alerta where id = '93000000-0000-4000-a000-000000000502'),
  'media'::public.prioridad_nivel,
  'alerta app_movil sin orden vigente entra en prioridad media'
);

-- 8. Recálculo automático: al registrar orden vigente para Valeria, su alerta 'nueva' sube a 'alta'
select pg_temp.as_user('93000000-0000-4000-a000-000000000001');
insert into public.orden_proteccion (ficha_id, numero_oficio, fecha_emision, fecha_vigencia, estado, creado_por)
values ('93000000-0000-4000-a000-000000000202', 'OF-ALR-2', current_date, current_date + 15, 'vigente', '93000000-0000-4000-a000-000000000001');

select is(
  (select prioridad from public.alerta where id = '93000000-0000-4000-a000-000000000502'),
  'alta'::public.prioridad_nivel,
  'registrar orden_proteccion vigente sube a alta las alertas nuevas de esa persona'
);

-- 9-10. get_cola_alertas devuelve tiene_orden_vigente=true y registra 'ver' en bitacora_acceso
select ok(
  (select count(*) >= 2 and bool_and(tiene_orden_vigente)
   from public.get_cola_alertas()
   where alerta_id in ('93000000-0000-4000-a000-000000000501', '93000000-0000-4000-a000-000000000502')),
  'get_cola_alertas devuelve alertas de alta y expone tiene_orden_vigente=true'
);
select ok(
  exists (
    select 1 from public.bitacora_acceso b
    where b.empleado_id = '93000000-0000-4000-a000-000000000001'
      and b.accion = 'ver'
      and b.tabla_afectada = 'alerta'
      and b.registro_id = 'cola'
  ),
  'get_cola_alertas registra evento ver en bitacora_acceso'
);

-- 10. Edge case: p_limite = 0 -> 23514
select throws_ok(
  $$select * from public.get_cola_alertas(null, 0)$$,
  '23514',
  null,
  'get_cola_alertas rechaza p_limite = 0 con 23514'
);

-- 11. Camino no feliz: atender_alerta sobre alerta aun en estado 'nueva' -> 23514
select throws_ok(
  $$select * from public.atender_alerta('93000000-0000-4000-a000-000000000501', 'Nota')$$,
  '23514',
  null,
  'atender_alerta rechaza alerta en estado nueva con 23514'
);

-- 12. Camino feliz: tomar_alerta pasa de 'nueva' a 'tomada'
select ok(
  (select estado = 'tomada'
      and tomada_en is not null
      and atendida_por = '93000000-0000-4000-a000-000000000001'
   from public.tomar_alerta('93000000-0000-4000-a000-000000000501')),
  'tomar_alerta cambia estado a tomada con timestamp y atendida_por'
);

-- 13. Conflicto duplicado: segundo tomar_alerta sobre la misma alerta da 23505
select throws_ok(
  $$select * from public.tomar_alerta('93000000-0000-4000-a000-000000000501')$$,
  '23505',
  null,
  'tomar una alerta ya tomada devuelve 23505'
);

-- 14. Camino feliz: atender_alerta pasa de 'tomada' a 'atendida' con observaciones
select * from public.atender_alerta('93000000-0000-4000-a000-000000000501', '  Se brindo auxilio inmediato  ');
select ok(
  (select estado = 'atendida'
      and atendida_en is not null
      and observaciones = 'Se brindo auxilio inmediato'
   from public.alerta
   where id = '93000000-0000-4000-a000-000000000501'),
  'atender_alerta concluye la alerta con atendida_en y observaciones limpias'
);

-- 15-16. Edge cases desde terminal 'atendida' -> 23514
select throws_ok(
  $$select * from public.tomar_alerta('93000000-0000-4000-a000-000000000501')$$,
  '23514',
  null,
  'tomar_alerta rechaza alerta ya atendida con 23514'
);
select throws_ok(
  $$select * from public.atender_alerta('93000000-0000-4000-a000-000000000501')$$,
  '23514',
  null,
  'atender_alerta rechaza alerta ya atendida con 23514'
);

select * from finish();

rollback;
