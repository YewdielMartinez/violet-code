-- =====================================================================
-- 16_storage_y_bitacora.sql (A-01 · Sprint 01)
-- 1. Agrega política DELETE en storage.objects para el bucket privado
--    'documentos' (evita archivos huérfanos si falla el insert en documento).
-- 2. Endurece registrar_consulta() con errcode = '42501', validación
--    con es_empleado_activo() / es_umeca() y lista blanca de p_tabla (23514).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Política DELETE de Storage para documentos
--    Limitada a quien subió el archivo (owner_id = auth.uid()::text)
--    para evitar borrados arbitrarios entre áreas sin dejar rastro.
-- ---------------------------------------------------------------------
drop policy if exists documentos_storage_delete on storage.objects;
create policy documentos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (select public.tiene_permiso('expediente.ver'))
    and owner_id = (select auth.uid()::text)
  );

-- ---------------------------------------------------------------------
-- 2. RPC registrar_consulta(p_tabla, p_registro_id)
-- ---------------------------------------------------------------------
create or replace function public.registrar_consulta(p_tabla text, p_registro_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id           uuid := auth.uid();
  v_empleado_id        uuid;
  v_usuario_externo_id uuid;
  v_tabla              text := lower(btrim(coalesce(p_tabla, '')));
  v_registro_id        text := btrim(coalesce(p_registro_id, ''));
begin
  if v_actor_id is null or not (public.es_empleado_activo() or public.es_umeca()) then
    raise exception 'Sin permiso para registrar consultas' using errcode = '42501';
  end if;

  if v_tabla not in (
    'ficha_registro',
    'agresor',
    'persona',
    'documento',
    'historial_clinico',
    'cita'
  ) then
    raise exception 'Tabla no permitida para registro de consulta' using errcode = '23514';
  end if;

  if v_registro_id = '' then
    raise exception 'El identificador de registro es obligatorio' using errcode = '23514';
  end if;

  select e.id into v_empleado_id
  from public.empleado e
  where e.id = v_actor_id
    and e.activo;

  if v_empleado_id is null then
    select u.id into v_usuario_externo_id
    from public.usuario_externo u
    where u.id = v_actor_id
      and u.activo;
  end if;

  insert into public.bitacora_acceso (
    empleado_id,
    usuario_externo_id,
    accion,
    tabla_afectada,
    registro_id
  ) values (
    v_empleado_id,
    v_usuario_externo_id,
    'ver',
    v_tabla,
    v_registro_id
  );
end;
$$;

revoke execute on function public.registrar_consulta(text, text) from public, anon;
grant  execute on function public.registrar_consulta(text, text) to authenticated;
