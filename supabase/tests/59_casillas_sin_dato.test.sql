create extension if not exists pgtap with schema extensions;

begin;
select plan(11);

-- =====================================================================
-- Pruebas A-16 · Sprint 02 (59_casillas_sin_dato.sql)
--   1. crear_ficha_completa omitiendo casillas e hijos los guarda como NULL
--      ("sin dato"), mientras que false / 0 explícitos se conservan.
--   2. actualizar_ficha con p_campos_sin_dato regresa a NULL los campos
--      permitidos (incluyendo auto-limpieza de _otro / especificacion_droga)
--      y conserva los no listados.
--   3. p_campos_sin_dato con nombre inválido, vacío o protegido lanza 23514.
-- =====================================================================

create or replace function pg_temp.set_actor(p_uid uuid)
returns void
language plpgsql
as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '{}', true);
  else
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid::text)::text, true);
  end if;
end;
$$;
grant execute on function pg_temp.set_actor(uuid) to public;

create temp table pg_temp.res_crear_null (ficha_id uuid, folio text, persona_id uuid) on commit drop;
create temp table pg_temp.res_crear_false (ficha_id uuid, folio text, persona_id uuid) on commit drop;
grant all on pg_temp.res_crear_null to authenticated;
grant all on pg_temp.res_crear_false to authenticated;

set local role authenticated;
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103'::uuid); -- trabajo_social

-- 1-2) crear_ficha_completa sin casillas ni hijos -> NULL; con false / 0 -> false / 0
insert into pg_temp.res_crear_null
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'SIND940115MSLGRN01',
      'nombres', 'Sofia',
      'apellidoPaterno', 'Nieto',
      'avisoPrivacidadAceptado', true
    ),
    'domicilio', jsonb_build_object(),
    'estudio', jsonb_build_object()
  )
);

select ok(
  (
    select tiene_trabajo is null
       and tiene_embarazo is null
       and tiene_denuncia is null
       and es_victima_delito is null
       and numero_hijas is null
       and numero_hijos_hombres is null
    from public.ficha_registro
    where id = (select ficha_id from pg_temp.res_crear_null)
  ),
  'crear_ficha_completa sin casillas ni hijos guarda todos como NULL'
);

insert into pg_temp.res_crear_false
select *
from public.crear_ficha_completa(
  jsonb_build_object(
    'identidad', jsonb_build_object(
      'curp', 'NOCA940220MSLGRN02',
      'nombres', 'Nora',
      'apellidoPaterno', 'Castillo',
      'avisoPrivacidadAceptado', true,
      'estadoCivil', 'casado',
      'ocupacionId', (select id from public.cat_ocupacion limit 1),
      'tieneTrabajo', false,
      'numeroHijas', 0,
      'numeroHijosHombres', 0,
      'servicioMedico', 'otro',
      'servicioMedicoOtro', 'Privado',
      'tieneEmbarazo', false,
      'tieneDenuncia', false,
      'esVictimaDelito', false,
      'drogas', jsonb_build_array('marihuana'),
      'especificacionDroga', 'Ocasional',
      'consumoAlcohol', 'ocasional'
    ),
    'domicilio', jsonb_build_object(),
    'estudio', jsonb_build_object()
  )
);

select ok(
  (
    select tiene_trabajo = false
       and tiene_embarazo = false
       and tiene_denuncia = false
       and es_victima_delito = false
       and numero_hijas = 0
       and numero_hijos_hombres = 0
    from public.ficha_registro
    where id = (select ficha_id from pg_temp.res_crear_false)
  ),
  'crear_ficha_completa conserva false y 0 explicitos sin confundirlos con NULL'
);

-- 3) get_expediente_detalle refleja null en casillas/hijos sin dato
select ok(
  (
    select (d -> 'ficha' -> 'tiene_trabajo') = 'null'::jsonb
       and (d -> 'ficha' -> 'numero_hijas') = 'null'::jsonb
       and (d -> 'ficha' -> 'es_victima_delito') = 'null'::jsonb
    from (select public.get_expediente_detalle((select ficha_id from pg_temp.res_crear_null), false) as d) s
  ),
  'get_expediente_detalle devuelve null JSON cuando casillas e hijos estan sin dato'
);

