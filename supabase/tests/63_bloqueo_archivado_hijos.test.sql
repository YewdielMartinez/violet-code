-- =====================================================================
-- 63_bloqueo_archivado_hijos.test.sql
-- Verifica la migración 20261128002200_63_bloqueo_archivado_hijos.sql:
--   - Con ficha archivada fallan insert/update directos de orden_proteccion
--     y documento, la subida a storage.objects ('documentos'), así como
--     guardar_agresor y crear_canalizacion.
--   - Al reabrir el expediente (reabrir_ficha) vuelven a permitirse altas
--     y actualizaciones en orden_proteccion, documento y Storage.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(13);

do $$
declare
  v_uid_ts   uuid := '11111111-1111-4111-8111-111111111103';
  v_per_id   uuid := '63000000-0000-4000-a000-000000000101';
  v_fic_id   uuid := '63000000-0000-4000-a000-000000000201';
  v_ord_id   uuid := '63000000-0000-4000-a000-000000000301';
  v_doc_id   uuid := '63000000-0000-4000-a000-000000000401';
  v_tdoc_id  smallint;
begin
  select id into v_tdoc_id
  from public.cat_tipo_documento
  order by id
  limit 1;

  insert into public.persona (id, curp, nombres, apellido_paterno, creado_por)
  values (v_per_id, 'MOVV920515MSLGRN01', 'Valeria', 'Montes', v_uid_ts);

  insert into public.ficha_registro (
    id, folio, persona_id, estado, aviso_privacidad_aceptado_en,
    motivo_archivo, archivada_en, archivada_por, creado_por
  ) values (
    v_fic_id, 'SEM-S363-0001', v_per_id, 'archivado', now(),
    'Caso concluido', now(), v_uid_ts, v_uid_ts
  );

  insert into public.orden_proteccion (
    id, ficha_id, numero_oficio, autoridad_emisora, fecha_emision, estado, creado_por
  ) values (
    v_ord_id, v_fic_id, 'OF-63-01', 'Juzgado Familiar', current_date, 'vigente', v_uid_ts
  );

  insert into public.documento (
    id, ficha_id, tipo_documento_id, ruta_storage, nombre_archivo, creado_por
  ) values (
    v_doc_id, v_fic_id, v_tdoc_id, v_fic_id::text || '/base.pdf', 'base.pdf', v_uid_ts
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

-- 1-7) Ficha archivada: bloquea orden_proteccion, documento, Storage, guardar_agresor y crear_canalizacion
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select throws_ok(
  $$insert into public.orden_proteccion (ficha_id, numero_oficio, autoridad_emisora, fecha_emision, estado) values ('63000000-0000-4000-a000-000000000201', 'OF-63-02', 'Fiscalia', current_date, 'vigente')$$,
  '42501', null, 'orden_proteccion insert falla con 42501 si la ficha esta archivada'
);

select throws_ok(
  $$update public.orden_proteccion set autoridad_emisora = 'Otro' where id = '63000000-0000-4000-a000-000000000301'$$,
  '42501', null, 'orden_proteccion update falla con 42501 si la ficha esta archivada'
);

select throws_ok(
  $$insert into public.documento (ficha_id, tipo_documento_id, ruta_storage, nombre_archivo) values ('63000000-0000-4000-a000-000000000201', (select id from public.cat_tipo_documento order by id limit 1), '63000000-0000-4000-a000-000000000201/nuevo.pdf', 'nuevo.pdf')$$,
  '42501', null, 'documento insert falla con 42501 si la ficha esta archivada'
);

select throws_ok(
  $$update public.documento set descripcion = 'Editado' where id = '63000000-0000-4000-a000-000000000401'$$,
  '42501', null, 'documento update falla con 42501 si la ficha esta archivada'
);

select throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id) values ('63000000-0000-4000-a000-000000000501', 'documentos', '63000000-0000-4000-a000-000000000201/subida.pdf', '11111111-1111-4111-8111-111111111103')$$,
  '42501', null, 'storage documentos insert falla con 42501 si la ficha esta archivada'
);

select throws_ok(
  $$select * from public.guardar_agresor(null, '63000000-0000-4000-a000-000000000201', null, 'Carlos')$$,
  '23514', null, 'guardar_agresor sigue rechazando ficha archivada con 23514'
);

select throws_ok(
  $$select * from public.crear_canalizacion('63000000-0000-4000-a000-000000000201', 'psicologia', (select id from public.cat_area where clave = 'psicologia'))$$,
  '23514', null, 'crear_canalizacion sigue rechazando ficha archivada con 23514'
);

-- 8) Reabrir la ficha con titular
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101'::uuid); -- titular
select lives_ok(
  $$select * from public.reabrir_ficha('63000000-0000-4000-a000-000000000201'::uuid, 'Reapertura para seguimiento')$$,
  'titular reabre la ficha archivada'
);

-- 9-13) Tras reabrir, trabajo_social vuelve a poder insertar y editar hijos y Storage
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

select lives_ok(
  $$insert into public.orden_proteccion (ficha_id, numero_oficio, autoridad_emisora, fecha_emision, estado) values ('63000000-0000-4000-a000-000000000201', 'OF-63-02', 'Fiscalia', current_date, 'vigente')$$,
  'orden_proteccion insert funciona al reabrir'
);

select lives_ok(
  $$update public.orden_proteccion set autoridad_emisora = 'Juzgado Reabierto' where id = '63000000-0000-4000-a000-000000000301'$$,
  'orden_proteccion update funciona al reabrir'
);

select lives_ok(
  $$insert into public.documento (ficha_id, tipo_documento_id, ruta_storage, nombre_archivo) values ('63000000-0000-4000-a000-000000000201', (select id from public.cat_tipo_documento order by id limit 1), '63000000-0000-4000-a000-000000000201/reabierto.pdf', 'reabierto.pdf')$$,
  'documento insert funciona al reabrir'
);

select lives_ok(
  $$update public.documento set descripcion = 'Actualizado' where id = '63000000-0000-4000-a000-000000000401'$$,
  'documento update funciona al reabrir'
);

select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id) values ('63000000-0000-4000-a000-000000000502', 'documentos', '63000000-0000-4000-a000-000000000201/reabierto-subida.pdf', '11111111-1111-4111-8111-111111111103')$$,
  'storage documentos insert funciona al reabrir'
);

select * from finish();
rollback;
