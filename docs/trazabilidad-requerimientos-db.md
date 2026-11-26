# Trazabilidad Técnica: Requerimientos y Reglas de Negocio en Base de Datos

Especificación técnica que vincula los requerimientos ([requerimientos-y-reglas.md](./requerimientos-y-reglas.md)) y el alcance ([alcance-mvp.md](./alcance-mvp.md)) con los componentes, restricciones y reglas prioritarias de la base de datos (`supabase/migrations/`) y las capas de aplicación.

---

## 1. Criterios técnicos y de negocio prioritarios

1. **Seguridad y aislamiento por rol en base de datos (`RNF-02`, `RNF-02.1`, `RNF-07`, `RF-21`, `RF-21.1`, `RN-04`, `RN-08`, `RN-09`, `RN-16`, `RN-18`, `RN-18.1`):** los permisos viven en PostgreSQL mediante RLS híbrido **RBAC + ABAC** (`07_rls.sql`, detallado en [roles-y-permisos.md](../supabase/doc-supabase/roles-y-permisos.md)) sin depender de lógica de cliente ni usar `service_role` en web o móvil (`RNF-03.1`), sujeto a criterios **LGPDPPSO** ([seguridad-y-privacidad.md](../supabase/doc-supabase/seguridad-y-privacidad.md)).
2. **Datos sintéticos reproducibles (`RNF-01`, `RNF-01.1`, `RNF-10`):** el entorno de pruebas y demostración debe poblarse mediante `supabase/seed.sql` determinista con identidades sintéticas y cero datos reales.
3. **Identificación única y folio automático (`RF-02`, `RF-04`, `RN-02`, `RN-12`, `RN-12.1`):** la CURP es llave única en `persona` (con columnas calculadas `sexo`, `fecha_nacimiento` y `entidad_nacimiento`) y el expediente (`ficha_registro`) genera folio automático `SEM-AAAA-NNNN` vía `ficha_folio_seq`, admitiendo folio explícito para importaciones históricas (`RF-23`).
4. **Restricción de edad en Psicología y Jurídico (`RN-01`):** `cita` y `atencion` validan mediante trigger (`validar_mayoria_edad_area()`) que la persona cuente con al menos 18 años cumplidos para dichas áreas, manteniendo libre acceso en Trabajo Social.
5. **Confidencialidad de refugios (`RF-30`, `RF-30.1`):** `directorio_institucion` prohíbe a nivel `CHECK` cualquier campo de ubicación cuando `categoria = 'refugio'`; la aplicación móvil debe respetar estrictamente esta regla sin excepciones.
6. **Criterio estadístico de «Primera vez» (`RF-13`, `RN-19`):** `vista_informe_mensual` y `vista_informe_anual` determinan primera vez por primera atención de la persona en cada área (`(persona_id, area_id)`), sin exponer CURP ni nombres.

---

## 2. Trazabilidad de Requerimientos Funcionales (`RF-01` a `RF-35`)

