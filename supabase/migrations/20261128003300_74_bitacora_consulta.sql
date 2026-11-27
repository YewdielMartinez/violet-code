-- =====================================================================
-- 74_bitacora_consulta.sql (Violet Code · RF-22 / RF-22.1)
-- Pantalla «Bitácora» del panel (solo lectura, exclusiva de Dirección).
--
-- Por qué no se reutiliza get_bitacora() (migración 28): esa RPC no filtra
-- por acción, no pagina (sin offset) y no devuelve el total de filas, que
-- la pantalla necesita para paginar y para mostrar «N eventos». Se
-- agregan dos RPCs nuevas sin tocar la anterior (migraciones inmutables):
--
--   1. public.consultar_bitacora(p_tabla, p_accion, p_desde, p_hasta,
--                                p_limite, p_offset)
--        Lista paginada de eventos con el actor (nombre y rol/dependencia)
--        y el total de filas que cumplen los filtros.
--   2. public.get_bitacora_filtros()
--        Valores para los filtros de la pantalla: tablas con eventos y
--        acciones posibles.
--
-- Privacidad: bitacora_acceso solo guarda quién, qué acción, tabla y el
-- id del registro (no hay payload, diff ni texto de notas), así que estas
-- RPCs no exponen contenido clínico ni PII de las usuarias; solo el nombre
-- de quien actuó (personal o UMECA), que es el objeto de la auditoría.
--
-- Permiso: tiene_permiso('bitacora.ver') = es_direccion() (titular y
-- subdirección). La clave ya existe en tiene_permiso() y en
-- permisos_catalogo() (migraciones 07, 71 y 72): no se redefinen.
-- Estas RPCs no registran su propia consulta en la bitácora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. consultar_bitacora
-- ---------------------------------------------------------------------
create or replace function public.consultar_bitacora(
  p_tabla   text        default null,
  p_accion  text        default null,
  p_desde   timestamptz default null,
  p_hasta   timestamptz default null,
  p_limite  integer     default 200,
  p_offset  integer     default 0
)
returns table (
  id             uuid,
  creado_en      timestamptz,
  actor_tipo     text,
  actor_nombre   text,
  actor_rol      text,
  tabla_afectada text,
  accion         public.accion_bitacora,
  registro_id    text,
  total          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tabla  text := nullif(btrim(p_tabla), '');
  v_accion public.accion_bitacora;
  v_total  bigint;
begin
  -- 1. Permiso RBAC centralizado (solo Dirección)
  if not public.tiene_permiso('bitacora.ver') then
    raise exception 'Sin permiso para consultar la bitácora de accesos'
      using errcode = '42501';
  end if;

  -- 2. Validación de parámetros
  if p_limite is null or p_limite < 1 or p_limite > 200 then
    raise exception 'p_limite debe estar entre 1 y 200'
      using errcode = '23514';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception 'p_offset no puede ser negativo'
      using errcode = '23514';
  end if;

  if p_desde is not null and p_hasta is not null and p_desde > p_hasta then
    raise exception 'El rango de fechas es inválido: p_desde no puede ser mayor que p_hasta'
      using errcode = '23514';
  end if;

  if nullif(btrim(p_accion), '') is not null then
    begin
      v_accion := btrim(p_accion)::public.accion_bitacora;
    exception when invalid_text_representation then
      raise exception 'p_accion inválida: %', p_accion
        using errcode = '23514';
    end;
  end if;

  -- 3. Total con los mismos filtros (para paginar)
  select count(*)
  into v_total
  from public.bitacora_acceso b
  where (p_desde is null or b.creado_en >= p_desde)
    and (p_hasta is null or b.creado_en <= p_hasta)
    and (v_tabla is null or b.tabla_afectada = v_tabla)
    and (v_accion is null or b.accion = v_accion);

  -- 4. Página de eventos (más recientes primero)
  return query
  select b.id                                                as id,
         b.creado_en                                         as creado_en,
         case
           when b.empleado_id is not null        then 'empleado'
           when b.usuario_externo_id is not null then 'usuario_externo'
           else 'sistema'
         end                                                 as actor_tipo,
         coalesce(e.nombre, u.nombre, 'Sistema / App')       as actor_nombre,
         coalesce(e.rol::text, u.dependencia)                as actor_rol,
         b.tabla_afectada                                    as tabla_afectada,
         b.accion                                            as accion,
         b.registro_id                                       as registro_id,
         v_total                                             as total
  from public.bitacora_acceso b
  left join public.empleado e        on e.id = b.empleado_id
  left join public.usuario_externo u on u.id = b.usuario_externo_id
  where (p_desde is null or b.creado_en >= p_desde)
    and (p_hasta is null or b.creado_en <= p_hasta)
    and (v_tabla is null or b.tabla_afectada = v_tabla)
    and (v_accion is null or b.accion = v_accion)
  order by b.creado_en desc, b.id desc
  limit p_limite
  offset p_offset;
end;
$$;

revoke execute on function public.consultar_bitacora(text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant  execute on function public.consultar_bitacora(text, text, timestamptz, timestamptz, integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. get_bitacora_filtros: opciones de los filtros «Tabla» y «Acción»
--    tipo = 'tabla'  -> tablas con al menos un evento
--    tipo = 'accion' -> todas las acciones del enum accion_bitacora
-- ---------------------------------------------------------------------
create or replace function public.get_bitacora_filtros()
returns table (
  tipo  text,
  valor text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('bitacora.ver') then
    raise exception 'Sin permiso para consultar la bitácora de accesos'
      using errcode = '42501';
  end if;

  return query
  select 'tabla'::text as tipo, t.tabla_afectada::text as valor
  from (
    select distinct b.tabla_afectada
    from public.bitacora_acceso b
  ) t
  union all
  select 'accion'::text, a::text
  from unnest(enum_range(null::public.accion_bitacora)) as a
  order by 1, 2;
end;
$$;

revoke execute on function public.get_bitacora_filtros() from public, anon;
grant  execute on function public.get_bitacora_filtros() to authenticated;
