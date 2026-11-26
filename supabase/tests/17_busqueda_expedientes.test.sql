-- =====================================================================
-- 17_busqueda_expedientes.test.sql (A-02 · Sprint 01)
-- Verifica:
--   1. Los 4 resultados de verificar_curp() + salida reducida de Recepción
--      + registro en bitacora_acceso + errores 42501 y 23514.
--   2. buscar_expedientes() por CURP, folio y nombre con/sin acentos +
--      filtro de archivados + errores 42501 (Recepción) y 23514 (<3 chars).
--   3. buscar_pre_registro_por_curp() rechaza a Recepción con 42501.
-- =====================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(18);

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

-- 1) verificar_curp sin sesión -> 42501 y CURP inválida -> 23514
select pg_temp.set_actor(null);
select throws_ok(
  $$select * from public.verificar_curp('AAML920410MSLNRR01')$$,
  '42501',
  'Sin permiso para verificar CURP',
  'verificar_curp sin sesion lanza 42501'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social
select throws_ok(
  $$select * from public.verificar_curp('CURP_INVALIDA')$$,
  '23514',
  'La CURP no tiene un formato válido',
  'verificar_curp con formato invalido lanza 23514'
);

-- 2) verificar_curp -> los 4 resultados para Trabajo Social
select is(
  (select resultado from public.verificar_curp('AAML920410MSLNRR01')),
  'expediente_existente',
  'verificar_curp devuelve expediente_existente para persona con ficha'
);

select is(
  (
    select count(*)::int
    from public.bitacora_acceso b
    where b.empleado_id = '11111111-1111-4111-8111-111111111103'::uuid
      and b.accion = 'ver'
      and b.tabla_afectada = 'persona'
      and b.registro_id = '33333333-3333-4333-8333-333333333311'
  ),
  1,
  'verificar_curp registra ver en bitacora_acceso al encontrar persona'
);

select is(
  (select resultado from public.verificar_curp('RACS930615MSLRRN02')),
  'persona_sin_ficha',
  'verificar_curp devuelve persona_sin_ficha cuando no tiene ficha'
);

select is(
  (select resultado from public.verificar_curp('TOVE960820MSLVRN03')),
  'pre_registro_movil',
  'verificar_curp devuelve pre_registro_movil para Trabajo Social'
);

select is(
  (select resultado from public.verificar_curp('XAXX010101MSLXXX09')),
  'nuevo',
  'verificar_curp devuelve nuevo cuando no existe registro'
);

-- 3) verificar_curp para Recepción: salida reducida y nunca pre_registro_movil
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select is(
  (
    select (resultado = 'expediente_existente'
            and ficha_id is null
            and estado is null
            and folio = 'SEM-2026-9091'
            and nombre_completo like 'Lucía%')
    from public.verificar_curp('AAML920410MSLNRR01')
  ),
  true,
  'verificar_curp devuelve salida reducida para recepcion'
);

select is(
  (select resultado from public.verificar_curp('TOVE960820MSLVRN03')),
  'nuevo',
  'verificar_curp oculta pre_registro_movil a recepcion (devuelve nuevo)'
);

-- 4) buscar_expedientes: permisos y validaciones
select throws_ok(
  $$select * from public.buscar_expedientes('Lucía')$$,
  '42501',
  'Sin permiso para buscar expedientes',
  'buscar_expedientes rechaza a recepcion con 42501'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111104'::uuid); -- psicologia
select throws_ok(
  $$select * from public.buscar_expedientes('ab')$$,
  '23514',
  'Ingresa al menos 3 caracteres para buscar',
  'buscar_expedientes rechaza menos de 3 caracteres con 23514'
);

-- 5) buscar_expedientes por CURP, folio y nombre con acentos
select is(
  (select coincidencia from public.buscar_expedientes('AAML920410MSLNRR01') limit 1),
  'curp',
  'buscar_expedientes detecta coincidencia por CURP'
);

select is(
  (select coincidencia from public.buscar_expedientes('SEM-2026-9091') limit 1),
  'folio',
  'buscar_expedientes detecta coincidencia por folio'
);

select is(
  (
    select count(*)::int
    from public.buscar_expedientes('alvarez') b
    where b.ficha_id = '55555555-5555-4555-8555-555555555511'::uuid
      and b.coincidencia = 'nombre'
  ),
  1,
  'buscar_expedientes encuentra nombres con acentos buscando sin acentos (alvarez -> Álvarez)'
);

select is(
  (
    select count(*)::int
    from public.buscar_expedientes('Lucía') b
    where b.ficha_id = '55555555-5555-4555-8555-555555555511'::uuid
  ),
  1,
  'buscar_expedientes encuentra nombres buscando con acentos (Lucía)'
);

-- 6) Excluye archivados por defecto e incluye si p_incluir_archivados = true
update public.ficha_registro
set estado = 'archivado'
where id = '55555555-5555-4555-8555-555555555511'::uuid;

select is(
  (
    select count(*)::int
    from public.buscar_expedientes('SEM-2026-9091', 20, false)
  ),
  0,
  'buscar_expedientes excluye archivados cuando p_incluir_archivados = false'
);

select is(
  (
    select count(*)::int
    from public.buscar_expedientes('SEM-2026-9091', 20, true)
  ),
  1,
  'buscar_expedientes incluye archivados cuando p_incluir_archivados = true'
);

-- 7) buscar_pre_registro_por_curp usa tiene_permiso('expediente.escribir')
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106'::uuid); -- recepcion
select throws_ok(
  $$select * from public.buscar_pre_registro_por_curp('TOVE960820MSLVRN03')$$,
  '42501',
  'Sin permiso para consultar pre-registros por CURP',
  'buscar_pre_registro_por_curp rechaza a recepcion con 42501'
);

select * from finish();
rollback;
