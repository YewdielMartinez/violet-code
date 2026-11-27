-- =====================================================================
-- supabase/seed.sql
-- Datos sintéticos deterministas y reproducibles para desarrollo y demo
-- del MVP (RNF-01, RNF-01.1, RNF-10), alineados al flujo de 20 pasos.
--
-- Contraseña común de pruebas locales para todas las cuentas: Demo1234!
--   - titular@demo.violetcode.local        (titular)
--   - subdireccion@demo.violetcode.local   (subdireccion)
--   - trabajo.social@demo.violetcode.local (trabajo_social)
--   - psicologia@demo.violetcode.local     (psicologia)
--   - juridico@demo.violetcode.local       (juridico)
--   - recepcion@demo.violetcode.local      (recepcion)
--   - umeca@demo.violetcode.local          (usuario_externo: umeca)
--   - usuaria.app@demo.violetcode.local    (app móvil ligada a Exp. 1)
--   - usuaria.nueva@demo.violetcode.local  (app móvil sin expediente aún)
-- =====================================================================

do $$
declare
  v_pass text := extensions.crypt('Demo1234!', extensions.gen_salt('bf'));

  -- Cuentas fijas (7 roles Web/UMECA + 2 usuarias App Móvil)
  v_uid_titular   uuid := '11111111-1111-4111-8111-111111111101';
  v_uid_subdir    uuid := '11111111-1111-4111-8111-111111111102';
  v_uid_ts        uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_psic      uuid := '11111111-1111-4111-8111-111111111104';
  v_uid_jur       uuid := '11111111-1111-4111-8111-111111111105';
  v_uid_recep     uuid := '11111111-1111-4111-8111-111111111106';
  v_uid_umeca     uuid := '11111111-1111-4111-8111-111111111107';
  v_uid_app_1     uuid := '22222222-2222-4222-8222-222222222201';
  v_uid_app_2     uuid := '22222222-2222-4222-8222-222222222202';

  -- Áreas y catálogos
  v_area_ts       smallint;
  v_area_psic     smallint;
  v_area_jur      smallint;
  v_ta_ts_ing     smallint;
  v_ta_psic_1a    smallint;
  v_ta_psic_seg   smallint;
  v_ta_jur_ori    smallint;

  v_oc_empleada   smallint;
  v_oc_comerc     smallint;
  v_oc_hogar      smallint;
  v_par_pareja    smallint;
  v_par_expareja  smallint;
  v_par_madre     smallint;
  v_act_taller    smallint;
  v_act_conf      smallint;

  -- Asentamientos (Ahome precargado en 01b)
  v_asent_1       integer;
  v_asent_2       integer;
  v_asent_3       integer;

  -- Directorio
  v_inst_fiscalia smallint;

  -- Personas, domicilios, fichas y dependientes
  v_per_1         uuid := '33333333-3333-4333-8333-333333333301';
  v_per_2         uuid := '33333333-3333-4333-8333-333333333302';
  v_per_3         uuid := '33333333-3333-4333-8333-333333333303';

  v_dom_1         uuid := '44444444-4444-4444-8444-444444444401';
  v_dom_2         uuid := '44444444-4444-4444-8444-444444444402';
  v_dom_3         uuid := '44444444-4444-4444-8444-444444444403';

  v_ficha_1       uuid := '55555555-5555-4555-8555-555555555501';
  v_ficha_2       uuid := '55555555-5555-4555-8555-555555555502';
  v_ficha_3       uuid := '55555555-5555-4555-8555-555555555503';

  v_est_1         uuid := '66666666-6666-4666-8666-666666666601';
  v_est_2         uuid := '66666666-6666-4666-8666-666666666602';

  v_agr_1         uuid := '77777777-7777-4777-8777-777777777701';
  v_agr_2         uuid := '77777777-7777-4777-8777-777777777702';

  v_orden_1       uuid := '88888888-8888-4888-8888-888888888801';

  v_cita_1_psic   uuid := '99999999-9999-4999-8999-999999999901';
  v_cita_2_orig   uuid := '99999999-9999-4999-8999-999999999902';
  v_cita_2_reag   uuid := '99999999-9999-4999-8999-999999999903';
  v_cita_2_umeca  uuid := '99999999-9999-4999-8999-999999999904';
  v_cita_3_ts     uuid := '99999999-9999-4999-8999-999999999905';

  v_pre_1         uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  v_pre_2         uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';

  v_act_1         uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
  v_act_2         uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';

  v_user_rec      record;
