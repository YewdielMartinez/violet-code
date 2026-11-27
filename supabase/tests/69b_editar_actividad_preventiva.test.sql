-- =====================================================================
-- 69b_editar_actividad_preventiva.test.sql (pgTAP · RF-16)
-- Pruebas para migración 20261128002800_69_editar_actividad_preventiva.sql:
--   - Permisos: anon, recepcion y umeca rechazados (42501).
--   - Edición de una actividad pendiente: campos, trim y valores nulos.
--   - Reemplazo del personal participante (baja lógica y reactivación).
--   - Solo pendientes (22023), P0002, bloqueo optimista (23505),
--     validaciones del payload (23514) y atomicidad ante error.
--   - Bitácora y columna actualizado_en en get_actividades_preventivas.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(32);

create or replace function pg_temp.as_user(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on function pg_temp.as_user(uuid) to public;

do $$
declare
  v_area_ts  smallint;
  v_tipo1    smallint;
  v_tipo2    smallint;
  v_uid_ts   uuid := 'a5000000-0000-4000-a000-000000000001';
  v_uid_p1   uuid := 'a5000000-0000-4000-a000-000000000002';
  v_uid_rec  uuid := 'a5000000-0000-4000-a000-000000000003';
  v_uid_p2   uuid := 'a5000000-0000-4000-a000-000000000004';
  v_uid_umec uuid := 'a5000000-0000-4000-a000-000000000005';
  v_uid_off  uuid := 'a5000000-0000-4000-a000-000000000006';
begin
  select ca.id into v_area_ts from public.cat_area ca where ca.clave = 'trabajo_social';
  select cta.id into v_tipo1 from public.cat_tipo_actividad cta order by cta.id limit 1;
  select cta.id into v_tipo2 from public.cat_tipo_actividad cta order by cta.id desc limit 1;

  insert into auth.users (id, email) values
    (v_uid_ts,   'test65.ts@semujeres.local'),
    (v_uid_p1,   'test65.p1@semujeres.local'),
    (v_uid_rec,  'test65.rec@semujeres.local'),
    (v_uid_p2,   'test65.p2@semujeres.local'),
    (v_uid_umec, 'test65.umeca@semujeres.local'),
    (v_uid_off,  'test65.off@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo) values
    (v_uid_ts,  'TS Edicion Test',          'trabajo_social', v_area_ts, true),
    (v_uid_p1,  'Participante Uno Test',    'trabajo_social', v_area_ts, true),
    (v_uid_rec, 'Recepcion Edicion Test',   'recepcion',      null,      true),
    (v_uid_p2,  'Participante Dos Test',    'trabajo_social', v_area_ts, true),
    (v_uid_off, 'Participante Baja Test',   'trabajo_social', v_area_ts, false)
  on conflict (id) do nothing;

  insert into public.usuario_externo (id, nombre, dependencia, activo) values
    (v_uid_umec, 'UMECA Edicion Test', 'umeca', true)
  on conflict (id) do nothing;

  update auth.users u
  set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}',
        to_jsonb(case when u.id = v_uid_umec then 'externo' else 'empleado' end), true)
  where u.id in (v_uid_ts, v_uid_p1, v_uid_rec, v_uid_p2, v_uid_umec, v_uid_off);

  -- A: pendiente editable, B: realizada, C: cancelada, D: inactiva
  insert into public.actividad_preventiva
    (id, titulo, tipo_actividad_id, tipo_institucion, nivel_educativo, sede, direccion, referencias,
     programada_en, numero_asistentes, activo, estado, realizada_en, creado_por)
  values
    ('a5000000-0000-4000-a000-0000000000a1', 'TEST65 Original', v_tipo1, 'escuela', 'primaria', 'Sede Original',
     'Calle 1', 'Ref 1', now() + interval '10 days', 20, true, 'pendiente', null, v_uid_ts),
    ('a5000000-0000-4000-a000-0000000000b1', 'TEST65 Realizada', v_tipo1, 'comunidad', null, 'Sede B',
     null, null, now() - interval '10 days', 30, true, 'realizada', now() - interval '9 days', v_uid_ts),
    ('a5000000-0000-4000-a000-0000000000c1', 'TEST65 Cancelada', v_tipo1, 'comunidad', null, 'Sede C',
     null, null, now() + interval '11 days', null, true, 'cancelada', null, v_uid_ts),
    ('a5000000-0000-4000-a000-0000000000d1', 'TEST65 Inactiva', v_tipo1, 'comunidad', null, 'Sede D',
     null, null, now() + interval '12 days', null, false, 'pendiente', null, v_uid_ts);

  -- Personal inicial de A: participante uno
  insert into public.actividad_empleado (actividad_preventiva_id, empleado_id, creado_por)
  values ('a5000000-0000-4000-a000-0000000000a1', v_uid_p1, v_uid_ts);

  -- Segundo tipo de actividad disponible para la edición (por si el catálogo tiene uno solo)
  perform set_config('test65.tipo2', v_tipo2::text, true);
