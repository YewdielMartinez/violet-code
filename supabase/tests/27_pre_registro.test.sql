-- =====================================================================
-- 27_pre_registro.test.sql (pgTAP · B-06 · RF-33, RNF-02 · SF-00)
-- Pruebas de integración para migración 27_pre_registro_seguro.sql:
--   - Seguridad anon (42501) en mi_pre_registro_id, get_mi_pre_registro y actualizar_mi_pre_registro
--   - La usuaria NO puede leer ni actualizar public.pre_registro directo (oculta persona_id y estado)
--   - get_mi_pre_registro() y actualizar_mi_pre_registro() operan sin exponer persona_id ni estado
--   - Botón de ayuda: la usuaria crea alerta app_movil usando mi_pre_registro_id()
--   - Aislamiento entre usuarias en alerta y rechazo al usar pre_registro_id ajeno (42501)
--   - Personal: trabajo_social lee pre_registro directo (incluyendo estado = 'ligado'); psicologia no
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

do $$
declare
  v_area_ts    smallint;
  v_area_psic  smallint;
  v_uid_ts     uuid := '97000000-0000-4000-a000-000000000001';
  v_uid_psic   uuid := '97000000-0000-4000-a000-000000000002';
  v_uid_app_1  uuid := '97000000-0000-4000-a000-000000000011';
  v_uid_app_2  uuid := '97000000-0000-4000-a000-000000000012';
  v_uid_sinpre uuid := '97000000-0000-4000-a000-000000000013';
  v_per_1      uuid := '97000000-0000-4000-a000-000000000101';
begin
  select ca.id into v_area_ts   from public.cat_area ca where ca.clave = 'trabajo_social';
  select ca.id into v_area_psic from public.cat_area ca where ca.clave = 'psicologia';

  insert into auth.users (id, email) values
    (v_uid_ts,     'test27.ts@semujeres.local'),
    (v_uid_psic,   'test27.psic@semujeres.local'),
    (v_uid_app_1,  'test27.app1@semujeres.local'),
    (v_uid_app_2,  'test27.app2@semujeres.local'),
    (v_uid_sinpre, 'test27.sinpre@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,   'TS PreRegistro Test',   'trabajo_social', v_area_ts,   true),
    (v_uid_psic, 'Psic PreRegistro Test', 'psicologia',     v_area_psic, true)
  on conflict (id) do nothing;

  -- Persona existente para comprobar liga silenciosa en pre_registro
  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por) values
    (v_per_1, 'TETE920315MSLRRR01', 'Elena', 'Rojas', v_uid_ts);
end $$;

-- 1-3. Seguridad anon: rechazado con 42501 en el helper y ambos RPCs
set local role anon;
select throws_ok(
  $$select public.mi_pre_registro_id()$$,
  '42501',
  null,
  'anon no puede ejecutar mi_pre_registro_id'
);
select throws_ok(
  $$select * from public.get_mi_pre_registro()$$,
  '42501',
  null,
  'anon no puede ejecutar get_mi_pre_registro'
);
select throws_ok(
  $$select * from public.actualizar_mi_pre_registro('Ana', null, null, null)$$,
  '42501',
  null,
  'anon no puede ejecutar actualizar_mi_pre_registro'
);

-- 4-6. Usuaria 1 crea su pre_registro con la CURP existente; no puede leer ni editar la tabla directo
select pg_temp.as_user('97000000-0000-4000-a000-000000000011');
insert into public.pre_registro (
  auth_user_id, curp, nombres, apellido_paterno, apellido_materno, celular, aviso_privacidad_aceptado_en
) values (
  '97000000-0000-4000-a000-000000000011',
  'TETE920315MSLRRR01',
  'Elena',
  'Rojas',
  'Mendez',
  '6681112233',
  now()
);

select is(
  (select count(*)::integer from public.pre_registro),
  0,
  'la usuaria app no puede leer filas directas de pre_registro (0 filas)'
);

update public.pre_registro
   set nombres = 'Cambio Directo'
 where auth_user_id = '97000000-0000-4000-a000-000000000011';

select is(
  (select g.nombres from public.get_mi_pre_registro() g),
  'Elena',
  'update directo en pre_registro por la usuaria no modifica la fila'
);

-- Verificar firma de get_mi_pre_registro: no contiene persona_id ni estado
select ok(
  not exists (
    select 1
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.specific_name like 'get_mi_pre_registro%'
      and p.parameter_mode = 'OUT'
      and p.parameter_name in ('persona_id', 'estado')
  ),
  'get_mi_pre_registro no expone columnas persona_id ni estado'
);

