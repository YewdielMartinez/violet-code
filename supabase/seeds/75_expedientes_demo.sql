-- =====================================================================
-- supabase/seeds/75_expedientes_demo.sql
-- 20 expedientes SINTÉTICOS (nombres, CURP, teléfonos y domicilios son
-- inventados; no corresponden a personas reales) para probar y mostrar
-- Estadísticas, Agenda, Urgencias, Canalizaciones, Alertas y las
-- pestañas del expediente.
--
-- Qué genera por expediente (determinista y reproducible):
--   persona + domicilio actual + Ficha Única (folio automático SEM-AAAA-NNNN)
--   servicios solicitados, estudio socioeconómico, persona agresora
--   (opcional), orden de protección (opcional), citas pasadas y futuras,
--   atenciones (Hoja de Seguimiento) repartidas en los últimos 11 meses,
--   derivaciones internas/externas, historial clínico y notas por área,
--   y algunas alertas por teléfono/presencial.
--
-- Mezcla de estados: abierto, en_seguimiento, cerrado y archivado;
-- prioridades alta/media/baja/sin dato. Algunos expedientes con prioridad
-- alta quedan SIN cita futura para que aparezcan en Lista de urgencias.
--
-- Depende de seed.sql (cuentas demo y directorio). Si no existen, no hace
-- nada. Si ya corrió (primera persona existe), tampoco.
-- =====================================================================

do $$
declare
  v_uid_titular uuid := '11111111-1111-4111-8111-111111111101';
  v_uid_subdir  uuid := '11111111-1111-4111-8111-111111111102';
  v_uid_ts      uuid := '11111111-1111-4111-8111-111111111103';
  v_uid_psic    uuid := '11111111-1111-4111-8111-111111111104';
  v_uid_jur     uuid := '11111111-1111-4111-8111-111111111105';
  v_uid_recep   uuid := '11111111-1111-4111-8111-111111111106';

  v_area_ts   smallint;
  v_area_psic smallint;
  v_area_jur  smallint;

  v_inst_fiscalia smallint;
  v_inst_refugio  smallint;
  v_inst_salud    smallint;

  v_n_asent   integer;
  v_hoy       date := (now() at time zone 'America/Mazatlan')::date;

  r           record;
  i           integer := 0;
  k           integer;
  v_per       uuid;
  v_dom       uuid;
  v_ficha     uuid;
  v_est       uuid;
  v_agr       uuid;
  v_cita      uuid;
  v_reg       timestamptz;
  v_ts        timestamptz;
  v_dia       date;
  v_area      smallint;
  v_area_cl   text;
  v_resp      uuid;
  v_tipo      smallint;
  v_asent     integer;
  v_ultima    timestamptz;
  v_estado_ins public.estado_ficha;
  v_n_seg     integer;