| ID | Requerimiento | Alcance | Componente en BD / Capa responsable |
|---|---|---|---|
| **RF-01** | Ficha Única digital, servicio, escolaridad, estudio y vivienda | MVP Web | `persona` (CURP calculada), `domicilio`, `ficha_registro`, `ficha_servicio_solicitado`, `estudio_socioeconomico`, `aportante_hogar`. |
| **RF-02** | Folio automático | MVP Web | `ficha_folio_seq`, `generar_folio_ficha()`, trigger `ficha_registro_folio_auto` (`SEM-AAAA-NNNN`). |
| **RF-03** | Búsqueda por CURP, nombre o folio en historial | MVP Web | Índices `persona_curp_key`, `ficha_registro_folio_key` e índices GIN `pg_trgm` en `persona` y `agresor`. |
| **RF-04** | Aviso de posibles duplicados por CURP | MVP Web | `persona.curp unique`, `pre_registro_curp_activo_uidx` y RPC `buscar_pre_registro_por_curp()`. |
| **RF-05** | Datos de persona agresora, dirección y bitácora de consulta | MVP Web | `agresor` (nombre desglosado + domicilio estructurado) + RLS (`07_rls.sql`) + RPC `registrar_consulta()`. |
| **RF-06** | Agenda TS y Psicología con estados y citas de mañana | MVP Web | `cita` (`estado_cita`, `recomendada_por`, `confirmada_en`, índice `cita_programada_en_idx`). |
| **RF-07** | Lista de urgencias al cancelar una cita | MVP Web | `vista_lista_urgencias` (`atencion.prioridad` editable, sin cita futura confirmada/agendada). |
| **RF-08** | Canalización interna o externa | MVP Web | `derivacion` (`destino_derivacion`, `area_destino_id`, `institucion_id`, `institucion_otra`, `validar_derivacion_area()`). |
| **RF-09** | Seguimiento por cita | MVP Web | `atencion` (`cita_id`, `acciones_realizadas`, `proxima_accion`, copia histórica de datos generales). |
| **RF-10** | Notas privadas por área | MVP Web | `nota_area` aislada estrictamente por `area_id` mediante RLS (`07_rls.sql`). |
| **RF-11** | Historial clínico de psicología | MVP Web | `historial_clinico` con acceso restringido a `psicologia` y Dirección en RLS. |
| **RF-12, RF-12.1** | Dictado por voz seguro para historial clínico | MVP Web | Capa Frontend (motor de voz *on-device* o *Zero Data Retention*, sin dictar CURP/nombres); persiste en `historial_clinico`. |
| **RF-13, RF-13.1** | Informes mensual y anual exportables sin PII | MVP Web | `vista_informe_mensual` y `vista_informe_anual`; exportación `CSV`/`XLSX` en Web sin PII ni inyección de fórmulas. |
| **RF-14** | Tablero con avance de meta anual (1,300–1,500) | Fuera del MVP | Agregación futura sobre `ficha_registro` y `atencion`. |
| **RF-15** | Mapa de calor por colonia y sectores | Fuera del MVP | `cat_asentamiento` (451 colonias Ahome) y RPC `get_mapa_calor_asentamiento()`. |
| **RF-16** | Actividades preventivas | MVP Web | `cat_tipo_actividad`, `actividad_preventiva` (`sede`, `direccion`, `referencias`, `asentamiento_id`) y `actividad_empleado`. |
| **RF-17** | Órdenes de protección | MVP Web | `orden_proteccion` (`numero_oficio`, `autoridad_emisora`, `fecha_emision`, `fecha_vigencia`, `estado`, vínculo en `documento`) + `tiene_orden_vigente()`. |
| **RF-18, RF-18.1** | Botón de ayuda móvil y prioridad en servidor | MVP Móvil/Web | `alerta` + trigger `asignar_prioridad_alerta()` + `supabase_realtime` + RLS móvil; pulsación/cuenta regresiva en App Android. |
| **RF-19** | Solicitud de cita desde app móvil (18+) | Fuera del MVP | Reutiliza `cita` y validación `RN-01` a futuro. |
| **RF-20** | Cola de alertas ordenada por prioridad y origen | MVP Web | `alerta` (`prioridad_nivel`, `origen_alerta`, `alerta_cola_idx`, `asignar_prioridad_alerta()`). |
| **RF-21, RF-21.1** | Siete roles y autorización en BD (incl. UMECA) | MVP Web | `rol_empleado` (6 roles internos), `usuario_externo` (`umeca`), RLS RBAC+ABAC (`07_rls.sql`) y `get_umeca_citas()`. |
| **RF-22, RF-22.1** | Bitácora inmutable de cambios y consultas | MVP Web | `bitacora_acceso` + triggers `registrar_cambio()` + RPC `registrar_consulta()` + RLS solo lectura para Dirección. |
| **RF-23** | Importación de datos históricos CSV/Excel | Si alcanza | Proceso de carga respetando catálogos, `CHECK`s y folios explícitos en `ficha_registro`. |
| **RF-24** | Estado `archivado` en lugar de borrar | MVP Web | `estado_ficha = 'archivado'`, `activo boolean` y `ON DELETE RESTRICT` en todas las FKs. |
| **RF-25** | Línea de tiempo del caso (notas privadas) | MVP Web | Lectura cronológica combinada de `cita`, `atencion`, `derivacion` y `orden_proteccion`; `nota_area` privada por área. |
| **RF-26, RF-26.1** | Violentómetro de 0 a 30 sin rastro | MVP Móvil | Lógica nativa en App Android sin persistir respuestas ni puntajes sin consentimiento expreso. |
| **RF-27** | Canal de apoyo mensajes a psicología | Si alcanza | Tabla opcional `mensaje_apoyo` (usuaria → psicología, sin chat en vivo). |
| **RF-28** | Bandeja de mensajes para psicología | Si alcanza | Consulta/respuesta/escalamiento sobre `mensaje_apoyo` hacia `alerta`. |
| **RF-29, RF-29.1** | Botón «Salir rápido» y `FLAG_SECURE` | MVP Móvil | Implementación nativa en App Android (cierre, remoción de recientes y `FLAG_SECURE`). |
| **RF-30, RF-30.1** | Orientación y directorio sin direcciones de refugios | MVP Móvil | `directorio_institucion` con `CHECK` prohibitivo de dirección para `categoria = 'refugio'`. |
| **RF-31** | «Mis alertas» con estado en móvil | Fuera del MVP | Soportado por `alerta.pre_registro_id`, `alerta.estado` y RLS de consulta propia. |
| **RF-32** | Registro de alertas por teléfono/presencial (24/7) | Si alcanza | `alerta.origen` (`telefono`, `presencial`) y políticas RLS de línea 24/7 (`titular`, `subdireccion`, `juridico`). |
| **RF-33, RF-33.1** | Registro móvil, anti-enumeración y liga silenciosa | MVP Móvil | `pre_registro` (con columnas generadas de CURP) + trigger `ligar_pre_registro_al_crear()` + RLS aislada. |
| **RF-34** | Aviso y precarga por CURP en Ficha Única | MVP Web | Trigger `ligar_persona_con_pre_registro()` + RPC `buscar_pre_registro_por_curp()`. |
| **RF-35, RF-35.1** | Adjuntar INE, foto y órdenes en bucket privado | MVP Web | `cat_tipo_documento`, `documento` (link opcional a `orden_proteccion`) y bucket privado `documentos` vía URLs firmadas. |