end $$;

-- 1. anon
set local role anon;
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1', '{}'::jsonb, now())$$,
  '42501',
  null,
  'anon no puede editar actividades'
);
reset role;

-- 2. recepcion
select pg_temp.as_user('a5000000-0000-4000-a000-000000000003');
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1', '{}'::jsonb, now())$$,
  '42501',
  'Sin permiso para editar actividades preventivas',
  'recepcion no puede editar actividades'
);
reset role;

-- 3. umeca
select pg_temp.as_user('a5000000-0000-4000-a000-000000000005');
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1', '{}'::jsonb, now())$$,
  '42501',
  null,
  'umeca no puede editar actividades'
);
reset role;

-- A partir de aquí: trabajo social (actividad.registrar)
select pg_temp.as_user('a5000000-0000-4000-a000-000000000001');

-- 4. get_actividades_preventivas expone actualizado_en
select ok(
  (select g.actualizado_en = ap.actualizado_en
   from public.get_actividades_preventivas(null, null, 200, 'pendiente') g
   join public.actividad_preventiva ap on ap.id = g.id
   where g.id = 'a5000000-0000-4000-a000-0000000000a1'),
  'get_actividades_preventivas expone actualizado_en'
);

-- 5. id nulo
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(null, '{}'::jsonb, now())$$,
  '22023',
  'El identificador de la actividad es obligatorio',
  'p_actividad_id nulo lanza 22023'
);

-- 6. actualizado_en nulo
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1', '{}'::jsonb, null)$$,
  '22023',
  'actualizado_en es obligatorio para editar la actividad',
  'p_actualizado_en nulo lanza 22023'
);

-- 7. payload no objeto
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1', '[]'::jsonb,
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1'))$$,
  '23514',
  'El payload de actividad preventiva debe ser un objeto JSON',
  'payload que no es objeto lanza 23514'
);

-- 8. bloqueo optimista: actualizado_en viejo
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1',
      jsonb_build_object('titulo', 'X', 'tipo_actividad_id', (select min(id) from public.cat_tipo_actividad),
                         'tipo_institucion', 'comunidad', 'sede', 'X', 'programada_en', now()),
      now() - interval '1 day')$$,
  '23505',
  'Esta actividad fue modificada por otra persona. Recarga los datos.',
  'actualizado_en obsoleto lanza 23505'
);

-- 9. P0002 inexistente
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000ff', '{}'::jsonb, now())$$,
  'P0002',
  null,
  'actividad inexistente lanza P0002'
);

-- 10. P0002 inactiva
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000d1', '{}'::jsonb, now())$$,
  'P0002',
  null,
  'actividad inactiva lanza P0002'
);

-- 11. realizada: no editable
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000b1', '{}'::jsonb,
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000b1'))$$,
  '22023',
  'Solo se pueden editar actividades pendientes',
  'una actividad realizada no se puede editar'
);

-- 12. cancelada: no editable
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000c1', '{}'::jsonb,
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000c1'))$$,
  '22023',
  'Solo se pueden editar actividades pendientes',
  'una actividad cancelada no se puede editar'
);

-- 13. título faltante
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1',
      jsonb_build_object('tipo_actividad_id', (select min(id) from public.cat_tipo_actividad),
                         'tipo_institucion', 'comunidad', 'sede', 'X', 'programada_en', now()),
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1'))$$,
  '23514',
  'El título de la actividad es obligatorio',
  'título obligatorio (23514)'
);

-- 14. nivel educativo con institución distinta de escuela
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1',
      jsonb_build_object('titulo', 'X', 'tipo_actividad_id', (select min(id) from public.cat_tipo_actividad),
                         'tipo_institucion', 'comunidad', 'nivel_educativo', 'primaria',
                         'sede', 'X', 'programada_en', now()),
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1'))$$,
  '23514',
  'El nivel educativo solo aplica cuando la institución es una escuela',
  'nivel_educativo solo con escuela (23514)'
);

-- 15. participante inactivo
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1',
      jsonb_build_object('titulo', 'X', 'tipo_actividad_id', (select min(id) from public.cat_tipo_actividad),
                         'tipo_institucion', 'comunidad', 'sede', 'X', 'programada_en', now(),
                         'participantes_ids', jsonb_build_array('a5000000-0000-4000-a000-000000000006')),
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1'))$$,
  '23514',
  'Uno o más participantes no existen o están inactivos',
  'participante inactivo (23514)'
);

