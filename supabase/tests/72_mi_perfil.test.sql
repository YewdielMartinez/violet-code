create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 72_mi_perfil.test.sql
-- Verifica la migración 20261128003100_72_mi_perfil.sql:
--   - permisos_catalogo() coincide con las claves de tiene_permiso().
--   - get_mi_perfil() / actualizar_mi_perfil(): solo `authenticated`, con
--     sesión y con perfil (empleado, UMECA); la usuaria móvil y la sesión
--     anónima reciben 42501.
--   - get_mi_perfil() devuelve nombre, correo, rol, área/dependencia,
--     estado y los permisos efectivos de quien llama.
--   - actualizar_mi_perfil() edita solo nombre y teléfono (valida,
--     normaliza, no toca rol/área/activo), registra la bitácora y
--     rechaza cuentas inactivas.
-- =====================================================================

begin;

select plan(48);

-- Empleada inactiva temporal para validar que no puede editar su perfil.
do $$
declare
  v_uid uuid := '72000000-0000-4000-a000-000000000001';
begin
  insert into auth.users (id, email)
  values (v_uid, 'test72.inactiva@semujeres.local')
  on conflict (id) do nothing;

  insert into public.empleado (id, nombre, rol, area_id, activo)
  values (v_uid, 'Inactiva Test 72', 'recepcion', null, false)
  on conflict (id) do nothing;

  update auth.users u
  set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{tipo}', '"empleado"'::jsonb, true)
  where u.id = v_uid;
end;
$$;

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
grant execute on function pg_temp.set_actor(uuid) to public;

-- 1) El catálogo coincide con las claves del código vigente de tiene_permiso()
select is(
  (
    select array_agg(m[1] order by m[1])
    from regexp_matches(
      pg_get_functiondef('public.tiene_permiso(text)'::regprocedure),
      'when ''([a-z_]+\.[a-z_]+)''',
      'g'
    ) as m
  ),
  (select array_agg(k order by k) from unnest(public.permisos_catalogo()) as k),
  'permisos_catalogo() contiene exactamente las claves de tiene_permiso()'
);

-- 2) Privilegios de ejecución
select is(has_function_privilege('anon', 'public.get_mi_perfil()', 'execute'), false,
  'anon no puede ejecutar get_mi_perfil');
select is(has_function_privilege('authenticated', 'public.get_mi_perfil()', 'execute'), true,
  'authenticated puede ejecutar get_mi_perfil');
select is(has_function_privilege('anon', 'public.actualizar_mi_perfil(text, text)', 'execute'), false,
  'anon no puede ejecutar actualizar_mi_perfil');
select is(has_function_privilege('authenticated', 'public.actualizar_mi_perfil(text, text)', 'execute'), true,
  'authenticated puede ejecutar actualizar_mi_perfil');
select is(has_function_privilege('anon', 'public.permisos_catalogo()', 'execute'), false,
  'anon no puede ejecutar permisos_catalogo');

set local role authenticated;

-- 3) Sin sesión y usuaria móvil: 42501
select pg_temp.set_actor(null);
select throws_ok($$select * from public.get_mi_perfil()$$, '42501', null,
  'sin sesión: get_mi_perfil falla');
select throws_ok($$select * from public.actualizar_mi_perfil('Alguien', null)$$, '42501', null,
  'sin sesión: actualizar_mi_perfil falla');

select pg_temp.set_actor('22222222-2222-4222-8222-222222222201'); -- usuaria app
select throws_ok($$select * from public.get_mi_perfil()$$, '42501', null,
  'usuaria móvil: get_mi_perfil falla');
select throws_ok($$select * from public.actualizar_mi_perfil('Alguien', null)$$, '42501', null,
  'usuaria móvil: actualizar_mi_perfil falla');

-- 4) Titular
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101');
select is((select count(*)::int from public.get_mi_perfil()), 1, 'titular: una sola fila');
select is((select tipo from public.get_mi_perfil()), 'empleado', 'titular: tipo empleado');
select is((select nombre from public.get_mi_perfil()), 'María Elena Titular', 'titular: nombre');
select is((select correo from public.get_mi_perfil()), 'titular@demo.violetcode.local', 'titular: correo');
select is((select rol from public.get_mi_perfil()), 'titular', 'titular: rol');
select is((select activo from public.get_mi_perfil()), true, 'titular: activo');
select is((select area_clave from public.get_mi_perfil()), null, 'titular: sin área');
select is((select telefono from public.get_mi_perfil()), null, 'titular: sin teléfono al inicio');
select ok((select 'cuentas.gestionar' = any (permisos) from public.get_mi_perfil()),
  'titular: tiene cuentas.gestionar');
select ok((select not ('historial_clinico.escribir' = any (permisos)) from public.get_mi_perfil()),
  'titular: no tiene historial_clinico.escribir (solo Psicología)');
select is(
  (select permisos from public.get_mi_perfil()),
  (select coalesce(array_agg(k order by k), '{}'::text[])
     from unnest(public.permisos_catalogo()) as k where public.tiene_permiso(k)),
  'titular: permisos = claves del catálogo con tiene_permiso true'
);