-- 7-9. actualizar_mi_pre_registro actualiza campos permitidos y rechaza entradas inválidas
select ok(
  exists (
    select 1
    from public.actualizar_mi_pre_registro('Elena Maria', null, '', '6689998877') a
    where a.nombres = 'Elena Maria'
      and a.apellido_materno is null
      and a.celular = '6689998877'
      and a.curp = 'TETE920315MSLRRR01'
  ),
  'actualizar_mi_pre_registro actualiza nombres, apellido_materno y celular sin tocar CURP'
);

select throws_ok(
  $$select * from public.actualizar_mi_pre_registro(null, null, null, '12345')$$,
  '23514',
  null,
  'celular distinto de 10 dígitos lanza 23514'
);

select throws_ok(
  $$select * from public.actualizar_mi_pre_registro('   ', null, null, null)$$,
  '23514',
  null,
  'p_nombres vacío lanza 23514'
);

-- 10. Cuenta autenticada sin pre_registro recibe 23514 al actualizar
select pg_temp.as_user('97000000-0000-4000-a000-000000000013');
select throws_ok(
  $$select * from public.actualizar_mi_pre_registro('Sin Registro', null, null, null)$$,
  '23514',
  null,
  'usuario sin pre_registro activo recibe 23514 al actualizar'
);

-- 11-12. Botón de ayuda: Usuaria 1 inserta su alerta con mi_pre_registro_id() y la consulta
select pg_temp.as_user('97000000-0000-4000-a000-000000000011');
select set_config('test.pre_1_id', public.mi_pre_registro_id()::text, true);
select lives_ok(
  $$
    insert into public.alerta (pre_registro_id, origen)
    values (public.mi_pre_registro_id(), 'app_movil')
  $$,
  'la usuaria app puede crear alerta app_movil usando mi_pre_registro_id()'
);

select is(
  (select count(*)::integer from public.alerta),
  1,
  'la usuaria app ve su propia alerta creada'
);

-- 13-15. Aislamiento entre usuarias en alerta
select pg_temp.as_user('97000000-0000-4000-a000-000000000012');
insert into public.pre_registro (
  auth_user_id, curp, nombres, apellido_paterno, aviso_privacidad_aceptado_en
) values (
  '97000000-0000-4000-a000-000000000012',
  'TATN940820MSLRRR02',
  'Nadia',
  'Cruz',
  now()
);

insert into public.alerta (pre_registro_id, origen)
values (public.mi_pre_registro_id(), 'app_movil');

select is(
  (select count(*)::integer from public.alerta),
  1,
  'usuaria 2 solo ve su propia alerta (1 fila, sin ver la de usuaria 1)'
);

select throws_ok(
  $$
    insert into public.alerta (pre_registro_id, origen)
    values (current_setting('test.pre_1_id')::uuid, 'app_movil')
  $$,
  '42501',
  null,
  'usuaria 2 no puede crear alerta usando un pre_registro_id ajeno'
);

-- Nota: comprobar también con el id explícito de mi_pre_registro de usuaria 1 vía consulta RLS de TS en el siguiente bloque
-- 16-17. Personal: trabajo_social lee pre_registro directo (ve estado = ligado y persona_id); psicologia no ve nada
select pg_temp.as_user('97000000-0000-4000-a000-000000000001');
select ok(
  exists (
    select 1
    from public.pre_registro pr
    where pr.auth_user_id = '97000000-0000-4000-a000-000000000011'
      and pr.estado = 'ligado'
      and pr.persona_id = '97000000-0000-4000-a000-000000000101'
  ),
  'trabajo_social sigue leyendo pre_registro directo y confirma liga silenciosa con persona_id'
);

select is(
  (
    select count(*)::integer
    from public.alerta a
    where a.pre_registro_id in (
      select pr.id
      from public.pre_registro pr
      where pr.auth_user_id in (
        '97000000-0000-4000-a000-000000000011',
        '97000000-0000-4000-a000-000000000012'
      )
    )
  ),
  2,
  'trabajo_social (alerta.ver_cola) ve ambas alertas en la cola'
);

select pg_temp.as_user('97000000-0000-4000-a000-000000000002');
select is(
  (
    select count(*)::integer
    from public.pre_registro pr
    where pr.auth_user_id = '97000000-0000-4000-a000-000000000011'
  ),
  0,
  'psicologia (sin expediente.escribir) obtiene 0 filas al leer pre_registro directo'
);

select * from finish();

rollback;
