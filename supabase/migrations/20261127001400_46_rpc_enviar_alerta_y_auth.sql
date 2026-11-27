-- =====================================================================
-- 46_rpc_enviar_alerta_y_auth.sql (Tarjeta #94)
-- 1. Cierra INSERT directo en public.alerta para usuarias de la app;
--    solo el personal con tiene_permiso('alerta.atender') inserta directo.
-- 2. Crea RPC enviar_alerta(p_asentamiento_id) exclusivo para
--    es_usuaria_app(), tomando el pre_registro activo de la sesión y
--    aplicando límite de 3 alertas por hora (SQLSTATE 23514).
-- =====================================================================

-- 1) Cerrar INSERT directo de usuaria_app en public.alerta
drop policy if exists alerta_insert on public.alerta;
create policy alerta_insert on public.alerta
  for insert to authenticated
  with check ((select public.tiene_permiso('alerta.atender')));

-- 2) RPC enviar_alerta(p_asentamiento_id)
create or replace function public.enviar_alerta(
  p_asentamiento_id integer default null
)
returns table (
  alerta_id uuid,
  estado    public.estado_alerta,
  creado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pre_id       uuid;
  v_alertas_hora integer;
  v_alerta_id    uuid;
  v_estado       public.estado_alerta;
  v_creado_en    timestamptz;
begin
  if not public.es_usuaria_app() then
    raise exception 'Solo las usuarias de la app móvil pueden enviar alertas por este medio'
      using errcode = '42501';
  end if;

  v_pre_id := public.mi_pre_registro_id();
  if v_pre_id is null then
    raise exception 'Debes registrar tu perfil antes de enviar una alerta'
      using errcode = '23514';
  end if;

  if p_asentamiento_id is not null and not exists (
    select 1
    from public.cat_asentamiento ca
    where ca.id = p_asentamiento_id
  ) then
    raise exception 'El asentamiento indicado no existe'
      using errcode = '23514';
  end if;

  -- Serializar envíos concurrentes de la misma usuaria para validar el límite por hora
  perform 1
  from public.pre_registro pr
  where pr.id = v_pre_id
  for update;

  select count(*)::integer
  into v_alertas_hora
  from public.alerta a
  where a.pre_registro_id = v_pre_id
    and a.origen = 'app_movil'
    and a.activo
    and a.creado_en >= now() - interval '1 hour';

  if v_alertas_hora >= 3 then
    raise exception 'Alcanzaste el límite de 3 alertas por hora'
      using errcode = '23514';
  end if;

  insert into public.alerta (
    pre_registro_id,
    origen,
    asentamiento_id
  ) values (
    v_pre_id,
    'app_movil',
    p_asentamiento_id
  )
  returning alerta.id, alerta.estado, alerta.creado_en
  into v_alerta_id, v_estado, v_creado_en;

  return query select v_alerta_id, v_estado, v_creado_en;
end;
$$;

revoke all on function public.enviar_alerta(integer) from public, anon;
grant  execute on function public.enviar_alerta(integer) to authenticated;
