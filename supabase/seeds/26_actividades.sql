-- =====================================================================
-- 26_actividades.sql (B-05 · RF-16)
-- Datos sintéticos deterministas e idempotentes de actividades
-- preventivas adicionales para pruebas de rango y participantes.
-- =====================================================================

do $$
declare
  v_act_pub_id   uuid := '26000000-0000-4000-a000-000000000001';
  v_act_emp_id   uuid := '26000000-0000-4000-a000-000000000002';
  v_tipo_cap     smallint;
  v_tipo_jor     smallint;
  v_asent_1      integer;
  v_asent_2      integer;
  v_emp_titular  uuid;
  v_emp_ts       uuid;
  v_emp_jur      uuid;
begin
  select cta.id into v_tipo_cap from public.cat_tipo_actividad cta where cta.clave = 'capacitacion';
  select cta.id into v_tipo_jor from public.cat_tipo_actividad cta where cta.clave = 'jornada';

  select ca.id into v_asent_1 from public.cat_asentamiento ca order by ca.id limit 1 offset 2;
  select ca.id into v_asent_2 from public.cat_asentamiento ca order by ca.id limit 1 offset 5;

  select e.id into v_emp_titular from public.empleado e where e.rol = 'titular' and e.activo order by e.creado_en limit 1;
  select e.id into v_emp_ts      from public.empleado e where e.rol = 'trabajo_social' and e.activo order by e.creado_en limit 1;
  select e.id into v_emp_jur     from public.empleado e where e.rol = 'juridico' and e.activo order by e.creado_en limit 1;

  if v_tipo_cap is null or v_tipo_jor is null then
    return;
  end if;

  insert into public.actividad_preventiva (
    id, titulo, tipo_actividad_id, tipo_institucion, nivel_educativo,
    sede, direccion, referencias, asentamiento_id, programada_en, numero_asistentes, creado_por
  ) values
    (
      v_act_pub_id,
      'Protocolo de atención a violencia laboral',
      v_tipo_cap,
      'sector_publico',
      null,
      'Palacio Municipal de Ahome',
      'Degollado y Cuauhtémoc s/n',
      'Sala de Cabildo',
      v_asent_1,
      now() - interval '12 days',
      60,
      v_emp_titular
    ),
    (
      v_act_emp_id,
      'Jornada informativa de derechos y líneas de apoyo',
      v_tipo_jor,
      'empresa_privada',
      null,
      'Parque Industrial Santa Rosa',
      'Carretera Internacional Norte km 4',
      'Explanada comedor',
      v_asent_2,
      now() + interval '10 days',
      110,
      v_emp_jur
    )
  on conflict (id) do nothing;

  if v_emp_ts is not null then
    insert into public.actividad_empleado (actividad_preventiva_id, empleado_id, creado_por)
    values (v_act_pub_id, v_emp_ts, v_emp_titular)
    on conflict (actividad_preventiva_id, empleado_id) do nothing;
  end if;

  if v_emp_jur is not null then
    insert into public.actividad_empleado (actividad_preventiva_id, empleado_id, creado_por)
    values
      (v_act_pub_id, v_emp_jur, v_emp_titular),
      (v_act_emp_id, v_emp_jur, v_emp_jur)
    on conflict (actividad_preventiva_id, empleado_id) do nothing;
  end if;
end $$;