-- 16. asistentes fuera de rango
select throws_ok(
  $$select * from public.actualizar_actividad_preventiva(
      'a5000000-0000-4000-a000-0000000000a1',
      jsonb_build_object('titulo', 'X', 'tipo_actividad_id', (select min(id) from public.cat_tipo_actividad),
                         'tipo_institucion', 'comunidad', 'sede', 'X', 'programada_en', now(),
                         'numero_asistentes', 10001),
      (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1'))$$,
  '23514',
  'El número de asistentes debe estar entre 0 y 10000',
  'numero_asistentes fuera de rango (23514)'
);

-- 17. un error de validación no deja la actividad a medias (atomicidad)
select is(
  (select ap.titulo from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1'),
  'TEST65 Original',
  'tras errores de validación la actividad conserva sus datos'
);

-- 18. edición válida: devuelve id, total de participantes y actualizado_en
select is(
  (select r.total_participantes
   from public.actualizar_actividad_preventiva(
     'a5000000-0000-4000-a000-0000000000a1',
     jsonb_build_object(
       'titulo', '  TEST65 Editada  ',
       'tipo_actividad_id', current_setting('test65.tipo2')::int,
       'tipo_institucion', 'empresa_privada',
       'nivel_educativo', null,
       'sede', '  Sede Editada  ',
       'direccion', '   ',
       'referencias', null,
       'programada_en', (now() + interval '20 days')::text,
       'numero_asistentes', 55,
       'participantes_ids', jsonb_build_array(
         'a5000000-0000-4000-a000-000000000001',
         'a5000000-0000-4000-a000-000000000002',
         'a5000000-0000-4000-a000-000000000002')),
     (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1')) r),
  2,
  'editar devuelve total_participantes = 2 (sin duplicados)'
);

-- 19. campos actualizados (trim, vacíos a null, nivel educativo limpio)
select ok(
  (select ap.titulo = 'TEST65 Editada'
          and ap.sede = 'Sede Editada'
          and ap.tipo_actividad_id = current_setting('test65.tipo2')::int
          and ap.tipo_institucion = 'empresa_privada'
          and ap.nivel_educativo is null
          and ap.direccion is null
          and ap.referencias is null
          and ap.numero_asistentes = 55
          and ap.estado = 'pendiente'
          and ap.programada_en > now() + interval '19 days'
   from public.actividad_preventiva ap
   where ap.id = 'a5000000-0000-4000-a000-0000000000a1'),
  'la edición actualiza los campos (trim, vacío = null) y conserva el estado pendiente'
);

-- 20. personal: ahora TS y participante uno
select is(
  (select array_agg(ae.empleado_id order by ae.empleado_id)::text
   from public.actividad_empleado ae
   where ae.actividad_preventiva_id = 'a5000000-0000-4000-a000-0000000000a1' and ae.activo),
  '{a5000000-0000-4000-a000-000000000001,a5000000-0000-4000-a000-000000000002}',
  'el personal activo es el enviado'
);

-- 21. reemplazo: sale TS, entra participante dos; el que sale queda inactivo (sin borrar)
select is(
  (select r.total_participantes
   from public.actualizar_actividad_preventiva(
     'a5000000-0000-4000-a000-0000000000a1',
     jsonb_build_object(
       'titulo', 'TEST65 Editada', 'tipo_actividad_id', current_setting('test65.tipo2')::int,
       'tipo_institucion', 'empresa_privada', 'sede', 'Sede Editada', 'programada_en', (now() + interval '20 days')::text,
       'participantes_ids', jsonb_build_array(
         'a5000000-0000-4000-a000-000000000002',
         'a5000000-0000-4000-a000-000000000004')),
     (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1')) r),
  2,
  'reemplazar el personal devuelve el nuevo total'
);
select ok(
  exists (select 1 from public.actividad_empleado ae
          where ae.actividad_preventiva_id = 'a5000000-0000-4000-a000-0000000000a1'
            and ae.empleado_id = 'a5000000-0000-4000-a000-000000000001' and not ae.activo)
  and (select count(*) from public.actividad_empleado ae
       where ae.actividad_preventiva_id = 'a5000000-0000-4000-a000-0000000000a1' and ae.activo) = 2,
  'quien sale queda inactivo (baja lógica) y hay 2 activos'
);

-- 23. reactivar a quien había salido
select is(
  (select r.total_participantes
   from public.actualizar_actividad_preventiva(
     'a5000000-0000-4000-a000-0000000000a1',
     jsonb_build_object(
       'titulo', 'TEST65 Editada', 'tipo_actividad_id', current_setting('test65.tipo2')::int,
       'tipo_institucion', 'empresa_privada', 'sede', 'Sede Editada', 'programada_en', (now() + interval '20 days')::text,
       'participantes_ids', jsonb_build_array('a5000000-0000-4000-a000-000000000001')),
     (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1')) r),
  1,
  'volver a incluir a alguien lo reactiva (sin violar el unique)'
);
select ok(
  (select count(*) = 1 and bool_and(ae.empleado_id = 'a5000000-0000-4000-a000-000000000001')
   from public.actividad_empleado ae
   where ae.actividad_preventiva_id = 'a5000000-0000-4000-a000-0000000000a1' and ae.activo),
  'solo queda activo el empleado reactivado'
);

-- 25. sin participantes_ids se conserva el personal
select is(
  (select r.total_participantes
   from public.actualizar_actividad_preventiva(
     'a5000000-0000-4000-a000-0000000000a1',
     jsonb_build_object(
       'titulo', 'TEST65 Editada', 'tipo_actividad_id', current_setting('test65.tipo2')::int,
       'tipo_institucion', 'empresa_privada', 'sede', 'Sede Editada', 'programada_en', (now() + interval '20 days')::text),
     (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1')) r),
  1,
  'sin participantes_ids se conserva el personal actual'
);

-- 26. arreglo vacío quita a todos
select is(
  (select r.total_participantes
   from public.actualizar_actividad_preventiva(
     'a5000000-0000-4000-a000-0000000000a1',
     jsonb_build_object(
       'titulo', 'TEST65 Editada', 'tipo_actividad_id', current_setting('test65.tipo2')::int,
       'tipo_institucion', 'empresa_privada', 'sede', 'Sede Editada', 'programada_en', (now() + interval '20 days')::text,
       'participantes_ids', '[]'::jsonb),
     (select ap.actualizado_en from public.actividad_preventiva ap where ap.id = 'a5000000-0000-4000-a000-0000000000a1')) r),
  0,
  'participantes_ids vacío deja la actividad sin personal'
);

-- 27. el listado refleja la edición
select ok(
  (select g.titulo = 'TEST65 Editada' and g.participantes = '[]'::jsonb and g.estado = 'pendiente'
   from public.get_actividades_preventivas(null, null, 200, 'pendiente') g
   where g.id = 'a5000000-0000-4000-a000-0000000000a1'),
  'get_actividades_preventivas refleja la actividad editada'
);

-- 28. se puede editar de nuevo con el actualizado_en devuelto por el listado
select ok(
  (select r.actividad_id = 'a5000000-0000-4000-a000-0000000000a1'
   from public.actualizar_actividad_preventiva(
     'a5000000-0000-4000-a000-0000000000a1',
     jsonb_build_object(
       'titulo', 'TEST65 Final', 'tipo_actividad_id', current_setting('test65.tipo2')::int,
       'tipo_institucion', 'comunidad', 'sede', 'Sede Final', 'programada_en', (now() + interval '21 days')::text),
     (select g.actualizado_en from public.get_actividades_preventivas(null, null, 200, 'pendiente') g
      where g.id = 'a5000000-0000-4000-a000-0000000000a1')) r),
  'editar usando el actualizado_en que devuelve get_actividades_preventivas'
);

reset role;

-- 29. bitácora
select ok(
  exists (
    select 1 from public.bitacora_acceso ba
    where ba.tabla_afectada = 'actividad_preventiva'
      and ba.registro_id = 'a5000000-0000-4000-a000-0000000000a1'
      and ba.accion = 'actualizar'
      and ba.empleado_id = 'a5000000-0000-4000-a000-000000000001'),
  'actualizar_actividad_preventiva registra en bitacora_acceso'
);

-- 30. las actividades cerradas no cambiaron
select ok(
  (select ap.titulo = 'TEST65 Realizada' from public.actividad_preventiva ap
   where ap.id = 'a5000000-0000-4000-a000-0000000000b1')
  and (select ap.titulo = 'TEST65 Cancelada' from public.actividad_preventiva ap
       where ap.id = 'a5000000-0000-4000-a000-0000000000c1'),
  'las actividades realizada y cancelada quedan intactas'
);

-- 31. permisos de ejecución: anon sin EXECUTE
select ok(
  not has_function_privilege('anon', 'public.actualizar_actividad_preventiva(uuid, jsonb, timestamptz)', 'execute'),
  'anon no tiene EXECUTE sobre actualizar_actividad_preventiva'
);

-- 32. authenticated con EXECUTE
select ok(
  has_function_privilege('authenticated', 'public.actualizar_actividad_preventiva(uuid, jsonb, timestamptz)', 'execute'),
  'authenticated tiene EXECUTE sobre actualizar_actividad_preventiva'
);

select * from finish();
rollback;
