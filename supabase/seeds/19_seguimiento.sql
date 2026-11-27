-- =====================================================================
-- supabase/seeds/19_seguimiento.sql (A-04 · Sprint 01)
-- Atenciones sintéticas con prioridad 'alta' y 'baja' para pruebas de
-- seguimiento y lista de urgencias (B-02).
-- =====================================================================

do $$
declare
  v_uid_psic    uuid := '11111111-1111-4111-8111-111111111104';
  v_uid_jur     uuid := '11111111-1111-4111-8111-111111111105';
  v_ficha_1     uuid := '55555555-5555-4555-8555-555555555501';
  v_ficha_2     uuid := '55555555-5555-4555-8555-555555555502';
  v_ate_alta    uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_ate_baja    uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
  v_area_psic   smallint;
  v_area_jur    smallint;
  v_ta_psic     smallint;
  v_ta_jur      smallint;
begin
  if not exists (select 1 from public.ficha_registro where id = v_ficha_1) then
    return;
  end if;

  select id into v_area_psic from public.cat_area where clave = 'psicologia' limit 1;
  select id into v_area_jur  from public.cat_area where clave = 'juridico' limit 1;
  select id into v_ta_psic   from public.cat_tipo_atencion where clave = 'terapia_individual' limit 1;
  select id into v_ta_jur    from public.cat_tipo_atencion where clave = 'asesoria_juridica' limit 1;

  -- Atención con prioridad alta (para vista_lista_urgencias / B-02)
  insert into public.atencion (
    id, ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
    acciones_realizadas, proxima_accion, prioridad, observaciones, creado_por
  ) values (
    v_ate_alta, v_ficha_2, v_area_jur, v_ta_jur, v_uid_jur, now() - interval '2 days',
    'Orientación jurídica sobre medidas de protección.',
    'Dar seguimiento telefónico urgente.',
    'alta',
    'Caso prioritario sin cita futura agendada.',
    v_uid_jur
  )
  on conflict (id) do nothing;

  -- Atención con prioridad baja
  insert into public.atencion (
    id, ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
    acciones_realizadas, proxima_accion, prioridad, observaciones, creado_por
  ) values (
    v_ate_baja, v_ficha_1, v_area_psic, v_ta_psic, v_uid_psic, now() - interval '3 days',
    'Sesión de contención emocional y seguimiento.',
    'Continuar plan terapéutico quincenal.',
    'baja',
    'Evolución favorable.',
    v_uid_psic
  )
  on conflict (id) do nothing;
end;
$$;
