-- =====================================================================
-- 52_urgencias_por_expediente.sql (Tarjeta #121)
-- 1. Actualiza public.vista_lista_urgencias para leer ficha_registro.prioridad = 'alta'
--    en lugar de la última atención, manteniendo 'sin cita próxima' y
--    exponiendo prioridad_actualizada_en.
-- 2. Actualiza public.get_lista_urgencias(p_area_id) para usar la prioridad
--    del expediente y devolver prioridad_actualizada_en (quitando
--    area_ultima_prioridad / fecha_ultima_prioridad).
-- =====================================================================

-- 1) Vista vista_lista_urgencias basada en ficha_registro.prioridad
drop view if exists public.vista_lista_urgencias;

create view public.vista_lista_urgencias
with (security_invoker = true) as
select f.id                       as ficha_id,
       f.folio,
       p.id                       as persona_id,
       p.nombres,
       p.apellido_paterno,
       p.apellido_materno,
       p.celular,
       f.prioridad_actualizada_en as prioridad_actualizada_en
from public.ficha_registro f
join public.persona p on p.id = f.persona_id
where f.activo
  and p.activo
  and f.estado in ('abierto', 'en_seguimiento')
  and f.prioridad = 'alta'
  and not exists (
    select 1
    from public.cita c
    where c.persona_id = f.persona_id
      and c.activo
      and c.estado in ('agendada', 'confirmada')
      and c.programada_en > now()
  )
order by coalesce(f.prioridad_actualizada_en, f.creado_en) asc;

revoke all on public.vista_lista_urgencias from public, anon;
grant select on public.vista_lista_urgencias to authenticated;

-- 2) RPC get_lista_urgencias(p_area_id)
drop function if exists public.get_lista_urgencias(smallint);

create or replace function public.get_lista_urgencias(
  p_area_id smallint default null
)
returns table (
  persona_id               uuid,
  ficha_id                 uuid,
  folio                    text,
  nombre_completo          text,
  celular                  text,
  prioridad_actualizada_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('urgencias.ver') then
    raise exception 'Sin permiso para consultar la lista de urgencias' using errcode = '42501';
  end if;

  return query
  select
    p.id as persona_id,
    f.id as ficha_id,
    f.folio,
    concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
    p.celular,
    f.prioridad_actualizada_en
  from public.ficha_registro f
  join public.persona p on p.id = f.persona_id
  where f.activo
    and p.activo
    and f.estado in ('abierto', 'en_seguimiento')
    and f.prioridad = 'alta'
    and (
      p_area_id is null
      or exists (
        select 1
        from public.ficha_servicio_solicitado fss
        where fss.ficha_id = f.id
          and fss.area_id = p_area_id
      )
      or exists (
        select 1
        from public.atencion a
        where a.ficha_id = f.id
          and a.activo
          and a.area_id = p_area_id
      )
    )
    and not exists (
      select 1
      from public.cita c
      where c.persona_id = f.persona_id
        and c.activo
        and c.estado in ('agendada', 'confirmada')
        and c.programada_en > now()
    )
  order by coalesce(f.prioridad_actualizada_en, f.creado_en) asc, f.creado_en asc;
end;
$$;

revoke execute on function public.get_lista_urgencias(smallint) from public, anon;
grant  execute on function public.get_lista_urgencias(smallint) to authenticated;
