-- =====================================================================
-- 33_rpc_crear_canalizacion.sql (A-01 · Sprint 02)
-- Qué contiene:
--   1. RPC public.crear_canalizacion(p_ficha_id, p_destino,
--      p_area_destino_id, p_institucion_id, p_institucion_otra, p_motivo):
--      - Restringida a Trabajo Social vía tiene_permiso('canalizacion.crear').
--      - Deriva area_origen_id exclusivamente desde auth_area_id().
--      - Valida expediente activo y no archivado, reglas de destino
--        interno/externo y reutiliza el trigger validar_derivacion_area()
--        (incluida RN-01 de mayoría de edad).
--      - Devuelve aviso no bloqueante si la persona es hombre y el
--        destino no es jurídico ni externo (RN-03).
--      - Inserta el evento inicial en canalizacion_evento si la tabla ya
--        existe (creada en A-02).
--   2. Cierra la política derivacion_insert en RLS (with check (false)):
--      las canalizaciones solo se crean mediante esta RPC.
-- =====================================================================

create or replace function public.crear_canalizacion(
  p_ficha_id         uuid,
  p_destino          public.destino_derivacion,
  p_area_destino_id  smallint default null,
  p_institucion_id   smallint default null,
  p_institucion_otra text default null,
  p_motivo           text default null
)
returns table (
  derivacion_id uuid,
  estado        public.estado_derivacion,
  aviso         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id         uuid := auth.uid();
  v_area_origen_id   smallint;
  v_ficha            record;
  v_institucion_otra text;
  v_motivo           text;
  v_derivacion_id    uuid;
  v_estado           public.estado_derivacion;
  v_aviso            text := null;
begin
  if not public.tiene_permiso('canalizacion.crear') then
    raise exception 'Sin permiso para crear canalizaciones' using errcode = '42501';
  end if;

  v_area_origen_id := public.auth_area_id();
  if v_area_origen_id is null then
    raise exception 'Sin permiso para crear canalizaciones' using errcode = '42501';
  end if;

  if p_ficha_id is null or p_destino is null then
    raise exception 'El expediente y el destino son obligatorios' using errcode = '23514';
  end if;

  v_institucion_otra := nullif(btrim(coalesce(p_institucion_otra, '')), '');
  v_motivo           := nullif(btrim(coalesce(p_motivo, '')), '');

  if v_institucion_otra is not null and char_length(v_institucion_otra) > 200 then
    raise exception 'El nombre de la institución externa no debe exceder 200 caracteres'
      using errcode = '23514';
  end if;

  if v_motivo is not null and char_length(v_motivo) > 1000 then
    raise exception 'El motivo de canalización no debe exceder 1000 caracteres'
      using errcode = '23514';
  end if;

  select f.id, f.estado, p.sexo
  into v_ficha
  from public.ficha_registro f
  join public.persona p on p.id = f.persona_id
  where f.id = p_ficha_id
    and f.activo
    and p.activo;

  if v_ficha.id is null then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if v_ficha.estado = 'archivado' then
    raise exception 'No se pueden crear canalizaciones sobre un expediente archivado'
      using errcode = '23514';
  end if;

  if p_destino in ('trabajo_social', 'psicologia', 'juridico') then
    if p_area_destino_id is null then
      raise exception 'El área destino es obligatoria para canalizaciones internas'
        using errcode = '23514';
    end if;
    if p_institucion_id is not null or v_institucion_otra is not null then
      raise exception 'Las canalizaciones internas no deben incluir institución externa'
        using errcode = '23514';
    end if;
  else
    if p_area_destino_id is not null then
      raise exception 'Las canalizaciones externas no deben indicar área destino interna'
        using errcode = '23514';
    end if;
    if p_institucion_id is not null and v_institucion_otra is not null then
      raise exception 'Indica una institución del catálogo o un nombre manual, no ambos'
        using errcode = '23514';
    end if;
    if p_destino = 'otra_institucion'
       and p_institucion_id is null
       and v_institucion_otra is null then
      raise exception 'Indica la institución destino para canalizaciones a otra institución'
        using errcode = '23514';
    end if;
    if p_institucion_id is not null
       and not exists (
         select 1
         from public.directorio_institucion di
         where di.id = p_institucion_id
           and di.activo
       ) then
      raise exception 'Institución del directorio no encontrada o inactiva'
        using errcode = '23514';
    end if;
  end if;

  -- RN-03: aviso no bloqueante cuando la persona es hombre y se canaliza a un área no jurídica
  if v_ficha.sexo = 'H' and p_destino in ('trabajo_social', 'psicologia') then
    v_aviso := 'Aviso RN-03: para hombres en temas no jurídicos se recomienda canalizar a otra institución.';
  end if;

  insert into public.derivacion as d (
    ficha_id,
    area_origen_id,
    area_destino_id,
    institucion_id,
    destino,
    institucion_otra,
    motivo,
    estado,
    creado_por
  ) values (
    p_ficha_id,
    v_area_origen_id,
    p_area_destino_id,
    p_institucion_id,
    p_destino,
    v_institucion_otra,
    v_motivo,
    'pendiente',
    v_actor_id
  )
  returning d.id, d.estado
  into v_derivacion_id, v_estado;

  -- Si A-02 ya creó la tabla de historial, registra el primer evento automáticamente
  if to_regclass('public.canalizacion_evento') is not null then
    execute 'insert into public.canalizacion_evento (derivacion_id, estado_anterior, estado_nuevo, nota, creado_por) values ($1, null, $2, $3, $4)'
      using v_derivacion_id, v_estado, v_motivo, v_actor_id;
  end if;

  return query select v_derivacion_id, v_estado, v_aviso;
end;
$$;

revoke all on function public.crear_canalizacion(uuid, public.destino_derivacion, smallint, smallint, text, text) from public, anon;
grant  execute on function public.crear_canalizacion(uuid, public.destino_derivacion, smallint, smallint, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Cierre de inserción directa en derivacion: solo vía crear_canalizacion()
-- ---------------------------------------------------------------------
drop policy if exists derivacion_insert on public.derivacion;

create policy derivacion_insert on public.derivacion
  for insert to authenticated
  with check (false);
