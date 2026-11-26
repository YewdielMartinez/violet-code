-- =====================================================================
-- 27_pre_registro_seguro.sql (B-06 · Sprint 01 · RF-33, RNF-02 · SF-00)
-- Oculta persona_id y estado de pre_registro a la app móvil mediante:
--   1) Helper public.mi_pre_registro_id()
--   2) Restricción de pre_registro_select y pre_registro_update a personal
--      con 'expediente.escribir' (mantiene pre_registro_insert intacta)
--   3) Actualización de alerta_select y alerta_insert con mi_pre_registro_id()
--      para mantener operativo el botón de ayuda sin leer pre_registro
--   4) RPCs get_mi_pre_registro() y actualizar_mi_pre_registro(...)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper public.mi_pre_registro_id()
-- Devuelve el id del pre_registro activo de auth.uid() sin exponer la
-- tabla pre_registro directamente a la app móvil.
-- ---------------------------------------------------------------------
create or replace function public.mi_pre_registro_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pr.id
  from public.pre_registro pr
  where pr.auth_user_id = auth.uid()
    and pr.activo
  limit 1;
$$;

revoke all on function public.mi_pre_registro_id() from public, anon;
grant execute on function public.mi_pre_registro_id() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Políticas RLS de public.pre_registro
-- La usuaria ya no puede leer ni editar directo pre_registro (evita ver
-- persona_id y estado). pre_registro_insert se conserva igual.
-- ---------------------------------------------------------------------
drop policy if exists pre_registro_select on public.pre_registro;
create policy pre_registro_select on public.pre_registro
  for select to authenticated
  using ((select public.tiene_permiso('expediente.escribir')));

drop policy if exists pre_registro_update on public.pre_registro;
create policy pre_registro_update on public.pre_registro
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir')))
  with check ((select public.tiene_permiso('expediente.escribir')));

-- ---------------------------------------------------------------------
-- 3. Políticas RLS de public.alerta
-- Usan mi_pre_registro_id() en lugar de subconsultas directas a
-- pre_registro para que el botón de ayuda siga funcionando.
-- ---------------------------------------------------------------------
drop policy if exists alerta_select on public.alerta;
create policy alerta_select on public.alerta
  for select to authenticated
  using (
    (select public.tiene_permiso('alerta.ver_cola'))
    or pre_registro_id = (select public.mi_pre_registro_id())
  );

drop policy if exists alerta_insert on public.alerta;
create policy alerta_insert on public.alerta
  for insert to authenticated
  with check (
    (select public.tiene_permiso('alerta.atender'))
    or (
      origen = 'app_movil'
      and persona_id is null
      and pre_registro_id = (select public.mi_pre_registro_id())
    )
  );

-- ---------------------------------------------------------------------
-- 4. public.get_mi_pre_registro()
-- Devuelve el pre-registro activo de la usuaria autenticada sin exponer
-- persona_id ni estado. Propiedad por auth.uid().
-- ---------------------------------------------------------------------
create or replace function public.get_mi_pre_registro()
returns table (
  id                           uuid,
  curp                         text,
  nombres                      text,
  apellido_paterno             text,
  apellido_materno             text,
  celular                      text,
  aviso_privacidad_aceptado_en timestamptz,
  creado_en                    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Sesión autenticada requerida para consultar el pre-registro'
      using errcode = '42501';
  end if;

  return query
  select pr.id                           as id,
         pr.curp                         as curp,
         pr.nombres                      as nombres,
         pr.apellido_paterno             as apellido_paterno,
         pr.apellido_materno             as apellido_materno,
         pr.celular                      as celular,
         pr.aviso_privacidad_aceptado_en as aviso_privacidad_aceptado_en,
         pr.creado_en                    as creado_en
  from public.pre_registro pr
  where pr.auth_user_id = v_actor_id
    and pr.activo
  limit 1;
end;
$$;

revoke execute on function public.get_mi_pre_registro() from public, anon;
grant  execute on function public.get_mi_pre_registro() to authenticated;

-- ---------------------------------------------------------------------
-- 5. public.actualizar_mi_pre_registro(...)
-- Actualiza los datos editables del pre-registro activo de auth.uid()
-- sin permitir cambiar CURP, estado ni persona_id.
-- ---------------------------------------------------------------------
create or replace function public.actualizar_mi_pre_registro(
  p_nombres          text default null,
  p_apellido_paterno text default null,
  p_apellido_materno text default null,
  p_celular          text default null
)
returns table (
  id               uuid,
  curp             text,
  nombres          text,
  apellido_paterno text,
  apellido_materno text,
  celular          text,
  actualizado_en   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id            uuid := auth.uid();
  v_pre_id              uuid;
  v_nombres             text;
  v_apellido_paterno    text;
  v_apellido_materno    text;
  v_set_apellido_materno boolean := false;
  v_celular             text;
  v_set_celular         boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Sesión autenticada requerida para actualizar el pre-registro'
      using errcode = '42501';
  end if;

  select pr.id
    into v_pre_id
  from public.pre_registro pr
  where pr.auth_user_id = v_actor_id
    and pr.activo
  limit 1;

  if v_pre_id is null then
    raise exception 'No existe un pre-registro activo para la cuenta actual'
      using errcode = '23514';
  end if;

  if p_nombres is not null then
    v_nombres := btrim(p_nombres);
    if char_length(v_nombres) not between 1 and 100 then
      raise exception 'El nombre debe tener entre 1 y 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_apellido_paterno is not null then
    v_apellido_paterno := btrim(p_apellido_paterno);
    if char_length(v_apellido_paterno) not between 1 and 100 then
      raise exception 'El apellido paterno debe tener entre 1 y 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_apellido_materno is not null then
    v_set_apellido_materno := true;
    v_apellido_materno := nullif(btrim(p_apellido_materno), '');
    if v_apellido_materno is not null and char_length(v_apellido_materno) > 100 then
      raise exception 'El apellido materno no puede exceder 100 caracteres'
        using errcode = '23514';
    end if;
  end if;

  if p_celular is not null then
    v_set_celular := true;
    v_celular := nullif(btrim(p_celular), '');
    if v_celular is not null and v_celular !~ '^[0-9]{10}$' then
      raise exception 'El celular debe tener exactamente 10 dígitos numéricos'
        using errcode = '23514';
    end if;
  end if;

  return query
  update public.pre_registro pr
     set nombres          = coalesce(v_nombres, pr.nombres),
         apellido_paterno = coalesce(v_apellido_paterno, pr.apellido_paterno),
         apellido_materno = case
                              when v_set_apellido_materno then v_apellido_materno
                              else pr.apellido_materno
                            end,
         celular          = case
                              when v_set_celular then v_celular
                              else pr.celular
                            end
   where pr.id = v_pre_id
     and pr.auth_user_id = v_actor_id
     and pr.activo
  returning pr.id               as id,
            pr.curp             as curp,
            pr.nombres          as nombres,
            pr.apellido_paterno as apellido_paterno,
            pr.apellido_materno as apellido_materno,
            pr.celular          as celular,
            pr.actualizado_en   as actualizado_en;
end;
$$;

revoke execute on function public.actualizar_mi_pre_registro(text, text, text, text) from public, anon;
grant  execute on function public.actualizar_mi_pre_registro(text, text, text, text) to authenticated;
