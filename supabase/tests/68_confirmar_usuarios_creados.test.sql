create extension if not exists pgtap with schema extensions;

-- =====================================================================
-- 68 · crear_cuenta_acceso: las cuentas creadas por Dirección nacen confirmadas
-- =====================================================================

begin;

select plan(14);

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

-- Titular (seed) = 111...101; Recepción (seed) = 111...106
select pg_temp.set_actor('11111111-1111-4111-8111-111111111106');
select throws_ok(
  $$select public.crear_cuenta_acceso('nueva.recep@demo.violetcode.local', 'Temporal2026', 'Nueva Recepción', 'recepcion')$$,
  '42501', null, 'recepción no puede crear cuentas'
);

select pg_temp.set_actor(null);
select throws_ok(
  $$select public.crear_cuenta_acceso('nueva.recep@demo.violetcode.local', 'Temporal2026', 'Nueva Recepción', 'recepcion')$$,
  '42501', null, 'sin sesión no puede crear cuentas'
);

select pg_temp.set_actor('11111111-1111-4111-8111-111111111101');

create temp table pg_temp.cuentas_68 (caso text primary key, id uuid) on commit drop;
grant select, insert on pg_temp.cuentas_68 to authenticated;

insert into pg_temp.cuentas_68
select 'ts', public.crear_cuenta_acceso('  Nueva.TS@Demo.Violetcode.Local ', 'Temporal2026', ' Nueva Trabajo Social ', 'trabajo_social');
insert into pg_temp.cuentas_68
select 'umeca', public.crear_cuenta_acceso('nueva.umeca@demo.violetcode.local', 'Temporal2026', 'Nueva UMECA', 'umeca');

select is(
  (select email_confirmed_at is not null from auth.users where email = 'nueva.ts@demo.violetcode.local'),
  true, 'la cuenta de personal nace con email_confirmed_at'
);
select is(
  (select email_confirmed_at is not null from auth.users u join pg_temp.cuentas_68 c on c.id = u.id where c.caso = 'umeca'),
  true, 'la cuenta UMECA nace con email_confirmed_at'
);
select is(
  (select encrypted_password = extensions.crypt('Temporal2026', encrypted_password)
     from auth.users where email = 'nueva.ts@demo.violetcode.local'),
  true, 'la contraseña queda hasheada y verificable'
);
select is(
  (select count(*)::int from auth.identities i join pg_temp.cuentas_68 c on c.id = i.user_id
    where i.provider = 'email'),
  2, 'se crean las identidades de email'
);
select is(
  (select e.rol::text || '/' || a.clave || '/' || e.nombre || '/' || (e.creado_por = '11111111-1111-4111-8111-111111111101')::text
     from public.empleado e join public.cat_area a on a.id = e.area_id
     join pg_temp.cuentas_68 c on c.id = e.id where c.caso = 'ts'),
  'trabajo_social/trabajo_social/Nueva Trabajo Social/true',
  'el perfil empleado lleva rol, área, nombre recortado y creado_por'
);
select is(
  (select x.dependencia from public.usuario_externo x join pg_temp.cuentas_68 c on c.id = x.id where c.caso = 'umeca'),
  'umeca', 'la cuenta UMECA se registra en usuario_externo'
);

select throws_ok(
  $$select public.crear_cuenta_acceso('NUEVA.ts@demo.violetcode.local', 'Temporal2026', 'Dup', 'recepcion')$$,
  '23505', null, 'correo duplicado (sin distinguir mayúsculas)'
);
select throws_ok(
  $$select public.crear_cuenta_acceso('corta@demo.violetcode.local', 'abc12', 'X', 'recepcion')$$,
  '23514', null, 'contraseña menor a 8 caracteres'
);
select throws_ok(
  $$select public.crear_cuenta_acceso('sololetras@demo.violetcode.local', 'SoloLetrasXX', 'X', 'recepcion')$$,
  '23514', null, 'contraseña sin números'
);
select throws_ok(
  $$select public.crear_cuenta_acceso('rolmalo@demo.violetcode.local', 'Temporal2026', 'X', 'superadmin')$$,
  '23514', null, 'rol inválido'
);
select throws_ok(
  $$select public.crear_cuenta_acceso('no-es-correo', 'Temporal2026', 'X', 'recepcion')$$,
  '23514', null, 'correo inválido'
);

-- Las cuentas de personal sin confirmar (bug previo) quedan confirmadas por la migración:
-- tras la migración no debe existir personal con correo sin confirmar.
select is(
  (select count(*)::int from auth.users u
    where u.email_confirmed_at is null
      and (exists (select 1 from public.empleado e where e.id = u.id)
           or exists (select 1 from public.usuario_externo x where x.id = u.id))),
  0, 'no quedan cuentas de personal sin confirmar'
);

select * from finish();
rollback;
