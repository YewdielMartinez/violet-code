-- =====================================================================
-- 38_archivar_y_reabrir.sql (A-06 · Sprint 02)
-- Qué contiene:
--   1. Columnas de archivo y reapertura en public.ficha_registro:
--      motivo_archivo, archivada_en, archivada_por,
--      motivo_reapertura, reabierta_en, reabierta_por.
--   2. Actualiza archivar_ficha(p_ficha_id, p_motivo):
--      exige p_motivo obligatorio (23514) y guarda motivo_archivo,
--      archivada_en y archivada_por. No toca get_expediente_detalle().
--   3. Crea RPC reabrir_ficha(p_ficha_id, p_motivo):
--      permiso 'expediente.reabrir' (titular, subdireccion), solo desde
--      'archivado', pasa a 'en_seguimiento' si tiene atenciones activas
--      o a 'abierto' si no, guardando motivo_reapertura, reabierta_en y
--      reabierta_por.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas de archivo y reapertura en public.ficha_registro
-- ---------------------------------------------------------------------
alter table public.ficha_registro
  add column if not exists motivo_archivo    text
    check (motivo_archivo is null or char_length(btrim(motivo_archivo)) between 1 and 1000),
  add column if not exists archivada_en      timestamptz,
  add column if not exists archivada_por     uuid references public.empleado (id) on delete restrict,
  add column if not exists motivo_reapertura text
    check (motivo_reapertura is null or char_length(btrim(motivo_reapertura)) between 1 and 1000),
  add column if not exists reabierta_en      timestamptz,
  add column if not exists reabierta_por     uuid references public.empleado (id) on delete restrict;

-- ---------------------------------------------------------------------
-- 2. RPC: public.archivar_ficha (motivo obligatorio y persistido)
-- ---------------------------------------------------------------------
create or replace function public.archivar_ficha(
  p_ficha_id uuid,
  p_motivo   text default null
)
returns table (
  ficha_id       uuid,
  estado         public.estado_ficha,
  actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_ficha    record;
  v_motivo   text;
begin
  if not public.tiene_permiso('expediente.escribir') then
    raise exception 'Sin permiso para archivar expedientes' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if v_motivo is null then
    raise exception 'El motivo para archivar el expediente es obligatorio'
      using errcode = '23514';
  end if;

  if char_length(v_motivo) > 1000 then
    raise exception 'El motivo para archivar no debe exceder 1000 caracteres'
      using errcode = '23514';
  end if;

  select f.id, f.persona_id, f.estado
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo
  for update;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if v_ficha.estado not in ('abierto', 'en_seguimiento', 'cerrado') then
    raise exception 'El expediente ya se encuentra archivado o en un estado no archivable' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.cita c
    where c.persona_id = v_ficha.persona_id
      and c.activo
      and c.estado in ('agendada', 'confirmada')
      and c.programada_en > now()
  ) then
    raise exception 'No se puede archivar un expediente con citas futuras agendadas o confirmadas' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.alerta al
    where al.activo
      and al.estado in ('nueva', 'tomada')
      and (
        al.persona_id = v_ficha.persona_id
        or al.pre_registro_id in (
          select pr.id
          from public.pre_registro pr
          where pr.persona_id = v_ficha.persona_id
            and pr.activo
        )
      )
  ) then
    raise exception 'No se puede archivar un expediente con alertas abiertas' using errcode = '23514';
  end if;

  return query
  update public.ficha_registro f
  set estado         = 'archivado',
      motivo_archivo = v_motivo,
      archivada_en   = now(),
      archivada_por  = v_actor_id
  where f.id = v_ficha.id
  returning f.id as ficha_id, f.estado, f.actualizado_en;
end;
$$;

revoke all on function public.archivar_ficha(uuid, text) from public, anon;
grant  execute on function public.archivar_ficha(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC: public.reabrir_ficha
-- ---------------------------------------------------------------------
create or replace function public.reabrir_ficha(
  p_ficha_id uuid,
  p_motivo   text default null
)
returns table (
  ficha_id       uuid,
  estado         public.estado_ficha,
  actualizado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id     uuid := auth.uid();
  v_ficha        record;
  v_motivo       text;
  v_nuevo_estado public.estado_ficha;
begin
  if not public.tiene_permiso('expediente.reabrir') then
    raise exception 'Sin permiso para reabrir expedientes' using errcode = '42501';
  end if;

  if p_ficha_id is null then
    raise exception 'El identificador del expediente es obligatorio' using errcode = '23514';
  end if;

  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  if v_motivo is null then
    raise exception 'El motivo para reabrir el expediente es obligatorio'
      using errcode = '23514';
  end if;

  if char_length(v_motivo) > 1000 then
    raise exception 'El motivo de reapertura no debe exceder 1000 caracteres'
      using errcode = '23514';
  end if;

  select f.id, f.estado
  into v_ficha
  from public.ficha_registro f
  where f.id = p_ficha_id
    and f.activo
  for update;

  if not found then
    raise exception 'Expediente no encontrado o inactivo' using errcode = '23514';
  end if;

  if v_ficha.estado <> 'archivado' then
    raise exception 'Solo se pueden reabrir expedientes archivados'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.atencion a
    where a.ficha_id = v_ficha.id
      and a.activo
  ) then
    v_nuevo_estado := 'en_seguimiento';
  else
    v_nuevo_estado := 'abierto';
  end if;

  return query
  update public.ficha_registro f
  set estado            = v_nuevo_estado,
      motivo_reapertura = v_motivo,
      reabierta_en      = now(),
      reabierta_por     = v_actor_id
  where f.id = v_ficha.id
  returning f.id as ficha_id, f.estado, f.actualizado_en;
end;
$$;

revoke all on function public.reabrir_ficha(uuid, text) from public, anon;
grant  execute on function public.reabrir_ficha(uuid, text) to authenticated;
