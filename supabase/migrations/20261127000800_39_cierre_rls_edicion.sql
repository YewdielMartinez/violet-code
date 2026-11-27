-- =====================================================================
-- 39_cierre_rls_edicion.sql (A-07 · Sprint 02)
-- Cierra la escritura directa (INSERT/UPDATE/DELETE) en RLS para las 7
-- tablas del expediente, dejando únicamente las RPCs (SECURITY DEFINER):
--   persona, ficha_registro, ficha_servicio_solicitado, agresor,
--   historial_clinico, estudio_socioeconomico y aportante_hogar.
-- Los SELECT no cambian. crear_ficha_completa y las RPCs de A-03/A-04/
-- A-05/A-06 siguen funcionando por ser SECURITY DEFINER.
--
-- ⚠️ Rompe escrituras directas del front (.from().insert()/update()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. persona
-- ---------------------------------------------------------------------
drop policy if exists persona_insert on public.persona;
drop policy if exists persona_update on public.persona;

create policy persona_insert on public.persona
  for insert to authenticated
  with check (false);

create policy persona_update on public.persona
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir'::text)))
  with check (false);

-- ---------------------------------------------------------------------
-- 2. ficha_registro
-- ---------------------------------------------------------------------
drop policy if exists ficha_registro_insert on public.ficha_registro;
drop policy if exists ficha_registro_update on public.ficha_registro;

create policy ficha_registro_insert on public.ficha_registro
  for insert to authenticated
  with check (false);

create policy ficha_registro_update on public.ficha_registro
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir'::text)))
  with check (false);

-- ---------------------------------------------------------------------
-- 3. ficha_servicio_solicitado
-- ---------------------------------------------------------------------
drop policy if exists ficha_servicio_solicitado_insert on public.ficha_servicio_solicitado;
drop policy if exists ficha_servicio_solicitado_update on public.ficha_servicio_solicitado;
drop policy if exists ficha_servicio_solicitado_delete on public.ficha_servicio_solicitado;

create policy ficha_servicio_solicitado_insert on public.ficha_servicio_solicitado
  for insert to authenticated
  with check (false);

create policy ficha_servicio_solicitado_update on public.ficha_servicio_solicitado
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir'::text)))
  with check (false);

create policy ficha_servicio_solicitado_delete on public.ficha_servicio_solicitado
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------
-- 4. agresor
-- ---------------------------------------------------------------------
drop policy if exists agresor_insert on public.agresor;
drop policy if exists agresor_update on public.agresor;

create policy agresor_insert on public.agresor
  for insert to authenticated
  with check (false);

create policy agresor_update on public.agresor
  for update to authenticated
  using ((select public.tiene_permiso('agresor.acceder'::text)))
  with check (false);

-- ---------------------------------------------------------------------
-- 5. historial_clinico
-- ---------------------------------------------------------------------
drop policy if exists historial_clinico_insert on public.historial_clinico;
drop policy if exists historial_clinico_update on public.historial_clinico;

create policy historial_clinico_insert on public.historial_clinico
  for insert to authenticated
  with check (false);

create policy historial_clinico_update on public.historial_clinico
  for update to authenticated
  using ((select public.tiene_permiso('historial_clinico.acceder'::text)))
  with check (false);

-- ---------------------------------------------------------------------
-- 6. estudio_socioeconomico
-- ---------------------------------------------------------------------
drop policy if exists estudio_socioeconomico_insert on public.estudio_socioeconomico;
drop policy if exists estudio_socioeconomico_update on public.estudio_socioeconomico;

create policy estudio_socioeconomico_insert on public.estudio_socioeconomico
  for insert to authenticated
  with check (false);

create policy estudio_socioeconomico_update on public.estudio_socioeconomico
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir'::text)))
  with check (false);

-- ---------------------------------------------------------------------
-- 7. aportante_hogar
-- ---------------------------------------------------------------------
drop policy if exists aportante_hogar_insert on public.aportante_hogar;
drop policy if exists aportante_hogar_update on public.aportante_hogar;

create policy aportante_hogar_insert on public.aportante_hogar
  for insert to authenticated
  with check (false);

create policy aportante_hogar_update on public.aportante_hogar
  for update to authenticated
  using ((select public.tiene_permiso('expediente.escribir'::text)))
  with check (false);
