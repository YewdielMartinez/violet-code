-- =====================================================================
-- 08_cita_prioridad.sql
-- Agrega prioridad operativa opcional a la tabla cita para que
-- Recepción pueda registrarla al agendar citas presenciales.
-- Depende de: 01_base.sql (prioridad_nivel) y 02_atencion.sql (cita).
-- =====================================================================

alter table public.cita
  add column if not exists prioridad public.prioridad_nivel;
