# Requerimientos y reglas de negocio — SEMUJERES Ahome

## Requerimientos funcionales

- **RF-01 (Web, Alta, N03):** Ficha Única digital: datos generales, servicio, escolaridad, estudio socioeconómico y vivienda. La crea Trabajo Social y la ven las tres áreas. Fecha de nacimiento, sexo y entidad salen de la CURP.
- **RF-02 (Web, Media, N03):** Folio automático.
- **RF-03 (Web, Alta, N01):** Buscar por CURP, nombre o folio en todo el historial.
- **RF-04 (Web, Alta, N02):** Avisar de posibles duplicados al registrar con la CURP.
- **RF-05 (Web, Media, N03):** Datos de la persona agresora ligados a la ficha; solo las tres áreas y la dirección; cada consulta se registra.
- **RF-06 (Web, Alta, N05):** Agenda de Trabajo Social y Psicología: tipo, fecha y hora, quién recomendó y estado (`agendada`, `confirmada`, `cancelada`, `reagendada`, `asistió`, `no asistió`), dejando las citas de mañana por confirmar.
- **RF-07 (Web, Media, N05 y N19):** Lista de urgencias para llamar y reagendar cuando se cancela una cita. Se arma con los expedientes abiertos o en seguimiento cuya prioridad más reciente es alta y que no tengan ya una cita próxima. La prioridad (`alta`, `media` o `baja`, opcional) se registra en la Ficha de Seguimiento y se puede editar.
- **RF-08 (Web, Alta, N03):** Canalizar a la instancia que se requiera (`jurídico`, `psicología`, `fiscalía`, `refugio` o `capacitación`).
- **RF-09 (Web, Alta, N04):** Seguimiento por cita: asistencia, qué se hizo, próxima acción y próxima cita.
- **RF-10 (Web, Alta, N06):** Notas privadas por área; solo las ve esa área.
- **RF-11 (Web, Media, N14):** Historial clínico de psicología: datos personales, antecedentes familiares y motivo de consulta.
- **RF-12 (Web, Media, N14):** Dictado por voz que llena el historial clínico (Edgar).
  - **RF-12.1 (Seguridad de voz):** El dictado por voz debe ejecutarse *on-device* o mediante proveedor con política explícita de cero retención (*Zero Data Retention*), evitando dictar CURP o nombres propios en el audio.
- **RF-13 (Web, Alta, N07):** Informes mensual y anual por área: primera vez y seguimiento, hombres y mujeres, exportables.
  - **RF-13.1 (Exportación segura y disociada):** Los archivos exportados (`CSV`/`XLSX`) contienen exclusivamente conteos agregados (sin CURP, nombres ni domicilios) y neutralizan inyección de fórmulas (`=`, `+`, `-`, `@`).
- **RF-14 (Web, Baja, N08):** **FUERA DEL MVP.** Tablero con avance de la meta anual (1,300 a 1,500).
- **RF-15 (Web, Baja, N09):** **FUERA DEL MVP.** Mapa de calor por colonia y capa de sectores visitados y por atender.
- **RF-16 (Web, Media, N10):** Registrar actividades preventivas: tipo de charla, lugar, colonia, fecha y asistentes.
- **RF-17 (Web, Media, N11):** Órdenes de protección.
- **RF-18 (Móvil y web, Alta, N12 y N19):** Botón de ayuda: pulsación de 2 segundos, cuenta regresiva y Cancelar. Crea una alerta simulada en la cola. Si la persona tiene orden de protección vigente, sube a prioridad alta.
  - **RF-18.1 (Integridad de prioridad en servidor):** La aplicación móvil solo registra alertas con origen `app_movil`; la elevación a prioridad `alta` por orden vigente ocurre exclusivamente en servidor sin revelar en la app si existe expediente u orden activa.
- **RF-19 (Móvil, Baja, N13):** **FUERA DEL MVP.** Solicitud de cita desde la app (18 años o más).
- **RF-20 (Web, Alta, N12 y N19):** Cola de alertas ordenada por prioridad (`alta`, `media` o `baja`), con su origen: `app móvil`, `teléfono` o `presencial`. Una alerta que viene de la app entra con prioridad `media`; si la persona está ligada a un expediente con orden de protección vigente, entra con prioridad `alta`.
- **RF-21 (Web, Alta, N06):** Siete roles: trabajo social, psicología, jurídico (con su propia agenda), recepcionista (pura agenda), subdirección y titular, más el rol de consulta de solo lectura para UMECA, con su propia pantalla de inicio al iniciar sesión.
  - **RF-21.1 (Autorización en base de datos):** Todo control de acceso vive en PostgreSQL (RLS híbrido RBAC + ABAC) y la desactivación de cuenta (`activo = false`) revoca el acceso de inmediato; UMECA accede exclusivamente mediante RPC auditado.
