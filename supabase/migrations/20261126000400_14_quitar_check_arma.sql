-- =====================================================================
-- 14_quitar_check_arma.sql
-- Elimina los CHECK sobre arma y la columna utilizo_arma_u_objeto en
-- public.agresor, dejando especificacion_arma como text libre.
-- =====================================================================

alter table public.agresor
  drop constraint if exists agresor_arma_especificacion_check,
  drop constraint if exists agresor_especificacion_arma_check,
  drop column if exists utilizo_arma_u_objeto;
