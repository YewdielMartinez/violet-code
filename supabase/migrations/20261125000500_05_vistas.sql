-- =====================================================================
-- 05_vistas.sql
-- Qué contiene: vistas (consultas guardadas con nombre). No guardan datos
-- propios: cada vez que se leen, calculan con lo que hay en las tablas.
--   vista_lista_urgencias   personas a quienes llamar si se cancela una
--                           cita (RF-07)
--   vista_informe_mensual   informe por mes, área y tipo (RF-13)
--   vista_informe_anual     el mismo informe por año (RF-13)
--   get_umeca_citas()          RPC de citas UMECA con bitácora (RF-21)
--   get_mapa_calor_asentamiento() RPC agregado de mapa de calor con umbral
-- Responsable: Sara
-- Depende de: 01_base, 02_atencion, 03_complemento y 04_ficha.
-- Reglas de nombres y tipos: ver el encabezado de 01_base.sql.
--
-- SEGURIDAD
-- Las vistas con security_invoker = true respetan el RLS de quien las
-- consulta: cada quien solo cuenta lo que sus políticas le dejan ver.
-- get_umeca_citas() y get_mapa_calor_asentamiento() usan security definer
-- con search_path fijo, validan sesión/rol y auditan cuando aplica.
-- Ninguna vista ni RPC se abre al rol anon (usuario sin sesión).
-- =====================================================================

-- ---------------------------------------------------------------------
-- vista_lista_urgencias (RF-07): expedientes abiertos o en seguimiento
-- cuya prioridad más reciente es alta y que no tienen ya una cita
-- próxima. "Prioridad más reciente" = la de la última atención que tenga
-- prioridad (las atenciones con prioridad vacía no la cambian).
-- Primero salen quienes llevan más tiempo sin ser atendidas.
-- ---------------------------------------------------------------------
create view vista_lista_urgencias
with (security_invoker = true) as
with ultima_prioridad as (
  select distinct on (a.ficha_id)
         a.ficha_id,
         a.prioridad,
         (a.atendida_en at time zone 'America/Mazatlan')::date as fecha_atencion
  from atencion a
  where a.activo
    and a.prioridad is not null
  order by a.ficha_id, a.atendida_en desc, a.creado_en desc
)
select f.id               as ficha_id,
       f.folio,
       p.id               as persona_id,
       p.nombres,
       p.apellido_paterno,
       p.apellido_materno,
       p.celular,
       u.fecha_atencion   as fecha_ultima_prioridad
from ficha_registro f
join persona p          on p.id = f.persona_id
join ultima_prioridad u on u.ficha_id = f.id
where f.activo
  and p.activo
  and f.estado in ('abierto', 'en_seguimiento')
  and u.prioridad = 'alta'
  and not exists (
    select 1
    from cita c
    where c.persona_id = f.persona_id
      and c.activo
      and c.estado in ('agendada', 'confirmada')  -- 'reagendada' ya no cuenta: su reemplazo es otra cita
      and c.programada_en > now()
  )
order by u.fecha_atencion;

-- ---------------------------------------------------------------------
-- Informes mensual y anual (RF-13): por área y tipo de atención,
-- separando primera vez y seguimiento, y contando hombres y mujeres.
-- Nunca muestran CURP ni nombres (RNF-02): solo números.
-- "Primera vez" = la primera atención de la persona en esa área
-- (RN-19); las siguientes en la misma área cuentan como seguimiento.
-- mujeres / hombres / total_personas cuentan personas distintas;
-- total_atenciones cuenta visitas.
-- La fecha se toma en hora de Sinaloa (America/Mazatlan), para que una
-- atención de las 11 de la noche no caiga en el día siguiente.
-- ---------------------------------------------------------------------
create view vista_informe_mensual
with (security_invoker = true) as
with atencion_marcada as (
  select a.area_id,
         a.tipo_atencion_id,
         (a.atendida_en at time zone 'America/Mazatlan')::date as fecha_atencion,
         f.persona_id,
         p.sexo,
         row_number() over (
           partition by f.persona_id, a.area_id
           order by a.atendida_en, a.creado_en
         ) = 1 as es_primera_vez
  from atencion a
  join ficha_registro f on f.id = a.ficha_id
  join persona p        on p.id = f.persona_id
  where a.activo
)
select extract(year  from m.fecha_atencion)::int as anio,
       extract(month from m.fecha_atencion)::int as mes,
       ar.nombre                                 as area,
       t.nombre                                  as tipo_atencion,
       case when m.es_primera_vez then 'primera_vez' else 'seguimiento' end
                                                 as primera_vez_o_seguimiento,
       count(distinct m.persona_id) filter (where m.sexo = 'M') as mujeres,
       count(distinct m.persona_id) filter (where m.sexo = 'H') as hombres,
       count(distinct m.persona_id)              as total_personas,
       count(*)                                  as total_atenciones
from atencion_marcada m
join cat_area ar          on ar.id = m.area_id
join cat_tipo_atencion t  on t.id  = m.tipo_atencion_id
group by 1, 2, 3, 4, 5;

