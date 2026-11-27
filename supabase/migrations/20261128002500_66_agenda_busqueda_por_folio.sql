-- =====================================================================
-- 66_agenda_busqueda_por_folio.sql
-- buscar_personas_agenda(): además de nombre y prefijo de CURP, localiza a la
-- persona por el folio de su expediente (completo, p. ej. SEM-2026-0009, o una
-- parte, p. ej. 0009). Misma firma, permisos y columnas que en la migración 42.
-- =====================================================================

create or replace function public.buscar_personas_agenda(
  p_q      text,
  p_limite int default 10
)
returns table (
  persona_id       uuid,
  ficha_id         uuid,
  folio            text,
  nombre_completo  text,
  curp_enmascarada text,
  celular          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q      text := btrim(coalesce(p_q, ''));
  v_limite int  := least(greatest(coalesce(p_limite, 10), 1), 25);
  v_norm   text;
  v_upper  text;
  v_prefix text;
  v_folio  text;
  v_tokens text[];
begin
  if not public.tiene_permiso('agenda.crear') then
    raise exception 'Sin permiso para buscar personas en la agenda' using errcode = '42501';
  end if;

  if char_length(v_q) < 3 then
    return;
  end if;

  v_norm   := extensions.unaccent(lower(v_q));
  v_upper  := upper(regexp_replace(v_q, '\s+', '', 'g'));
  -- Comodines de LIKE escapados (\, %, _) en prefijo y en cada término
  -- Folio (p. ej. SEM-2026-0009 o solo «0009»): sin espacios ni guiones, mayúsculas y comodines escapados
  v_folio  := '%' || replace(replace(replace(replace(v_upper, '-', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_prefix := replace(replace(replace(v_norm, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_tokens := array(
    select '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    from unnest(regexp_split_to_array(v_norm, '\s+')) as t
    where t <> ''
  );

  return query
  select x.persona_id, x.ficha_id, x.folio, x.nombre_completo, x.curp_enmascarada, x.celular
  from (
    select
      p.id as persona_id,
      f.id as ficha_id,
      f.folio,
      concat_ws(' ', p.nombres, p.apellido_paterno, nullif(btrim(coalesce(p.apellido_materno, '')), '')) as nombre_completo,
      case
        when p.curp is null then null
        else left(p.curp, 4) || '******' || right(p.curp, 2)
      end as curp_enmascarada,
      p.celular,
      case
        when p.curp like replace(replace(replace(v_upper, '\', '\\'), '%', '\%'), '_', '\_') || '%' then 0
        when replace(upper(f.folio), '-', '') like v_folio then 0
        when extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno))) like v_prefix then 1
        else 2
      end as rango
    from public.persona p
    join lateral (
      select f2.id, f2.folio
      from public.ficha_registro f2
      where f2.persona_id = p.id
        and f2.activo
        and f2.estado <> 'archivado'
      order by f2.registrada_en desc
      limit 1
    ) f on true
    where p.activo
      and (
        p.curp like replace(replace(replace(v_upper, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or replace(upper(f.folio), '-', '') like v_folio
        or extensions.unaccent(lower(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)))
           like all (v_tokens)
      )
  ) x
  order by x.rango, lower(x.nombre_completo), x.folio
  limit v_limite;
end;
$$;