begin
  -- Idempotencia básica si ya existen datos del seed
  if exists (select 1 from auth.users where id = v_uid_titular) then
    return;
  end if;

  -- 1. Crear usuarios compatibles con Supabase Auth (GoTrue)
  for v_user_rec in
    select * from (values
      (v_uid_titular, 'titular@demo.violetcode.local',        'María Elena Titular'),
      (v_uid_subdir,  'subdireccion@demo.violetcode.local',   'Lucía Subdirección'),
      (v_uid_ts,      'trabajo.social@demo.violetcode.local', 'Claudia Trabajo Social'),
      (v_uid_psic,    'psicologia@demo.violetcode.local',     'Valeria Psicología'),
      (v_uid_jur,     'juridico@demo.violetcode.local',       'Sofía Jurídico'),
      (v_uid_recep,   'recepcion@demo.violetcode.local',      'Karla Recepción'),
      (v_uid_umeca,   'umeca@demo.violetcode.local',          'Enlace UMECA'),
      (v_uid_app_1,   'usuaria.app@demo.violetcode.local',    'Adriana Meza (Demo Móvil)'),
      (v_uid_app_2,   'usuaria.nueva@demo.violetcode.local',  'Fernanda Valenzuela (Demo Pre-registro)')
    ) as t(uid, email, nombre)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_rec.uid,
      'authenticated',
      'authenticated',
      v_user_rec.email,
      v_pass,
      now(), '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', v_user_rec.nombre),
      false, false, now(), now()
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_rec.uid::text,
      v_user_rec.uid,
      jsonb_build_object(
        'sub', v_user_rec.uid::text,
        'email', v_user_rec.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(), now(), now()
    );
  end loop;

  -- 2. Resolver IDs de catálogos
  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  select id into v_ta_ts_ing   from public.cat_tipo_atencion where clave = 'entrevista_inicial';
  select id into v_ta_psic_1a  from public.cat_tipo_atencion where clave = 'valoracion_inicial';
  select id into v_ta_psic_seg from public.cat_tipo_atencion where clave = 'terapia_individual';
  select id into v_ta_jur_ori  from public.cat_tipo_atencion where clave = 'asesoria_juridica';

  select id into v_oc_empleada from public.cat_ocupacion where clave = 'empleada';
  select id into v_oc_comerc   from public.cat_ocupacion where clave = 'comerciante';
  select id into v_oc_hogar    from public.cat_ocupacion where clave = 'hogar';

  select id into v_par_pareja   from public.cat_parentesco where clave = 'pareja';
  select id into v_par_expareja from public.cat_parentesco where clave = 'expareja';
  select id into v_par_madre    from public.cat_parentesco where clave = 'madre';

  select id into v_act_taller from public.cat_tipo_actividad where clave = 'taller';
  select id into v_act_conf   from public.cat_tipo_actividad where clave = 'conferencia';

  select id into v_asent_1 from public.cat_asentamiento order by id limit 1 offset 0;
  select id into v_asent_2 from public.cat_asentamiento order by id limit 1 offset 10;
  select id into v_asent_3 from public.cat_asentamiento order by id limit 1 offset 25;

  -- 3. Personal interno y usuario externo UMECA
  insert into public.empleado (id, nombre, rol, area_id, creado_por) values
    (v_uid_titular, 'María Elena Titular',    'titular',        null,         null),
    (v_uid_subdir,  'Lucía Subdirección',     'subdireccion',   null,         v_uid_titular),
    (v_uid_ts,      'Claudia Trabajo Social', 'trabajo_social', v_area_ts,    v_uid_titular),
    (v_uid_psic,    'Valeria Psicología',     'psicologia',     v_area_psic,  v_uid_titular),
    (v_uid_jur,     'Sofía Jurídico',         'juridico',       v_area_jur,   v_uid_titular),
    (v_uid_recep,   'Karla Recepción',        'recepcion',      null,         v_uid_titular);

  insert into public.usuario_externo (id, nombre, dependencia, creado_por) values
    (v_uid_umeca, 'Enlace UMECA Ahome', 'umeca', v_uid_titular);

  -- 4. Directorio institucional (con refugio estrictamente sin dirección)
  insert into public.directorio_institucion (
    nombre, categoria, telefono, horario, es_24_horas,
    asentamiento_id, calle, numero_exterior, referencias, orden, creado_por
  ) values
    ('Emergencias 911', 'emergencia', '911', '24 horas', true, null, null, null, null, 1, v_uid_titular),
    ('Denuncia Anónima 089', 'linea_apoyo', '089', '24 horas', true, null, null, null, null, 2, v_uid_titular),
    ('Línea SEMUJERES Ahome', 'orientacion_legal', '6688164000', 'Lunes a Viernes 8:00-15:00', false,
      v_asent_1, 'Calle Marcial Ordóñez', '120', 'Planta baja, Zona Centro', 3, v_uid_titular),
    ('Centro de Salud Urbano Los Mochis', 'salud', '6688121500', 'Lunes a Domingo 8:00-20:00', false,
      v_asent_2, 'Blvd. Macario Gaxiola', '340', 'Esquina Blvd. Rosendo G. Castro', 5, v_uid_titular),
    ('Refugio Confidencial de Protección', 'refugio', '8008384600', '24 horas (canalización institucional)', true,
      null, null, null, null, 6, v_uid_titular);

  insert into public.directorio_institucion (
    nombre, categoria, telefono, horario, es_24_horas,
    asentamiento_id, calle, numero_exterior, referencias, orden, creado_por
  ) values (
    'Fiscalía Especializada en Violencia Contra las Mujeres', 'denuncia', '6688159100', '24 horas', true,
    v_asent_1, 'Blvd. Adolfo López Mateos', '890', 'Junto a Vicefiscalía Zona Norte', 4, v_uid_titular
  ) returning id into v_inst_fiscalia;

  -- 5. Pre-registros móviles (RF-33 / RF-34)
  -- Pre-registro 1: usuaria que ya cuenta con expediente y orden vigente
  -- Pre-registro 2: usuaria nueva en app sin expediente aún (lista para RF-34)
  insert into public.pre_registro (
    id, auth_user_id, curp, nombres, apellido_paterno, apellido_materno,
    celular, aviso_privacidad_aceptado_en
  ) values
    (v_pre_1, v_uid_app_1, 'MEZA910315MSLGRN04', 'Adriana', 'Meza', 'Gutiérrez',
      '6681000001', now() - interval '10 days'),
    (v_pre_2, v_uid_app_2, 'VALE940918MSLVZR05', 'Fernanda', 'Valenzuela', 'Ruiz',
      '6681000002', now() - interval '1 day');

  -- 6. Personas atendidas (al insertar v_per_1 se liga automáticamente con v_pre_1)
  insert into public.persona (
    id, curp, nombres, apellido_paterno, apellido_materno, celular,
    escolaridad, discapacidad, religion, grupo_etnico, creado_por
  ) values
    (v_per_1, 'MEZA910315MSLGRN04', 'Adriana', 'Meza', 'Gutiérrez', '6681000001',
      'preparatoria', 'Ninguna', 'Católica', 'Ninguno', v_uid_ts),
    (v_per_2, 'SOTO881104MSLRRN07', 'Beatriz', 'Soto', 'Ramírez', '6681000003',
      'carrera', 'Ninguna', 'Católica', 'Ninguno', v_uid_ts),
    (v_per_3, 'CARR950722HSLMNR02', 'Carlos', 'Carrillo', 'Mendoza', '6681000004',
      'secundaria', 'Ninguna', 'Católica', 'Ninguno', v_uid_ts);

  insert into public.domicilio (
    id, persona_id, asentamiento_id, calle, numero_exterior, numero_interior,
    referencias, zona, es_actual, creado_por
  ) values
    (v_dom_1, v_per_1, v_asent_1, 'Av. Independencia', '412', 'A', 'Casa portón blanco', 'urbana', true, v_uid_ts),
    (v_dom_2, v_per_2, v_asent_2, 'Calle Santos Degollado', '205', null, 'Frente a primaria', 'urbana', true, v_uid_ts),
    (v_dom_3, v_per_3, v_asent_3, 'Camino Real', '18', null, 'Entrada ejidal', 'rural', true, v_uid_ts);

  -- 7. Fichas Únicas (folio generado automáticamente: SEM-AAAA-0001..0003)
  insert into public.ficha_registro (
    id, persona_id, estado, aviso_privacidad_aceptado_en,
    es_victima_delito, estado_civil, ocupacion_id, tiene_trabajo,
    servicio_medico, numero_hijas, numero_hijos_hombres,
    tiene_embarazo, tiene_denuncia, drogas, consumo_alcohol, creado_por
  ) values
    (v_ficha_1, v_per_1, 'en_seguimiento', now() - interval '7 days',
      true, 'separado', v_oc_empleada, true, 'imss', 1, 1, false, true, array['no_consume']::public.tipo_droga[], 'no_consume'::public.consumo_alcohol, v_uid_ts),
    (v_ficha_2, v_per_2, 'abierto', now() - interval '2 days',
      true, 'casado', v_oc_comerc, true, 'particular', 2, 0, false, false, array['no_consume']::public.tipo_droga[], 'no_consume'::public.consumo_alcohol, v_uid_ts),
    (v_ficha_3, v_per_3, 'cerrado', now() - interval '15 days',
      false, 'soltero', v_oc_empleada, true, 'ninguno', 0, 0, false, false, array['no_consume']::public.tipo_droga[], 'no_consume'::public.consumo_alcohol, v_uid_ts);

  insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por) values
    (v_ficha_1, v_area_ts,   v_uid_ts),
    (v_ficha_1, v_area_psic, v_uid_ts),
    (v_ficha_1, v_area_jur,  v_uid_ts),
    (v_ficha_2, v_area_ts,   v_uid_ts),
    (v_ficha_2, v_area_psic, v_uid_ts),
    (v_ficha_3, v_area_ts,   v_uid_ts);

  -- 8. Estudios socioeconómicos y aportantes del hogar
  insert into public.estudio_socioeconomico (
    id, ficha_id, fecha_estudio, es_actual, ingreso_mensual_propio,
    numero_dependientes, tiene_apoyo, especificacion_apoyo,
    tipo_vivienda, material, servicios, bienes, creado_por
  ) values
    (v_est_1, v_ficha_1, current_date - 7, true, 6800.00, 2, false, null,
      'rentada', 'block', array['agua', 'drenaje', 'luz', 'internet']::public.servicio_vivienda[],
      array['estufa', 'refrigerador', 'lavadora']::public.bien_vivienda[], v_uid_ts),
    (v_est_2, v_ficha_2, current_date - 2, true, 9200.00, 2, true, 'Beca escolar municipal',
      'infonavit', 'ladrillo', array['agua', 'drenaje', 'luz', 'pavimento']::public.servicio_vivienda[],
      array['estufa', 'refrigerador', 'tv', 'aire_acondicionado']::public.bien_vivienda[], v_uid_ts);

  insert into public.aportante_hogar (
    estudio_socioeconomico_id, nombre, parentesco_id, ocupacion_id,
    tipo_trabajo, monto, frecuencia, creado_por
  ) values (
    v_est_1, 'Rosa Gutiérrez', v_par_madre, v_oc_comerc,
    'negocio_propio', 2500.00, 'quincenal', v_uid_ts
  );

  -- 9. Agresores y orden de protección vigente (Exp. 1)
  insert into public.agresor (
    id, ficha_id, nombres, apellido_paterno, apellido_materno, edad,
    sexo, estado_civil, parentesco_id, asentamiento_id, calle, numero_exterior,
    zona, ocupacion_id, tipo_trabajo, drogas,
    consumo_alcohol, observaciones, creado_por
  ) values
    (v_agr_1, v_ficha_1, 'Roberto', 'Salazar', 'Pineda', 36,
      'H', 'separado', v_par_expareja, v_asent_2, 'Calle Allende', '305',
      'urbana', v_oc_empleada, 'temporal', array['marihuana']::public.tipo_droga[],
      'ocasional'::public.consumo_alcohol, 'Antecedentes de hostigamiento telefónico.', v_uid_ts),
    (v_agr_2, v_ficha_2, 'Héctor', 'Montoya', 'Castro', 39,
      'H', 'casado', v_par_pareja, v_asent_2, 'Calle Santos Degollado', '205',
      'urbana', v_oc_comerc, 'negocio_propio', array['no_consume']::public.tipo_droga[],
      'ocasional'::public.consumo_alcohol, 'Evaluación en curso.', v_uid_ts);

  insert into public.orden_proteccion (
    id, ficha_id, agresor_id, numero_oficio, autoridad_emisora,
    fecha_emision, fecha_vigencia, estado, creado_por
  ) values (
    v_orden_1, v_ficha_1, v_agr_1, 'OF-JPF-2026-0142', 'Juzgado Primero Familiar de Ahome',
    current_date - 5, current_date + 55, 'vigente', v_uid_jur
  );

  -- 10. Derivaciones (interna y externa)
  insert into public.derivacion (
    ficha_id, area_origen_id, area_destino_id, institucion_id,
    destino, institucion_otra, motivo, fecha_derivacion, estado, creado_por
  ) values
    (v_ficha_1, v_area_ts, v_area_psic, null, 'psicologia', null,
      'Valoración psicológica prioritaria', current_date - 7, 'concluida', v_uid_ts),
    (v_ficha_1, v_area_ts, null, v_inst_fiscalia, 'fiscalia', null,
      'Acompañamiento para ratificación de denuncia', current_date - 6, 'en_proceso', v_uid_ts),
    (v_ficha_3, v_area_ts, null, null, 'otra_institucion', 'Defensoría Pública Civil',
      'Asunto laboral/civil fuera de competencia jurídica de violencia', current_date - 15, 'concluida', v_uid_ts);

  -- 11. Citas (incluye asistida, cancelada->reagendada para mañana y UMECA)
  -- Exp. 1 queda sin cita futura para aparecer en vista_lista_urgencias.
  insert into public.cita (
    id, persona_id, reagendada_de, area_id, programada_en, prioridad,
    recomendada_por, estado, confirmada_en, motivo_cancelacion, origen, creado_por
  ) values
    (v_cita_1_psic, v_per_1, null, v_area_psic, now() - interval '3 days', 'alta',
      'Trabajo Social', 'asistio', now() - interval '4 days', null, 'regular', v_uid_recep),
    (v_cita_2_orig, v_per_2, null, v_area_psic, now() - interval '1 day', 'media',
      'Trabajo Social', 'reagendada', null, 'Usuaria solicitó cambio por horario laboral', 'regular', v_uid_recep),
    (v_cita_2_reag, v_per_2, v_cita_2_orig, v_area_psic, now() + interval '1 day', 'media',
      'Trabajo Social', 'agendada', null, null, 'regular', v_uid_recep),
    (v_cita_2_umeca, v_per_2, null, v_area_jur, now() + interval '3 days', 'alta',
      'UMECA', 'confirmada', now(), null, 'umeca', v_uid_jur),
    (v_cita_3_ts, v_per_3, null, v_area_ts, now() - interval '15 days', 'baja',
      'Recepción', 'asistio', now() - interval '15 days', null, 'regular', v_uid_recep);

  -- 12. Atenciones (Hoja de Seguimiento), Historial Clínico y Notas Privadas
  insert into public.atencion (
    ficha_id, cita_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
    estado_civil, ocupacion_id, celular, domicilio_id,
    acciones_realizadas, proxima_accion, observaciones, prioridad, creado_por
  ) values
    (v_ficha_1, null, v_area_ts, v_ta_ts_ing, v_uid_ts, now() - interval '7 days',
      'separado', v_oc_empleada, '6681000001', v_dom_1,
      'Apertura de Ficha Única y canalización a Psicología y Jurídico.',
      'Confirmar ratificación ante Fiscalía.', 'Caso prioritario por orden en trámite.', 'alta', v_uid_ts),
    (v_ficha_1, v_cita_1_psic, v_area_psic, v_ta_psic_1a, v_uid_psic, now() - interval '3 days',
      'separado', v_oc_empleada, '6681000001', v_dom_1,
      'Entrevista inicial de contención y plan de seguridad.',
      'Agendar seguimiento quincenal.', 'Paciente receptiva al acompañamiento.', 'alta', v_uid_psic),
    (v_ficha_3, v_cita_3_ts, v_area_ts, v_ta_ts_ing, v_uid_ts, now() - interval '15 days',
      'soltero', v_oc_empleada, '6681000004', v_dom_3,
      'Orientación inicial y canalización externa.', 'Sin acciones pendientes.', null, 'baja', v_uid_ts);

  insert into public.historial_clinico (
    ficha_id, antecedentes_familiares, antecedentes_personales,
    motivo_consulta, observaciones_iniciales, tiene_atencion_psicologica_previa, creado_por
  ) values (
    v_ficha_1,
    'Red de apoyo familiar materna activa.',
    'Sin antecedentes psiquiátricos reportados.',
    'Ansiedad derivada de hostigamiento tras separación.',
    'Se establece plan de seguridad y contención en primera sesión.',
    false,
    v_uid_psic
  );

  insert into public.nota_area (ficha_id, area_id, contenido, creado_por) values
    (v_ficha_1, v_area_psic, 'Nota confidencial de Psicología: reforzar estrategias de manejo de estrés.', v_uid_psic),
    (v_ficha_1, v_area_jur,  'Nota confidencial de Jurídico: dar seguimiento a prórroga de orden antes de día 50.', v_uid_jur);

  -- 13. Alertas (Alerta 1 entra como app_movil y sube a 'alta' por orden vigente)
  insert into public.alerta (
    pre_registro_id, origen, asentamiento_id, estado,
    tomada_en, observaciones, creado_por
  ) values
    (v_pre_1, 'app_movil', v_asent_1, 'nueva', null, null, null),
    (v_pre_2, 'app_movil', v_asent_2, 'tomada', now() - interval '15 minutes',
      'Llamada de verificación realizada por Subdirección.', v_uid_subdir);

  -- 14. Actividades preventivas y asistencia de personal
  insert into public.actividad_preventiva (
    id, titulo, tipo_actividad_id, tipo_institucion, nivel_educativo,
    sede, direccion, referencias, asentamiento_id, programada_en, numero_asistentes, creado_por
  ) values
    (v_act_1, 'Prevención de la violencia en el noviazgo', v_act_taller, 'escuela', 'preparatoria',
      'Preparatoria UAS Los Mochis', 'Blvd. Rosales 450', 'Auditorio principal', v_asent_1,
      now() + interval '5 days', 85, v_uid_ts),
    (v_act_2, 'Derechos y rutas de atención SEMUJERES', v_act_conf, 'comunidad', null,
      'Centro Comunitario Ejido Mochis', 'Calle Principal s/n', 'Techumbre ejidal', v_asent_3,
      now() - interval '4 days', 42, v_uid_ts);

  insert into public.actividad_empleado (actividad_preventiva_id, empleado_id, creado_por) values
    (v_act_1, v_uid_ts,   v_uid_titular),
    (v_act_1, v_uid_psic, v_uid_titular),
    (v_act_2, v_uid_ts,   v_uid_titular);
end $$;
