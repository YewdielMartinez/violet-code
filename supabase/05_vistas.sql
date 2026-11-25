-- =====================================================================
-- 05_vistas.sql
-- Qué contiene: vistas (consultas guardadas con nombre). No guardan datos
-- propios: cada vez que se leen, calculan con lo que hay en las tablas.
--   vista_lista_urgencias   personas a quienes llamar si se cancela una
--                           cita (RF-07)
--   vista_informe_mensual   informe por mes, área y tipo (RF-13)
--   vista_informe_anual     el mismo informe por año (RF-13)
--   vista_umeca_cita        lo único que ve UMECA (RF-21)
-- Responsable: Sara
-- Depende de: 01_base, 02_atencion, 03_complemento y 04_ficha.
-- Reglas de nombres y tipos: ver el encabezado de 01_base.sql.
--
-- SEGURIDAD
-- Las vistas con security_invoker = true respetan el RLS de quien las
-- consulta: cada quien solo cuenta lo que sus políticas le dejan ver.
-- vista_umeca_cita es la excepción: lee persona y cita por su cuenta
-- (UMECA no tiene permiso sobre esas tablas) y se filtra sola, de modo
-- que solo responde a un usuario_externo activo de UMECA y solo con las
-- citas de origen 'umeca'. Nada de CURP, expediente ni notas.
-- Ninguna vista se abre al rol anon (usuario sin sesión).
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
-- vista_umeca_cita (RF-21): para el rol de consulta de UMECA. Solo
-- nombre de la persona canalizada, fecha de la cita y estado, de citas
-- con origen = 'umeca'. Las citas que todavía no pasan salen como
-- 'pendiente'; 'cancelada' sale como 'cancelo'.
-- Sin security_invoker a propósito (ver SEGURIDAD arriba): el filtro con
-- auth.uid() hace que cualquier otra cuenta reciba la vista vacía.
-- Bitácora: una vista no puede escribir, así que la web de UMECA debe
-- llamar registrar_consulta('vista_umeca_cita', null) cada vez que la
-- abra (la función está en 03_complemento.sql).
-- ---------------------------------------------------------------------
create view vista_umeca_cita as
select c.id               as cita_id,
       p.nombres,
       p.apellido_paterno,
       p.apellido_materno,
       c.programada_en,
       case c.estado
         when 'asistio'    then 'asistio'
         when 'no_asistio' then 'no_asistio'
         when 'cancelada'  then 'cancelo'
         else 'pendiente'
       end                as estado
from cita c
join persona p on p.id = c.persona_id
where c.origen = 'umeca'
  and c.activo
  and c.estado <> 'reagendada'   -- se muestra solo la cita que la reemplazó
  and exists (
    select 1
    from usuario_externo u
    where u.id = auth.uid()
      and u.activo
      and u.dependencia = 'umeca'
  );

-- Nadie sin sesión puede leer las vistas.
revoke all on vista_lista_urgencias from anon;
revoke all on vista_informe_mensual from anon;
revoke all on vista_informe_anual   from anon;
revoke all on vista_umeca_cita      from anon;
-- La vista de UMECA es solo de lectura para cuentas con sesión.
revoke all on vista_umeca_cita from authenticated;
grant select on vista_umeca_cita to authenticated;