create view vista_informe_anual
with (security_invoker = true) as
with atencion_marcada as (
  select a.area_id,
         a.tipo_atencion_id,
         (a.atendida_en at time zone 'America/Mazatlan')::date as fecha_atencion,
         f.persona_id,
         p.sexo,
         row_number() over (
           partition by f.persona_id, a.area_id
           order by a.atendida_en, a.creado_en
         ) = 1 as es_primera_vez
  from atencion a
  join ficha_registro f on f.id = a.ficha_id
  join persona p        on p.id = f.persona_id
  where a.activo
)
select extract(year from m.fecha_atencion)::int  as anio,
       ar.nombre                                 as area,
       t.nombre                                  as tipo_atencion,
       case when m.es_primera_vez then 'primera_vez' else 'seguimiento' end
                                                 as primera_vez_o_seguimiento,
       count(distinct m.persona_id) filter (where m.sexo = 'M') as mujeres,
       count(distinct m.persona_id) filter (where m.sexo = 'H') as hombres,
       count(distinct m.persona_id)              as total_personas,
       count(*)                                  as total_atenciones
from atencion_marcada m
join cat_area ar          on ar.id = m.area_id
join cat_tipo_atencion t  on t.id  = m.tipo_atencion_id
group by 1, 2, 3, 4;

-- ---------------------------------------------------------------------
-- get_umeca_citas() (RF-21): RPC para el rol de consulta de UMECA.
-- Solo devuelve nombre, fecha de cita y estado de citas con origen =
-- 'umeca'. Registra automáticamente la consulta en bitacora_acceso y
-- evita exponer una vista security definer sin invoker.
-- ---------------------------------------------------------------------
create or replace function public.get_umeca_citas()
returns table (
  cita_id          uuid,
  nombres          text,
  apellido_paterno text,
  apellido_materno text,
  programada_en    timestamptz,
  estado           text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_externo_id uuid;
begin
  select u.id into v_usuario_externo_id
  from usuario_externo u
  where u.id = auth.uid()
    and u.activo
    and u.dependencia = 'umeca';

  if v_usuario_externo_id is null then
    raise exception 'Sin permiso para consultar citas UMECA' using errcode = '42501';
  end if;

  insert into bitacora_acceso (usuario_externo_id, accion, tabla_afectada, registro_id)
  values (v_usuario_externo_id, 'ver', 'cita', null);

  return query
  select c.id as cita_id,
         p.nombres,
         p.apellido_paterno,
         p.apellido_materno,
         c.programada_en,
         case c.estado
           when 'asistio'    then 'asistio'
           when 'no_asistio' then 'no_asistio'
           when 'cancelada'  then 'cancelo'
           else 'pendiente'
         end as estado
  from cita c
  join persona p on p.id = c.persona_id
  where c.origen = 'umeca'
    and c.activo
    and c.estado <> 'reagendada';
end;
$$;

-- ---------------------------------------------------------------------
-- get_mapa_calor_asentamiento(): agregación por asentamiento/CP para el
-- mapa de calor sin datos personales y con umbral mínimo de privacidad.
-- ---------------------------------------------------------------------
create or replace function public.get_mapa_calor_asentamiento(p_umbral_minimo int default 3)
returns table (
  asentamiento_id   integer,
  codigo_postal     text,
  nombre            text,
  tipo_asentamiento text,
  municipio         text,
  estado            text,
  latitud           numeric(9, 6),
  longitud          numeric(9, 6),
  total_expedientes bigint,
  total_alertas     bigint,
  total_actividades bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from empleado e
    where e.id = auth.uid()
      and e.activo
      and e.rol in ('titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico')
  ) then
    raise exception 'Sin permiso para consultar el mapa de calor' using errcode = '42501';
  end if;

  return query
  with exp_por_asentamiento as (
    select d.asentamiento_id, count(distinct f.id) as cnt
    from domicilio d
    join persona p        on p.id = d.persona_id
    join ficha_registro f on f.persona_id = p.id
    where d.activo
      and d.es_actual
      and p.activo
      and f.activo
      and d.asentamiento_id is not null
    group by d.asentamiento_id
  ),
  alerta_por_asentamiento as (
    select a.asentamiento_id, count(*) as cnt
    from alerta a
    where a.activo
      and a.asentamiento_id is not null
    group by a.asentamiento_id
  ),
  act_por_asentamiento as (
    select ap.asentamiento_id, count(*) as cnt
    from actividad_preventiva ap
    where ap.activo
      and ap.asentamiento_id is not null
    group by ap.asentamiento_id
  )
  select a.id as asentamiento_id,
         a.codigo_postal,
         a.nombre,
         a.tipo_asentamiento,
         a.municipio,
         a.estado,
         a.latitud,
         a.longitud,
         coalesce(e.cnt, 0)  as total_expedientes,
         coalesce(al.cnt, 0) as total_alertas,
         coalesce(ac.cnt, 0) as total_actividades
  from cat_asentamiento a
  left join exp_por_asentamiento    e  on e.asentamiento_id  = a.id
  left join alerta_por_asentamiento al on al.asentamiento_id = a.id
  left join act_por_asentamiento    ac on ac.asentamiento_id = a.id
  where (coalesce(e.cnt, 0) + coalesce(al.cnt, 0)) >= greatest(coalesce(p_umbral_minimo, 3), 1)
  order by (coalesce(e.cnt, 0) + coalesce(al.cnt, 0)) desc, a.nombre;
end;
$$;

-- Nadie sin sesión puede leer las vistas ni ejecutar los RPCs.
revoke all on vista_lista_urgencias from anon;
revoke all on vista_informe_mensual from anon;
revoke all on vista_informe_anual   from anon;

revoke execute on function public.get_umeca_citas()               from public, anon;
grant  execute on function public.get_umeca_citas()               to authenticated;
revoke execute on function public.get_mapa_calor_asentamiento(int) from public, anon;
grant  execute on function public.get_mapa_calor_asentamiento(int) to authenticated;
