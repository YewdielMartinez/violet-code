-- =====================================================================
-- 61_notas_area_direccion.sql
-- Permite a Dirección (titular y subdireccion) leer todas las notas de
-- nota_area en solo lectura. Las áreas de atención siguen viendo y
-- editando únicamente las de su propia área; Recepción sigue bloqueada.
-- =====================================================================

drop policy if exists nota_area_select on public.nota_area;

create policy nota_area_select on public.nota_area
  for select to authenticated
  using (
    (select public.es_direccion())
    or (
      (select public.tiene_permiso('seguimiento.registrar'))
      and area_id = (select public.auth_area_id())
    )
  );