-- 4-6) Validaciones de p_campos_sin_dato (23514)
select throws_ok(
  $$select * from public.actualizar_ficha(
    (select ficha_id from pg_temp.res_crear_false),
    (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    array['campo_inexistente']
  )$$,
  '23514', null, 'actualizar_ficha rechaza nombre de campo invalido en p_campos_sin_dato'
);

select throws_ok(
  $$select * from public.actualizar_ficha(
    (select ficha_id from pg_temp.res_crear_false),
    (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    array['folio']
  )$$,
  '23514', null, 'actualizar_ficha rechaza campo protegido (folio) en p_campos_sin_dato'
);

select throws_ok(
  $$select * from public.actualizar_ficha(
    (select ficha_id from pg_temp.res_crear_false),
    (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    array['']
  )$$,
  '23514', null, 'actualizar_ficha rechaza cadena vacia en p_campos_sin_dato'
);

-- 7-8) p_campos_sin_dato limpia casillas e hijos seleccionados y conserva el resto
select ok(
  (
    select tiene_trabajo is null
       and tiene_embarazo is null
       and tiene_denuncia is null
       and es_victima_delito is null
       and numero_hijas is null
       and numero_hijos_hombres is null
       and estado_civil = 'casado'::public.estado_civil
    from public.actualizar_ficha(
      (select ficha_id from pg_temp.res_crear_false),
      (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      array['tiene_trabajo', 'tiene_embarazo', 'tiene_denuncia', 'es_victima_delito', 'numero_hijas', 'numero_hijos_hombres']
    )
  ),
  'actualizar_ficha con p_campos_sin_dato limpia casillas e hijos a NULL y conserva estado_civil'
);

select ok(
  (
    select estado_civil is null
       and ocupacion_id is null
       and servicio_medico is null
       and servicio_medico_otro is null
       and drogas is null
       and especificacion_droga is null
       and consumo_alcohol is null
    from public.actualizar_ficha(
      (select ficha_id from pg_temp.res_crear_false),
      (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      array['estado_civil', 'ocupacion_id', 'servicio_medico', 'drogas', 'consumo_alcohol']
    )
  ),
  'actualizar_ficha con p_campos_sin_dato limpia selectores/consumo y sus especificaciones ligadas'
);

-- 9-11) '{}' no limpia nada; limpiar servicio_medico + pasar servicio_medico_otro da 23514; p_campos_sin_dato supera incluso al parámetro en el mismo call
select is(
  (
    select estado_civil
    from public.actualizar_ficha(
      (select ficha_id from pg_temp.res_crear_false),
      (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
      'soltero'::public.estado_civil, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      '{}'::text[]
    )
  ),
  'soltero'::public.estado_civil,
  'actualizar_ficha con p_campos_sin_dato vacio {} conserva cambios normales'
);

select throws_ok(
  $$select * from public.actualizar_ficha(
    (select ficha_id from pg_temp.res_crear_false),
    (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
    null, null, null, null, null, null, null, 'Otro', null, null, null, null, null, null, null,
    array['servicio_medico']
  )$$,
  '23514', null, 'actualizar_ficha rechaza servicio_medico_otro si servicio_medico se limpia con p_campos_sin_dato'
);

select is(
  (
    select estado_civil
    from public.actualizar_ficha(
      (select ficha_id from pg_temp.res_crear_false),
      (select actualizado_en from public.ficha_registro where id = (select ficha_id from pg_temp.res_crear_false)),
      'casado'::public.estado_civil, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      array['ESTADO_CIVIL']
    )
  ),
  null,
  'p_campos_sin_dato acepta mayusculas normalizadas y prioriza limpiar el campo'
);

select * from finish();
rollback;
