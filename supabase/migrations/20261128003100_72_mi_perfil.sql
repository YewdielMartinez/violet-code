-- =====================================================================
-- 72 · Mi perfil (pantalla «Mi perfil» del panel web)
--
-- La persona que inició sesión (personal de SEMUJERES o UMECA) puede ver
-- su perfil y editar solo los datos de contacto que le pertenecen:
--
--   1. Columna `telefono` (opcional, 10 dígitos) en `empleado` y
--      `usuario_externo`.
--   2. `public.permisos_catalogo()`: lista de claves de `tiene_permiso()`.
--   3. `public.get_mi_perfil()`: perfil de quien llama (nombre, correo,
--      teléfono, rol, área/dependencia, estado y permisos efectivos).
--   4. `public.actualizar_mi_perfil(p_nombre, p_telefono)`: edita SOLO
--      nombre y teléfono. Nunca rol, área, activo ni correo.
--
-- La contraseña NO pasa por aquí: la web la cambia con
-- `supabase.auth.updateUser({ password })` tras re-validar la actual.
--
-- Bitácora: los triggers `empleado_bitacora` / `usuario_externo_bitacora`
-- (03_complemento) anotan cada UPDATE como `actualizar`, así que
-- `actualizar_mi_perfil` queda registrada sin código extra.
--
-- ---------------------------------------------------------------------
-- CÓMO MANTENER `permisos_catalogo()` EN SINCRONÍA CON `tiene_permiso()`
-- ---------------------------------------------------------------------
-- `get_mi_perfil` calcula los permisos recorriendo `permisos_catalogo()`
-- y conservando las claves para las que `tiene_permiso(<clave>)` es true
-- para quien llama. Por eso la lista debe contener TODAS las claves que
-- reconoce la última definición de `tiene_permiso()` (hoy la de la
-- migración 71). Cuando una migración agregue o quite una clave en
-- `tiene_permiso()`, esa misma migración debe redefinir
-- `permisos_catalogo()` con `create or replace`. La prueba
-- `supabase/tests/72_mi_perfil.test.sql` compara la lista contra los
-- `when '<clave>'` del código fuente vigente de `tiene_permiso()` y
-- falla si se desincronizan.
-- =====================================================================

-- 1) Teléfono de contacto (opcional) -----------------------------------
alter table public.empleado
  add column if not exists telefono text;
alter table public.usuario_externo
  add column if not exists telefono text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.empleado'::regclass and conname = 'empleado_telefono_check'
  ) then
    alter table public.empleado
      add constraint empleado_telefono_check
      check (telefono is null or telefono ~ '^[0-9]{10}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usuario_externo'::regclass and conname = 'usuario_externo_telefono_check'
  ) then
    alter table public.usuario_externo
      add constraint usuario_externo_telefono_check
      check (telefono is null or telefono ~ '^[0-9]{10}$');
  end if;
end;
$$;

comment on column public.empleado.telefono is
  'Teléfono de contacto (10 dígitos). Lo edita la propia persona con actualizar_mi_perfil().';
comment on column public.usuario_externo.telefono is
  'Teléfono de contacto (10 dígitos). Lo edita la propia persona con actualizar_mi_perfil().';

-- 2) Catálogo de claves de permiso -------------------------------------
-- Mantener igual a los `when '<clave>'` de public.tiene_permiso() (ver cabecera).
create or replace function public.permisos_catalogo()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    -- Administración y catálogos
    'catalogos.gestionar',
    'directorio.gestionar',
    'cuentas.gestionar',
    'bitacora.ver',
    -- Expedientes y atención
    'expediente.escribir',
    'expediente.ver',
    'expediente.verificar_curp',
    'expediente.reabrir',
    'seguimiento.registrar',
    'seguimiento.corregir',
    'agresor.acceder',
    'historial_clinico.acceder',
    'historial_clinico.escribir',
    'nota_psicologia.acceder',
    'orden_proteccion.escribir',
    -- Agenda, urgencias y derivaciones (canalizaciones)
    'agenda.ver',
    'agenda.gestionar',
    'agenda.crear',
    'urgencias.ver',
    'derivacion.gestionar',
    'canalizacion.crear',
    -- Alertas 24/7
    'alerta.atender',
    'alerta.ver_cola',
    -- Actividades preventivas e informes
    'actividad.ver',
    'actividad.registrar',
    'informe.ver'
  ]::text[];
