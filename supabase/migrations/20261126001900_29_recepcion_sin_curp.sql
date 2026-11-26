-- =====================================================================
-- 29_recepcion_sin_curp.sql (B-08 · Sprint 01 · RNF-02, RN-04)
-- Retira a Recepción la lectura directa de public.persona para evitar
-- exponer la CURP sin registro en bitácora. Recepción conserva acceso a
-- nombres y teléfonos únicamente mediante RPCs sin CURP (get_agenda,
-- get_lista_urgencias y verificar_curp).
--
-- NOTA DE INTEGRACIÓN: integrar a develop hasta confirmar que el widget
-- de agenda del dashboard ya no hace join directo con persona.
-- =====================================================================

drop policy if exists persona_select on public.persona;
create policy persona_select on public.persona
  for select to authenticated
  using ((select public.tiene_permiso('expediente.ver')));