- **RF-22 (Web, Alta, N06):** Bitácora de cambios y de consultas de expedientes; no se puede editar desde la app.
  - **RF-22.1 (Inmutabilidad de bitácora):** `bitacora_acceso` admite solo lectura para Dirección (`titular` y `subdireccion`), sin permisos de inserción directa, actualización o eliminación desde clientes.
- **RF-23 (Web, Media, N01):** **SI ALCANZA.** Importación de datos históricos desde un archivo CSV o Excel.
- **RF-24 (Web, Baja, N16):** Estado «archivado» en lugar de borrar.
- **RF-25 (Web, Alta, N04):** Línea de tiempo del caso (citas, atenciones, derivaciones y seguimientos), según el rol; las notas siguen privadas.
- **RF-26 (Móvil, Media, N22):** Violentómetro de 0 a 30 con tres zonas. Es orientativo, no guarda el resultado sin permiso y en zonas altas ofrece el botón de ayuda.
  - **RF-26.1 (Cero rastro sin consentimiento):** Las respuestas y puntajes del violentómetro no se persisten localmente ni en base de datos sin consentimiento expreso de la usuaria.
- **RF-27 (Móvil, Media, N23):** **SI ALCANZA.** Canal de apoyo para escribir a psicología (mensajes, no chat en vivo), con aviso de que no es para emergencias.
- **RF-28 (Web, Media, N23):** **SI ALCANZA.** Bandeja de mensajes para psicología: ver, responder, marcar como atendido y escalar a alertas.
- **RF-29 (Móvil, Alta, N24):** «Salir rápido»: cierra la app y la quita de recientes; siempre visible.
  - **RF-29.1 (Protección visual en Android):** Aplicar `FLAG_SECURE` en pantallas sensibles de la aplicación móvil para impedir capturas de pantalla y ocultar la vista previa en el selector de aplicaciones recientes.
- **RF-30 (Móvil, Media, N24):** Orientación y directorio fijos (tipos de violencia, dónde acudir, teléfonos); sin direcciones de refugios.
  - **RF-30.1 (Bloqueo estricto de direcciones de refugios):** Las dependencias públicas del directorio admiten domicilio estructurado opcional, pero la base de datos y las interfaces prohíben estrictamente almacenar o mostrar cualquier dato de ubicación cuando la categoría sea `refugio`.
- **RF-31 (Móvil, Media, N24):** **FUERA DEL MVP.** «Mis alertas» con su estado (`enviada`, `tomada`, `atendida`).
- **RF-32 (Web, Media, N12):** **SI ALCANZA.** Registro de alertas que llegan por teléfono o en persona a cargo de los responsables o encargados de la línea 24/7 (hoy titular, subdirección y jurídico), con su origen.
- **RF-33 (Móvil, Alta, N26):** Registro en la app con correo y contraseña (la CURP se captura en el registro junto con nombres y apellidos, pero no sirve para iniciar sesión). Fecha de nacimiento, sexo y entidad salen de la CURP. La usuaria puede usar solamente el botón de ayuda y las demás funciones de la app sin ir nunca a SEMUJERES. Si ya tiene expediente con esa CURP, se liga automáticamente sin revelar en la app si la CURP ya tenía expediente.
  - **RF-33.1 (Anti-enumeración):** El registro, inicio de sesión y recuperación en móvil emiten respuestas genéricas que nunca revelan si una CURP o correo cuenta con expediente previo.
- **RF-34 (Web, Media, N26):** Aviso y búsqueda por CURP dentro de la Ficha Única de Registro: al capturar la CURP en la Ficha Única, el sistema avisa «Esta persona ya está registrada» si ya tiene expediente, y no crea otro. Si tiene un registro hecho desde la app, precarga sus datos para confirmarlos y los liga al expediente, sin duplicar.
- **RF-35 (Web, Media, N15):** La copia de la INE y la foto se adjuntan como archivos dentro de la Ficha Única de Registro del expediente.
  - **RF-35.1 (Resguardo privado y vínculo con órdenes):** Los adjuntos (incluyendo copias ligadas directamente a cada `orden_proteccion`) residen en bucket privado (`<= 10 MB`, `JPG`/`PNG`/`PDF`) protegido por RLS y accesible únicamente mediante URLs firmadas temporales.

---

## Requerimientos no funcionales

- **RNF-01 (Alta):** Datos de ejemplo, sintéticos y en poca cantidad, solo unos cuantos, para mostrar el sistema: se generan con un script que siempre produce los mismos, por regla de la convocatoria.
  - **RNF-01.1 (Aislamiento de datos reales):** Queda prohibido usar o versionar datos reales, respaldos de producción o archivos `.env` en entornos locales, repositorios o demostraciones.
