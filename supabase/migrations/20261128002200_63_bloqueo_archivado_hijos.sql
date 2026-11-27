-- =====================================================================
-- 63_bloqueo_archivado_hijos.sql
-- Bloquea altas y ediciones en orden_proteccion, documento y
-- storage.objects ('documentos') cuando el expediente está archivado
-- (estado = 'archivado'). Al reabrirlo vuelven a permitirse.
-- Nota: guardar_agresor (58), desactivar_agresor (36) y
-- crear_canalizacion (33) ya rechazan fichas archivadas con 23514.
-- =====================================================================

-- 1. Helper: true si la ficha existe, está activa y no está archivada
create or replace function public.ficha_editable(p_ficha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ficha_registro f
    where f.id = p_ficha_id
      and f.activo
      and f.estado <> 'archivado'
  );
$$;

revoke execute on function public.ficha_editable(uuid) from public, anon;
grant  execute on function public.ficha_editable(uuid) to authenticated;

-- 2. orden_proteccion: insert y update exigen ficha editable
alter policy orden_proteccion_insert on public.orden_proteccion
  with check (
    (select public.tiene_permiso('orden_proteccion.escribir'))
    and (select public.ficha_editable(ficha_id))
  );

alter policy orden_proteccion_update on public.orden_proteccion
  using ((select public.tiene_permiso('orden_proteccion.escribir')))
  with check (
    (select public.tiene_permiso('orden_proteccion.escribir'))
    and (select public.ficha_editable(ficha_id))
  );

-- 3. documento: insert y update exigen ficha editable
alter policy documento_insert on public.documento
  with check (
    (select public.tiene_permiso('expediente.ver'))
    and (select public.ficha_editable(ficha_id))
  );

alter policy documento_update on public.documento
  using ((select public.tiene_permiso('expediente.ver')))
  with check (
    (select public.tiene_permiso('expediente.ver'))
    and (select public.ficha_editable(ficha_id))
  );

-- 4. storage.objects (bucket privado 'documentos'): ruta <ficha_id>/<uuid>-<archivo>
alter policy documentos_storage_insert on storage.objects
  with check (
    bucket_id = 'documentos'::text
    and (select public.tiene_permiso('expediente.ver'::text))
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.ficha_editable(((storage.foldername(name))[1])::uuid)
  );