$$;

revoke all on function public.permisos_catalogo() from public, anon;
grant execute on function public.permisos_catalogo() to authenticated;

-- 3) RPC: public.get_mi_perfil -----------------------------------------
create or replace function public.get_mi_perfil()
returns table (
  id           uuid,
  tipo         text,
  nombre       text,
  correo       text,
  telefono     text,
  rol          text,
  area_id      smallint,
  area_clave   text,
  area_nombre  text,
  dependencia  text,
  activo       boolean,
  permisos     text[],
  creado_en    timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid      uuid := auth.uid();
  v_tipo     text;
  v_permisos text[];
  v_perfil   record;
begin
  if v_uid is null then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;

  v_tipo := public.auth_tipo_cuenta();

  if v_tipo = 'empleado' then
    select e.id, 'empleado'::text as tipo, e.nombre, u.email::text as correo, e.telefono,
           e.rol::text as rol, e.area_id, a.clave as area_clave, a.nombre as area_nombre,
           null::text as dependencia, e.activo, e.creado_en
    into v_perfil
    from public.empleado e
    join auth.users u on u.id = e.id
    left join public.cat_area a on a.id = e.area_id
    where e.id = v_uid;
  elsif v_tipo = 'externo' then
    select x.id, 'externo'::text as tipo, x.nombre, u.email::text as correo, x.telefono,
           'umeca'::text as rol, null::smallint as area_id, null::text as area_clave,
           null::text as area_nombre, x.dependencia, x.activo, x.creado_en
    into v_perfil
    from public.usuario_externo x
    join auth.users u on u.id = x.id
    where x.id = v_uid;
  else
    raise exception 'Esta cuenta no tiene perfil en el panel' using errcode = '42501';
  end if;

  if v_perfil.id is null then
    raise exception 'Esta cuenta no tiene perfil en el panel' using errcode = '42501';
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[])
  into v_permisos
  from unnest(public.permisos_catalogo()) as k
  where public.tiene_permiso(k);

  return query
  select v_perfil.id, v_perfil.tipo, v_perfil.nombre, v_perfil.correo, v_perfil.telefono,
         v_perfil.rol, v_perfil.area_id, v_perfil.area_clave, v_perfil.area_nombre,
         v_perfil.dependencia, v_perfil.activo, v_permisos, v_perfil.creado_en;
end;
$$;

revoke all on function public.get_mi_perfil() from public, anon;
grant execute on function public.get_mi_perfil() to authenticated;

-- 4) RPC: public.actualizar_mi_perfil ----------------------------------
create or replace function public.actualizar_mi_perfil(
  p_nombre   text,
  p_telefono text default null
)
returns table (
  nombre   text,
  telefono text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid      uuid := auth.uid();
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_telefono text := nullif(regexp_replace(coalesce(p_telefono, ''), '[[:space:]().-]', '', 'g'), '');
  v_res_nom  text;
  v_res_tel  text;
begin
  if v_uid is null then
    raise exception 'Sesión inválida' using errcode = '42501';
  end if;

  if char_length(v_nombre) not between 1 and 120 then
    raise exception 'El nombre es obligatorio (máximo 120 caracteres).'
      using errcode = '23514';
  end if;

  if v_telefono is not null and v_telefono !~ '^[0-9]{10}$' then
    raise exception 'El teléfono debe tener 10 dígitos.'
      using errcode = '23514';
  end if;

  if public.es_empleado_activo() then
    update public.empleado e
    set nombre = v_nombre,
        telefono = v_telefono
    where e.id = v_uid
    returning e.nombre, e.telefono into v_res_nom, v_res_tel;
  elsif public.es_umeca() then
    update public.usuario_externo x
    set nombre = v_nombre,
        telefono = v_telefono
    where x.id = v_uid
    returning x.nombre, x.telefono into v_res_nom, v_res_tel;
  else
    raise exception 'Esta cuenta no puede editar su perfil' using errcode = '42501';
  end if;

  return query select v_res_nom, v_res_tel;
end;
$$;

revoke all on function public.actualizar_mi_perfil(text, text) from public, anon;
grant execute on function public.actualizar_mi_perfil(text, text) to authenticated;