begin
  if not exists (select 1 from public.empleado where id = v_uid_ts) then
    return;
  end if;
  if exists (select 1 from public.persona where curp = 'GARL850312MSLRZR01') then
    return;
  end if;

  select id into v_area_ts   from public.cat_area where clave = 'trabajo_social';
  select id into v_area_psic from public.cat_area where clave = 'psicologia';
  select id into v_area_jur  from public.cat_area where clave = 'juridico';

  select id into v_inst_fiscalia from public.directorio_institucion where categoria = 'denuncia' order by id limit 1;
  select id into v_inst_refugio  from public.directorio_institucion where categoria = 'refugio'  order by id limit 1;
  select id into v_inst_salud    from public.directorio_institucion where categoria = 'salud'    order by id limit 1;

  select count(*) into v_n_asent from public.cat_asentamiento;

  for r in
    select * from (values
      -- curp, nombres, ap. paterno, ap. materno, escolaridad, estado ficha, prioridad,
      -- días desde registro, estado civil, ocupación, servicios, agresor (nombres, ap., parentesco, edad),
      -- orden de protección, derivación externa
      ('GARL850312MSLRZR01','Laura Gabriela','García','Ruiz','preparatoria','en_seguimiento','alta',      320,'separado','empleada',   array['trabajo_social','psicologia','juridico'],'Ramón','Leyva','expareja',42,'vigente',   'fiscalia'),
      ('LOPM900725MSLPRR02','María José','López','Pérez','carrera',           'en_seguimiento','media',     290,'casado','empleada',     array['trabajo_social','psicologia'],          'Julio','Sandoval','esposo',38,null,          null),
      ('HEVA781104MSLRLN03','Ana Cristina','Hernández','Valdez','secundaria', 'cerrado','baja',             300,'divorciado','comerciante',array['trabajo_social','juridico'],          'Ernesto','Quiñónez','expareja',51,'vencida', null),
      ('MOCP920218MSLNSL04','Paola','Moreno','Castro','carrera',              'abierto','alta',              6,'union_libre','hogar',    array['trabajo_social','psicologia','juridico'],'Iván','Robles','pareja',33,'en_tramite','refugio'),
      ('RIGD870930MSLVLN05','Diana Laura','Rivera','Gil','preparatoria',      'en_seguimiento','media',     240,'separado','jornalera',  array['trabajo_social','psicologia'],          'Marco','Ochoa','expareja',40,null,           'capacitacion'),
      ('CAMS950601MSLSRR06','Sandra','Castillo','Mora','carrera',             'abierto','media',            12,'soltero','estudiante',   array['trabajo_social','psicologia'],          'Luis Ángel','Bojórquez','conocido',27,null,  null),
      ('TOLR820414MSLRPS07','Rosa Isela','Torres','León','primaria',          'archivado','baja',           275,'casado','hogar',        array['trabajo_social'],                       'Fermín','Soto','esposo',47,null,             'otra_institucion'),
      ('FEJN990120MSLRMN08','Nayeli','Félix','Jiménez','preparatoria',        'en_seguimiento','alta',      180,'union_libre','empleada',array['trabajo_social','psicologia','juridico'],'Óscar','Camacho','pareja',29,'vigente',   'fiscalia'),
      ('VAQG760808MSLLRD09','Guadalupe','Valenzuela','Quintero','secundaria', 'cerrado','media',            250,'viudo','comerciante',   array['trabajo_social','psicologia'],          null,null,null,null,null,                     'otra_institucion'),
      ('AEBK930317MSLRLT01','Karen','Armenta','Beltrán','carrera',            'abierto','baja',              3,'soltero','empleada',     array['trabajo_social'],                       null,null,null,null,null,                     null),
      ('IASM880529MSLBNR02','Mónica','Ibarra','Sánchez','preparatoria',       'en_seguimiento','media',     150,'separado','desempleada',array['trabajo_social','juridico'],            'Gerardo','Lugo','expareja',44,'cancelada',   null),
      ('COLE910902MSLTPL03','Elena','Cota','López','carrera',                 'abierto','alta',             20,'casado','empleada',      array['trabajo_social','psicologia','juridico'],'Arturo','Félix','esposo',36,'vigente',    'refugio'),
      ('BUVY000415MSLLNSA4','Yesenia','Bueno','Vega','preparatoria',          'en_seguimiento',null,        120,'soltero','estudiante',  array['trabajo_social','psicologia'],          'Kevin','Rojo','expareja',26,null,            null),
      ('SAMA830723MSLLRN05','Alejandra','Salas','Medina','secundaria',        'archivado','media',          310,'separado','jornalera',  array['trabajo_social','juridico'],            'Ramiro','Gastélum','expareja',45,'vencida',  null),
      ('OIRT970211MSLLDR06','Teresa','Olivas','Rodríguez','carrera',          'abierto',null,                1,'soltero','empleada',     array['trabajo_social','psicologia'],          null,null,null,null,null,                     null),
      ('PECJ800105MSLRSN07','Josefina','Peña','Cruz','primaria',              'cerrado','baja',             200,'casado','hogar',        array['trabajo_social','psicologia'],          'Andrés','Valdez','esposo',50,null,           'capacitacion'),
      ('DUAV941218MSLRRL08','Verónica','Duarte','Acosta','carrera',           'en_seguimiento','alta',       90,'union_libre','comerciante',array['trabajo_social','psicologia','juridico'],'Jesús','Armenta','pareja',31,'vigente','fiscalia'),
      ('NAGC860627MSLVRR09','Cecilia','Navarro','Gómez','preparatoria',       'en_seguimiento','media',      60,'divorciado','empleada', array['trabajo_social','juridico'],            'Héctor','Inzunza','expareja',41,null,        null),
      ('ZAMI020909MSLMRSA1','Itzel','Zamora','Mendoza','preparatoria',        'abierto','media',             9,'soltero','estudiante',   array['trabajo_social','psicologia'],          'Brandon','Ley','conocido',23,null,           null),
      ('MESL790330MSLDNR02','Lorena','Medina','Soto','secundaria',            'archivado','baja',           330,'casado','hogar',        array['trabajo_social'],                       null,null,null,null,null,                     'otra_institucion')
    ) as t(curp, nombres, ap_pat, ap_mat, escolaridad, estado, prioridad, dias,
           estado_civil, ocupacion, servicios, agr_nombres, agr_ap, agr_parentesco, agr_edad,
           orden, deriv_externa)
  loop
    i := i + 1;
    v_per   := md5('vc-demo-persona-'   || i)::uuid;
    v_dom   := md5('vc-demo-domicilio-' || i)::uuid;
    v_ficha := md5('vc-demo-ficha-'     || i)::uuid;
    v_est   := md5('vc-demo-estudio-'   || i)::uuid;
    v_agr   := md5('vc-demo-agresor-'   || i)::uuid;
    v_reg   := ((v_hoy - r.dias) + time '09:30') at time zone 'America/Mazatlan';
    v_ultima := v_reg;

    select id into v_asent from public.cat_asentamiento
      order by id limit 1 offset ((i * 23) % greatest(v_n_asent, 1));

    -- Persona y domicilio actual
    insert into public.persona (
      id, curp, nombres, apellido_paterno, apellido_materno, celular,
      escolaridad, discapacidad, religion, grupo_etnico, creado_por
    ) values (
      v_per, r.curp, r.nombres, r.ap_pat, r.ap_mat, '66820000' || lpad(i::text, 2, '0'),
      r.escolaridad::public.escolaridad_nivel,
      case when i % 9 = 0 then 'Motriz' else 'Ninguna' end,
      case when i % 4 = 0 then 'Ninguna' else 'Católica' end,
      case when i % 7 = 0 then 'Yoreme Mayo' else 'Ninguno' end,
      v_uid_ts
    );

    insert into public.domicilio (
      id, persona_id, asentamiento_id, calle, numero_exterior, numero_interior,
      referencias, zona, es_actual, creado_por
    ) values (
      v_dom, v_per, v_asent,
      (array['Calle Hidalgo','Av. Álvaro Obregón','Calle Zaragoza','Calle Leyva','Blvd. Centenario',
             'Calle Ángel Flores','Calle Guillermo Prieto','Callejón del Ejido'])[1 + i % 8],
      (100 + i * 37)::text, case when i % 5 = 0 then 'B' end,
      'Casa de demostración (dato ficticio)',
      (case when i % 6 = 0 then 'rural' else 'urbana' end)::public.zona_geografica,
      true, v_uid_ts
    );

    -- Ficha Única. Las archivadas se insertan abiertas y se archivan al
    -- final (los hijos de una ficha archivada están bloqueados).
    v_estado_ins := case when r.estado = 'archivado' then 'cerrado' else r.estado end::public.estado_ficha;

    insert into public.ficha_registro (
      id, persona_id, registrada_en, estado, aviso_privacidad_aceptado_en,
      es_victima_delito, estado_civil, ocupacion_id, tiene_trabajo,
      servicio_medico, numero_hijas, numero_hijos_hombres,
      tiene_embarazo, tiene_denuncia, drogas, consumo_alcohol,
      prioridad, prioridad_actualizada_en, creado_por
    ) values (
      v_ficha, v_per, v_reg, v_estado_ins, v_reg,
      r.agr_nombres is not null,
      r.estado_civil::public.estado_civil,
      (select id from public.cat_ocupacion where clave = r.ocupacion),
      r.ocupacion in ('empleada', 'comerciante', 'jornalera'),
      (array['imss','ninguno','imss_bienestar','issste','particular'])[1 + i % 5]::public.servicio_medico,
      i % 3, (i + 1) % 2,
      i = 6,
      r.orden is not null or r.deriv_externa = 'fiscalia',
      case when i % 8 = 0 then array['marihuana']::public.tipo_droga[] else array['no_consume']::public.tipo_droga[] end,
      (case when i % 5 = 0 then 'ocasional' else 'no_consume' end)::public.consumo_alcohol,
      r.prioridad::public.prioridad_nivel,
      case when r.prioridad is not null then v_reg + interval '1 hour' end,
      v_uid_ts
    );

    insert into public.ficha_servicio_solicitado (ficha_id, area_id, creado_por)
    select v_ficha, a.id, v_uid_ts
    from public.cat_area a
    where a.clave = any (r.servicios);

    -- Estudio socioeconómico (todas menos 1 de cada 5)
    if i % 5 <> 0 then
      insert into public.estudio_socioeconomico (
        id, ficha_id, fecha_estudio, es_actual, ingreso_mensual_propio,
        numero_dependientes, tiene_apoyo, especificacion_apoyo,
        tipo_vivienda, material, servicios, bienes, creado_por
      ) values (
        v_est, v_ficha, (v_reg at time zone 'America/Mazatlan')::date, true,
        case when r.ocupacion in ('hogar', 'estudiante', 'desempleada') then 0 else 4500 + i * 350 end,
        i % 4,
        i % 3 = 0, case when i % 3 = 0 then 'Programa Bienestar' end,
        (array['rentada','propia','infonavit','prestada'])[1 + i % 4]::public.tipo_vivienda,
        (array['block','ladrillo','lamina','madera'])[1 + i % 4]::public.material_vivienda,
        array['agua', 'luz', 'drenaje']::public.servicio_vivienda[],
        array['estufa', 'refrigerador']::public.bien_vivienda[],
        v_uid_ts
      );
    end if;

    -- Persona agresora y orden de protección
    if r.agr_nombres is not null then
      insert into public.agresor (
        id, ficha_id, nombres, apellido_paterno, edad, sexo, estado_civil,
        parentesco_id, asentamiento_id, calle, numero_exterior, zona,
        ocupacion_id, tipo_trabajo, drogas, consumo_alcohol,
        especificacion_arma, observaciones, creado_por
      ) values (
        v_agr, v_ficha, r.agr_nombres, r.agr_ap, r.agr_edad, 'H',
        case when r.agr_parentesco = 'esposo' then 'casado'
             when r.agr_parentesco = 'pareja' then 'union_libre'
             else 'soltero' end::public.estado_civil,
        (select id from public.cat_parentesco where clave = r.agr_parentesco),
        v_asent, 'Calle Juárez', (200 + i)::text, 'urbana',
        (select id from public.cat_ocupacion where clave = (array['empleada','comerciante','jornalera'])[1 + i % 3]),
        (array['fijo','temporal','negocio_propio'])[1 + i % 3]::public.tipo_trabajo,
        case when i % 3 = 0 then array['cristal']::public.tipo_droga[] else array['no_consume']::public.tipo_droga[] end,
        (case when i % 2 = 0 then 'frecuente' else 'ocasional' end)::public.consumo_alcohol,
        case when r.prioridad = 'alta' then 'Arma blanca' end,
        'Dato ficticio para demostración.', v_uid_ts
      );

      if r.orden is not null then
        insert into public.orden_proteccion (
          ficha_id, agresor_id, numero_oficio, autoridad_emisora,
          fecha_emision, fecha_vigencia, estado, creado_por
        ) values (
          v_ficha, v_agr, 'OF-DEMO-' || lpad(i::text, 4, '0'), 'Juzgado de Control de Ahome (demo)',
          case when r.orden in ('vigente', 'en_tramite') then v_hoy - least(r.dias - 1, 20) else v_hoy - (r.dias - 3) end,
          case r.orden
            when 'vigente'    then v_hoy + 40 + i
            when 'en_tramite' then null
            else v_hoy - (r.dias - 63)
          end,
          r.orden::public.estado_orden_proteccion, v_uid_jur
        );
      end if;
    end if;

    -- Atención inicial de Trabajo Social (día de registro)
    insert into public.atencion (
      ficha_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
      estado_civil, ocupacion_id, celular, domicilio_id,
      acciones_realizadas, proxima_accion, observaciones, prioridad, creado_por
    ) values (
      v_ficha, v_area_ts,
      (select id from public.cat_tipo_atencion where clave = 'entrevista_inicial'),
      v_uid_ts, v_reg,
      r.estado_civil::public.estado_civil,
      (select id from public.cat_ocupacion where clave = r.ocupacion),
      '66820000' || lpad(i::text, 2, '0'), v_dom,
      'Apertura de Ficha Única y valoración de riesgo.',
      'Canalizar a las áreas solicitadas.', null,
      r.prioridad::public.prioridad_nivel, v_uid_ts
    );

    -- Primera atención en Psicología / Jurídico con cita asistida (día +2)
    -- y derivación interna desde Trabajo Social.
    foreach v_area_cl in array r.servicios loop
      continue when v_area_cl = 'trabajo_social';
      exit when r.dias < 3;
      v_area := case v_area_cl when 'psicologia' then v_area_psic else v_area_jur end;
      v_resp := case v_area_cl when 'psicologia' then v_uid_psic else v_uid_jur end;
      v_ts   := v_reg + interval '2 days' + case v_area_cl when 'psicologia' then interval '1 hour' else interval '3 hours' end;
      v_cita := md5('vc-demo-cita-ini-' || i || '-' || v_area_cl)::uuid;

      insert into public.derivacion (
        ficha_id, area_origen_id, area_destino_id, destino, motivo,
        fecha_derivacion, estado, creado_por
      ) values (
        v_ficha, v_area_ts, v_area, v_area_cl::public.destino_derivacion,
        case v_area_cl when 'psicologia' then 'Atención psicológica por violencia familiar'
                       else 'Asesoría jurídica y medidas de protección' end,
        (v_reg at time zone 'America/Mazatlan')::date,
        'concluida', v_uid_ts
      );

      insert into public.cita (
        id, persona_id, area_id, programada_en, recomendada_por, estado,
        confirmada_en, origen, creado_por
      ) values (
        v_cita, v_per, v_area, v_ts, 'Trabajo Social', 'asistio',
        v_ts - interval '1 day', 'regular', v_uid_recep
      );

      insert into public.atencion (
        ficha_id, cita_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
        celular, domicilio_id, acciones_realizadas, proxima_accion, prioridad, creado_por
      ) values (
        v_ficha, v_cita, v_area,
        (select id from public.cat_tipo_atencion
          where clave = case v_area_cl when 'psicologia' then 'valoracion_inicial' else 'asesoria_juridica' end),
        v_resp, v_ts,
        '66820000' || lpad(i::text, 2, '0'), v_dom,
        case v_area_cl when 'psicologia' then 'Valoración inicial y plan de seguridad.'
                       else 'Orientación sobre denuncia y orden de protección.' end,
        'Seguimiento quincenal.', r.prioridad::public.prioridad_nivel, v_resp
      );
      v_ultima := greatest(v_ultima, v_ts);
    end loop;

    -- Seguimientos mensuales (hasta 4) en las áreas del expediente, para
    -- que Estadísticas tenga atenciones repartidas en varios meses.
    v_n_seg := least(4, (r.dias - 5) / 30);
    for k in 1 .. greatest(v_n_seg, 0) loop
      v_area_cl := r.servicios[1 + (k % cardinality(r.servicios))];
      v_area := case v_area_cl when 'psicologia' then v_area_psic when 'juridico' then v_area_jur else v_area_ts end;
      v_resp := case v_area_cl when 'psicologia' then v_uid_psic when 'juridico' then v_uid_jur else v_uid_ts end;
      v_ts   := v_reg + make_interval(days => k * 30) + make_interval(hours => k % 4);
      v_cita := md5('vc-demo-cita-seg-' || i || '-' || k)::uuid;
      v_tipo := (select id from public.cat_tipo_atencion
                  where clave = case v_area_cl
                                  when 'psicologia' then (array['terapia_individual','intervencion_crisis'])[1 + k % 2]
                                  when 'juridico'   then (array['acompanamiento_fiscalia','tramite_orden_proteccion'])[1 + k % 2]
                                  else (array['orientacion','acompanamiento','canalizacion'])[1 + k % 3] end);

      -- Una de cada 5 citas de seguimiento: no asistió (sin atención)
      if (i + k) % 5 = 0 then
        insert into public.cita (id, persona_id, area_id, programada_en, recomendada_por, estado, origen, creado_por)
        values (v_cita, v_per, v_area, v_ts, 'Seguimiento', 'no_asistio', 'regular', v_uid_recep);
        continue;
      end if;

      insert into public.cita (
        id, persona_id, area_id, programada_en, recomendada_por, estado,
        confirmada_en, origen, creado_por
      ) values (
        v_cita, v_per, v_area, v_ts, 'Seguimiento', 'asistio',
        v_ts - interval '1 day',
        (case when v_area_cl = 'juridico' and i % 4 = 1 then 'umeca' else 'regular' end)::public.origen_cita,
        v_uid_recep
      );

      insert into public.atencion (
        ficha_id, cita_id, area_id, tipo_atencion_id, atendida_por, atendida_en,
        celular, domicilio_id, acciones_realizadas, proxima_accion, observaciones, prioridad, creado_por
      ) values (
        v_ficha, v_cita, v_area, v_tipo, v_resp, v_ts,
        '66820000' || lpad(i::text, 2, '0'), v_dom,
        'Sesión de seguimiento ' || k || '.',
        case when r.estado in ('cerrado', 'archivado') and k = v_n_seg
             then 'Cierre del caso por cumplimiento de objetivos.' else 'Continuar acompañamiento.' end,
        null,
        case when k = v_n_seg then r.prioridad::public.prioridad_nivel end,
        v_resp
      );
      v_ultima := greatest(v_ultima, v_ts);
    end loop;

    -- Cita cancelada reciente (algunos expedientes activos)
    if r.estado in ('abierto', 'en_seguimiento') and i % 4 = 2 and r.dias > 8 then
      v_ts := ((v_hoy - 4) + time '11:00') at time zone 'America/Mazatlan';
      insert into public.cita (persona_id, area_id, programada_en, recomendada_por, estado, motivo_cancelacion, origen, creado_por)
      values (v_per, v_area_ts, v_ts, 'Recepción', 'cancelada', 'La usuaria avisó que no podía asistir.', 'regular', v_uid_recep);
    end if;

    -- Citas futuras para Agenda (próximos ~2 semanas, días hábiles).
    -- Prioridad alta con i impar: sin cita futura -> Lista de urgencias.
    if r.estado in ('abierto', 'en_seguimiento')
       and not (r.prioridad = 'alta' and i % 2 = 1) then
      for k in 0 .. (case when cardinality(r.servicios) > 1 then 1 else 0 end) loop
        v_area_cl := r.servicios[cardinality(r.servicios) - k];
        v_area := case v_area_cl when 'psicologia' then v_area_psic when 'juridico' then v_area_jur else v_area_ts end;
        v_dia  := v_hoy + 1 + ((i * 3 + k * 5) % 12);
        v_dia  := v_dia + case extract(isodow from v_dia)::int when 6 then 2 when 7 then 1 else 0 end;
        v_ts   := (v_dia + make_time(9 + (i + k * 2) % 6, case when i % 2 = 0 then 0 else 30 end, 0))
                  at time zone 'America/Mazatlan';
        insert into public.cita (
          persona_id, area_id, programada_en, recomendada_por, estado,
          confirmada_en, origen, creado_por
        ) values (
          v_per, v_area, v_ts,
          case when v_area_cl = 'juridico' and i % 3 = 0 then 'UMECA' else 'Seguimiento' end,
          (case when (i + k) % 3 = 0 then 'confirmada' else 'agendada' end)::public.estado_cita,
          case when (i + k) % 3 = 0 then now() end,
          (case when v_area_cl = 'juridico' and i % 3 = 0 then 'umeca' else 'regular' end)::public.origen_cita,
          v_uid_recep
        );
      end loop;
    end if;

    -- Canalización externa
    if r.deriv_externa is not null then
      insert into public.derivacion (
        ficha_id, area_origen_id, institucion_id, destino, institucion_otra,
        motivo, fecha_derivacion, estado, creado_por
      ) values (
        v_ficha,
        case when r.deriv_externa = 'fiscalia' then v_area_jur else v_area_ts end,
        case r.deriv_externa when 'fiscalia' then v_inst_fiscalia
                             when 'refugio'  then v_inst_refugio
                             when 'otra_institucion' then case when i % 2 = 0 then v_inst_salud end
                             end,
        r.deriv_externa::public.destino_derivacion,
        case when r.deriv_externa = 'capacitacion' then 'ICATSIN Los Mochis (demo)'
             when r.deriv_externa = 'otra_institucion' and i % 2 = 1 then 'DIF Municipal Ahome (demo)' end,
        case r.deriv_externa
          when 'fiscalia' then 'Acompañamiento para presentar denuncia'
          when 'refugio'  then 'Riesgo alto: resguardo temporal'
          when 'capacitacion' then 'Capacitación para el empleo'
          else 'Atención complementaria fuera de competencia' end,
        (v_reg at time zone 'America/Mazatlan')::date + least(r.dias - 1, 3),
        (case when r.estado in ('cerrado', 'archivado') then 'concluida'
              when r.deriv_externa = 'refugio' then 'en_proceso'
              when i % 2 = 0 then 'pendiente'
              else 'en_proceso' end)::public.estado_derivacion,
        v_uid_ts
      );
    end if;

    -- Historial clínico y notas privadas por área
    if 'psicologia' = any (r.servicios) and r.dias >= 3 then
      insert into public.historial_clinico (
        ficha_id, antecedentes_familiares, antecedentes_personales,
        motivo_consulta, observaciones_iniciales, tiene_atencion_psicologica_previa, creado_por
      ) values (
        v_ficha,
        'Red de apoyo familiar ' || case when i % 2 = 0 then 'limitada.' else 'presente.' end,
        'Sin antecedentes psiquiátricos reportados.',
        'Ansiedad y miedo asociados a situación de violencia (dato ficticio).',
        'Se acuerda plan de seguridad.', i % 3 = 0, v_uid_psic
      );
      insert into public.nota_area (ficha_id, area_id, contenido, creado_por)
      values (v_ficha, v_area_psic, 'Nota privada de Psicología (demo): reforzar red de apoyo.', v_uid_psic);
    end if;

    if 'juridico' = any (r.servicios) and r.dias >= 3 then
      insert into public.nota_area (ficha_id, area_id, contenido, creado_por)
      values (v_ficha, v_area_jur, 'Nota de Jurídico (demo): revisar estatus de carpeta de investigación.', v_uid_jur);
    end if;

    -- Alertas por teléfono / presencial
    if i % 3 = 0 or r.prioridad = 'alta' then
      insert into public.alerta (
        persona_id, origen, asentamiento_id, prioridad, estado,
        tomada_en, atendida_en, atendida_por, observaciones, creado_en, creado_por
      ) values (
        v_per,
        (case when i % 2 = 0 then 'telefono' else 'presencial' end)::public.origen_alerta,
        v_asent,
        coalesce(r.prioridad, 'media')::public.prioridad_nivel,
        (case when r.estado in ('cerrado', 'archivado') or i % 3 = 0 then 'atendida'
              when i % 4 = 0 then 'tomada' else 'nueva' end)::public.estado_alerta,
        case when r.estado in ('cerrado', 'archivado') or i % 3 = 0 or i % 4 = 0
             then least(now(), v_reg + interval '1 day') end,
        case when r.estado in ('cerrado', 'archivado') or i % 3 = 0
             then least(now(), v_reg + interval '1 day 2 hours') end,
        case when r.estado in ('cerrado', 'archivado') or i % 3 = 0 then v_uid_subdir end,
        'Alerta de demostración.',
        least(now() - interval '30 minutes', v_reg + interval '20 hours'),
        v_uid_recep
      );
    end if;

    -- Archivar al final
    if r.estado = 'archivado' then
      update public.ficha_registro
      set estado         = 'archivado',
          motivo_archivo = 'Sin contacto de la usuaria por más de 6 meses (demo).',
          archivada_en   = least(now(), v_ultima + interval '30 days'),
          archivada_por  = v_uid_titular
      where id = v_ficha;
    end if;
  end loop;
end;
$$;