-- 5) Trabajo Social (con área)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111103');
select is((select rol from public.get_mi_perfil()), 'trabajo_social', 'TS: rol');
select is((select area_clave from public.get_mi_perfil()), 'trabajo_social', 'TS: área');
select ok((select 'expediente.escribir' = any (permisos) from public.get_mi_perfil()),
  'TS: tiene expediente.escribir');
select ok((select not ('cuentas.gestionar' = any (permisos)) from public.get_mi_perfil()),
  'TS: no tiene cuentas.gestionar');

-- 5b) Psicología: claves exclusivas del área
select pg_temp.set_actor('11111111-1111-4111-8111-111111111104');
select ok(
  (select 'nota_psicologia.acceder' = any (permisos) and 'historial_clinico.escribir' = any (permisos)
     from public.get_mi_perfil()),
  'psicología: tiene nota_psicologia.acceder e historial_clinico.escribir'
);
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101');
select ok((select not ('nota_psicologia.acceder' = any (permisos)) from public.get_mi_perfil()),
  'titular: no tiene nota_psicologia.acceder (solo Psicología)');

-- 6) Recepción
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106');
select ok((select 'agenda.crear' = any (permisos) from public.get_mi_perfil()),
  'recepción: tiene agenda.crear');
select ok((select not ('expediente.ver' = any (permisos)) from public.get_mi_perfil()),
  'recepción: no tiene expediente.ver');

-- 7) UMECA (usuario externo)
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107');
select is((select tipo from public.get_mi_perfil()), 'externo', 'UMECA: tipo externo');
select is((select rol from public.get_mi_perfil()), 'umeca', 'UMECA: rol');
select is((select dependencia from public.get_mi_perfil()), 'umeca', 'UMECA: dependencia');
select is((select area_clave from public.get_mi_perfil()), null, 'UMECA: sin área');
select is((select permisos from public.get_mi_perfil()), '{}'::text[], 'UMECA: sin permisos RBAC');

-- 8) Edición: titular
select pg_temp.set_actor('11111111-1111-4111-8111-111111111101');
select is(
  (select nombre || '|' || telefono from public.actualizar_mi_perfil('  Elena Titular  ', '(667) 123-4567')),
  'Elena Titular|6671234567',
  'actualizar_mi_perfil recorta el nombre y normaliza el teléfono'
);
select is((select nombre from public.get_mi_perfil()), 'Elena Titular', 'get_mi_perfil refleja el nombre nuevo');
select is((select telefono from public.get_mi_perfil()), '6671234567', 'get_mi_perfil refleja el teléfono nuevo');
select is((select rol from public.get_mi_perfil()), 'titular', 'el rol no cambia al editar el perfil');
select is(
  (select telefono from public.actualizar_mi_perfil('Elena Titular', null)),
  null,
  'un teléfono vacío o nulo lo borra'
);

-- 9) Validaciones
select throws_ok($$select * from public.actualizar_mi_perfil('   ', null)$$, '23514', null,
  'nombre vacío: 23514');
select throws_ok($$select * from public.actualizar_mi_perfil(repeat('a', 121), null)$$, '23514', null,
  'nombre de más de 120 caracteres: 23514');
select throws_ok($$select * from public.actualizar_mi_perfil('Elena Titular', '12345')$$, '23514', null,
  'teléfono que no es de 10 dígitos: 23514');
select throws_ok($$select * from public.actualizar_mi_perfil('Elena Titular', 'abcdefghij')$$, '23514', null,
  'teléfono con letras: 23514');

-- 10) UMECA edita su propio perfil
select pg_temp.set_actor('11111111-1111-4111-8111-111111111107');
select is(
  (select nombre from public.actualizar_mi_perfil('Enlace UMECA Editado', '6681112233')),
  'Enlace UMECA Editado',
  'UMECA puede editar su nombre'
);
select is((select telefono from public.get_mi_perfil()), '6681112233', 'UMECA: teléfono guardado');
select is((select rol from public.get_mi_perfil()), 'umeca', 'UMECA: el rol no cambia');

-- 11) Cuenta inactiva: puede leerse, no editarse
select pg_temp.set_actor('72000000-0000-4000-a000-000000000001');
select throws_ok($$select * from public.actualizar_mi_perfil('Inactiva', null)$$, '42501', null,
  'empleada inactiva: actualizar_mi_perfil falla');

-- 12) Bitácora: el UPDATE de empleado quedó registrado como 'actualizar'
reset role;
select ok(
  (
    select count(*) >= 1
    from public.bitacora_acceso b
    where b.tabla_afectada = 'empleado'
      and b.registro_id = '11111111-1111-4111-8111-111111111101'
      and b.accion = 'actualizar'
      and b.empleado_id = '11111111-1111-4111-8111-111111111101'
  ),
  'actualizar_mi_perfil queda en bitacora_acceso (trigger registrar_cambio)'
);

select * from finish();
rollback;