- **RNF-02 (Alta):** Proteger datos sensibles. La seguridad principal son los permisos por rol y la bitácora. Si alcanza, cifrar notas, observaciones y mensajes. La CURP la ven los cinco roles con bitácora y nunca aparece en informes.
  - **RNF-02.1 (Cumplimiento LGPDPPSO y cifrado en 3 capas):** El tratamiento se sujeta a la LGPDPPSO (y LFPDPPP para encargados) mediante defensa en profundidad: TLS 1.2/1.3 en tránsito, AES-256 en reposo con URLs firmadas para adjuntos y cifrado selectivo por columna (`pgcrypto` + Vault/KMS) para narrativas clínicas, evitando E2EE puro por continuidad institucional; catálogo geográfico 100% local (*Zero-Network*) y prohibición de PII en logs o telemetría.
- **RNF-03 (Alta):** HTTPS, contraseñas con hash y sesiones que expiran.
  - **RNF-03.1 (Expiración de sesión y llaves):** Configurar expiración por inactividad en equipos compartidos de oficina y prohibir el uso de la llave `service_role` en clientes web o móviles.
- **RNF-04 (Media):** Aviso de privacidad en la ficha y consentimiento registrado.
- **RNF-05 (Media):** Pocos pasos y lenguaje sencillo; medir cuánto tarda la ficha digital frente al papel.
- **RNF-06 (Alta):** Móvil como app Android nativa (Kotlin y Jetpack Compose), con inicio de sesión por correo y contraseña, web en el navegador de la computadora y demo en local.
- **RNF-07 (Media):** Supabase da base, autenticación y API; los permisos viven en la base.
- **RNF-09 (Media):** Textos grandes, buen contraste y salida rápida.
- **RNF-10 (Media):** Respaldo para la demo: datos reproducibles, ensayo y video corto solo para emergencias.

*(Nota: la numeración original pasa de `RNF-07` a `RNF-09`.)*

---

## Reglas de negocio

- **RN-01:** Citas y servicios de psicología y jurídico solo para personas de 18 años o más.
- **RN-02:** Una persona, un solo expediente; la CURP lo identifica y evita duplicados.
- **RN-03:** Trabajo Social también atiende hombres. Si es un hombre y no es tema jurídico, se canaliza a otra institución.
- **RN-04:** Recepción solo gestiona citas de Trabajo Social y Psicología; jurídico agenda directo.
- **RN-05:** Las citas procuran ser una vez al mes; al terminar se agenda la siguiente.
- **RN-06:** La cita se confirma un día antes; si se cancela, se reagenda y se llama a alguien con urgencia.
- **RN-07:** Psicología atiende a mayores de edad y población LGBTQ+.
- **RN-08:** La Ficha Única la crea Trabajo Social. Todos los datos del formulario de ficha única de registro serán consultables por las tres áreas.
- **RN-09:** Las notas de cada área son personales entre áreas (solo las ve y edita la propia área); Titular y Subdirección pueden consultarlas en solo lectura.
- **RN-10:** Hay prioridad según la magnitud del caso y un «código 100» para emergencias (por investigar).
- **RN-11:** Protocolo: cita, trabajo social, jurídico y/o psicología, acompañamiento a fiscalía si hace falta, refugio si es muy vulnerable.
- **RN-12:** El folio lo crea SEMUJERES (formato por inventar).
  - **RN-12.1 (Formato y generación automática de folio):** El folio institucional sigue el formato `SEM-AAAA-NNNN` generado automáticamente en servidor (`RF-02`), admitiendo folio explícito únicamente en importación de registros históricos (`RF-23`).
- **RN-13:** Cada visita genera una hoja de seguimiento. Debe ser otro formulario, el seguimiento o un botón dentro del expediente.
- **RN-15:** Con los años se depura la información; nosotros archivamos.
  - **RN-15.1 (Baja lógica y derechos ARCO):** Prohibido el borrado físico (`ON DELETE RESTRICT`); toda depuración o bloqueo por ejercicio de derechos ARCO se realiza mediante `activo = false` o estado `archivado` conservando la trazabilidad en bitácora.
- **RN-16:** La línea 24/7 la atienden titular, subdirección y jurídico.
- **RN-17:** Una alerta de una persona con orden de protección vigente entra con prioridad alta. Es decisión del equipo y SEMUJERES debe confirmarla. En la demo, la cuenta de la app se liga a una persona sintética.
- **RN-18:** Titular y subdirección ven todo (incluidas las notas de cada área en solo lectura); trabajo social, psicología y jurídico ven lo de su área más la Ficha Única y no ven las notas de otras áreas.
  - **RN-18.1 (Aislamiento entre áreas y acceso de lectura en Dirección):** `nota_area` es visible y editable únicamente por su propia área, y consultable en solo lectura por Titular y Subdirección (sin crear ni editar); ninguna área de atención ve las notas de otra; `recepcion` solo gestiona citas de Trabajo Social y Psicología sin acceso a expedientes ni persona agresora.
- **RN-19:** «Primera vez» se calcula con el primer registro de la persona en trabajo social, se deriva por primera vez una de las áreas.

*(Nota: la numeración original pasa de `RN-13` a `RN-15`.)*