---

## 3. Trazabilidad de Requerimientos No Funcionales y Reglas de Negocio

| ID | Criterio / Regla | Componente y mecanismo de cumplimiento |
|---|---|---|
| **RNF-01, RNF-01.1, RNF-10** | Datos sintéticos reproducibles y cero datos reales | Script determinista `supabase/seed.sql` + exclusiones de `data/real/`, `.env*` y dumps en `.gitignore`. |
| **RNF-02, RNF-02.1, RNF-07** | LGPDPPSO, cifrado en 3 capas, permisos en BD y bitácora | Políticas RBAC+ABAC en `07_rls.sql`, `bitacora_acceso`, informes sin PII, SEPOMEX local y guía [seguridad-y-privacidad.md](../supabase/doc-supabase/seguridad-y-privacidad.md). |
| **RNF-03, RNF-03.1** | HTTPS, expiración de sesión y prohibición de `service_role` | Supabase Auth sobre TLS 1.2/1.3 con expiración por inactividad y llaves públicas (`anon` + JWT) únicamente en clientes. |
| **RNF-04** | Aviso de privacidad y consentimiento registrado | Columnas `NOT NULL` `aviso_privacidad_aceptado_en` en `ficha_registro` y `pre_registro`. |
| **RN-01** | Psicología y Jurídico solo 18+ años | Trigger `validar_mayoria_edad_area()` en `cita` y `atencion` usando `persona.fecha_nacimiento`. |
| **RN-02** | Una persona, un expediente único | Restricciones `UNIQUE` en `persona.curp` y `ficha_registro.persona_id`. |
| **RN-03** | Trabajo Social atiende hombres; canaliza si no es jurídico | `persona.sexo` (`H`/`M`) + `derivacion` hacia `otra_institucion`. |
| **RN-04** | Recepción solo agenda TS y Psicología; Jurídico directo | Políticas RLS en `cita` (`07_rls.sql`) restringiendo `recepcion` a áreas `trabajo_social` y `psicologia`. |
| **RN-08, RN-09, RN-18, RN-18.1** | Visibilidad compartida de Ficha Única vs. notas privadas | Políticas RLS diferenciadas en `ficha_registro`, `historial_clinico`, `atencion`, `agresor` y aislamiento estricto por `area_id` en `nota_area`. |
| **RN-12, RN-12.1** | Formato y generación automática de folio | `ficha_folio_seq`, `generar_folio_ficha()` (`SEM-AAAA-NNNN`) y folio explícito permitido en importaciones históricas. |
| **RN-15, RN-15.1** | Archivo histórico, baja lógica y derechos ARCO | `ON DELETE RESTRICT`, `activo = false` y `estado_ficha = 'archivado'` sin eliminación física. |
| **RN-16, RN-17** | Línea 24/7 y elevación automática de alertas | Helpers `es_linea_24_7()` en `07_rls.sql` y trigger `asignar_prioridad_alerta()` + `tiene_orden_vigente()`. |
