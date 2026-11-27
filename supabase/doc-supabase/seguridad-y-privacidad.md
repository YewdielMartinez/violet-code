# Protección de Datos Personales (LGPDPPSO / LFPDPPP) y Seguridad del Sistema

Especificación técnica y normativa de cumplimiento en materia de protección de datos personales, cifrado y gobierno de integraciones externas para **SEMUJERES Ahome** (web de gestión, aplicación móvil y base de datos PostgreSQL en Supabase).

---

## 1. Marco normativo aplicable y clasificación de datos

- **LGPDPPSO (Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados):** norma principal aplicable a **SEMUJERES Ahome** como dependencia pública municipal (junto con su legislación estatal en Sinaloa). Regula los principios, deberes, medidas de seguridad, derechos ARCO y conservación aplicables a todo tratamiento de datos personales en el sector público.
- **LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares):** aplica de forma complementaria a terceros privados (proveedores de infraestructura, soporte o herramientas externas) que intervengan como encargados del tratamiento bajo contrato de confidencialidad y cero retención.
- **Clasificación de datos en el sistema:**
  - **Datos identificativos y de contacto:** nombre completo, CURP, fecha y entidad de nacimiento, celular y domicilio (`persona`, `domicilio`, `pre_registro`, `agresor`).
  - **Datos personales sensibles (nivel máximo de protección):** situación de violencia, órdenes de protección, historial clínico psicológico, notas privadas de área, consumos de alcohol o sustancias, discapacidad, pertenencia a grupo étnico, religión, estudio socioeconómico y documentos oficiales adjuntos (`INE`, fotografía, denuncias).

---

## 2. Criterios obligatorios de cumplimiento

| Principio / Deber | Requisito obligatorio | Control técnico y operativo en la arquitectura |
|---|---|---|
| **Información y consentimiento expreso** | Poner a disposición el Aviso de Privacidad y registrar consentimiento expreso para datos sensibles antes de recabarlos. | `ficha_registro.aviso_privacidad_aceptado_en` y `pre_registro.aviso_privacidad_aceptado_en` son `NOT NULL`. Las interfaces web y móvil deben mostrar el aviso previo al envío del formulario. |
| **Confidencialidad y mínimo privilegio** | Limitar el acceso exclusivamente a la información estrictamente necesaria según rol y área. | Control de acceso **RBAC + ABAC** mediante RLS en todas las tablas y Storage ([roles-y-permisos.md](./roles-y-permisos.md)): `nota_area` aislada por `area_id`, `recepcion` sin acceso a expedientes ni `agresor`, `umeca` restringida al RPC `get_umeca_citas()` y app móvil sin acceso de lectura a `persona`. |
| **Minimización y disociación** | Evitar exposición nominal en estadísticas, mapas y flujos anónimos o de pre-registro. | `vista_informe_mensual` y `vista_informe_anual` excluyen CURP y nombres; `get_mapa_calor_asentamiento()` aplica umbral mínimo de k-anonimato (`>= p_umbral_minimo`); `pre_registro` vincula por CURP en servidor sin exponer la existencia previa de un expediente a la app móvil. |
| **Resguardo de documentos adjuntos** | Proteger copias de identificaciones, fotografías y oficios contra acceso público o enlaces permanentes. | El bucket `documentos` es privado (`public = false`), con límite de `10 MB` y MIME restringido (`image/jpeg`, `image/png`, `application/pdf`), protegido por RLS en `storage.objects` y entrega exclusiva mediante URLs firmadas de corta duración. |
| **Trazabilidad y bitácora de auditoría** | Mantener registro inmutable de altas, modificaciones, desactivaciones y consultas sobre información sensible. | Tabla `bitacora_acceso` sin operaciones `UPDATE`/`DELETE` para clientes ni permisos directos de escritura; alimentada por triggers `registrar_cambio()` (`SECURITY DEFINER`) y el RPC `registrar_consulta()` al abrir expedientes o fichas de persona agresora. |
| **Protección física de refugios** | Garantizar la no divulgación de domicilios o ubicaciones de refugios en cualquier canal público o móvil. | Restricción `CHECK` en `directorio_institucion` que prohíbe almacenar cualquier campo de dirección cuando `categoria = 'refugio'`; la app móvil dispone de botón «Salir rápido» siempre visible. |
| **Derechos ARCO y conservación** | Permitir ejercicio de Acceso, Rectificación, Cancelación/Bloqueo y Oposición preservando integridad documental. | Las relaciones utilizan `ON DELETE RESTRICT` para impedir borrados físicos destructivos; la depuración y bloqueo lógico se ejecutan mediante `activo = false` y `estado_ficha = 'archivado'` preservando trazabilidad en bitácora y bloqueando altas/ediciones en tablas hijas y Storage (`ficha_editable`). |

---

## 3. Arquitectura de cifrado

El sistema adopta **defensa en profundidad en tres capas**. No se implementa cifrado de punta a punta puro (E2EE con llaves exclusivas en el dispositivo de quien captura) porque en un expediente institucional multiusuario provocaría pérdida irrecuperable de información ante rotación de personal e impediría búsquedas por CURP/nombre, cálculo de indicadores e interoperabilidad entre Trabajo Social, Psicología y Jurídico.

1. **Cifrado en tránsito (`TLS 1.2 / 1.3`):** toda comunicación entre aplicación web, app Android y API/Auth/Storage de Supabase exige HTTPS, con contraseñas con hash y expiración de sesiones.
2. **Cifrado en reposo (`AES-256`):** almacenamiento de base de datos PostgreSQL, respaldos y objetos de Storage cifrados en disco en la infraestructura gestionada, sin uso de llaves `service_role` en clientes web o móviles.
3. **Cifrado selectivo por columna para narrativas clínicas (`pgcrypto` + Vault/KMS):** los campos de texto libre con mayor sensibilidad clínica y que no requieren índices de búsqueda deben cifrarse en servidor (`nota_area.contenido`, `historial_clinico.*`, `atencion.acciones_realizadas`, `atencion.observaciones`, `agresor.observaciones`) para proteger el contenido frente a respaldos o inspecciones directas de almacenamiento.

---

## 4. Política de uso de herramientas externas y entornos

Cualquier servicio externo que interactúe con el sistema debe operar bajo principio de **cero transferencia de datos sensibles** o bajo **acuerdo de encargado del tratamiento con cero retención (*Zero Data Retention*)**:

| Superficie / Herramienta | Requisito técnico obligatorio |
|---|---|
| **Geografía y códigos postales** | Resolución 100% local (*Zero-Network*) mediante `cat_asentamiento` dentro de PostgreSQL ([geografia-sepomex.md](./geografia-sepomex.md)), sin consultar APIs externas con domicilios de usuarias. |
| **Dictado por voz (`historial_clinico`)** | Utilizar reconocimiento **on-device** (motor nativo sin envío de audio a terceros) o proveedor con política explícita de *Zero Data Retention*; evitar dictar CURP o nombres propios en el audio clínico. |
| **Mapas y análisis territorial** | Prohibida la geocodificación de domicilios particulares en servicios de mapas externos; consumir únicamente conteos agregados por colonia desde `get_mapa_calor_asentamiento()`. |
| **Logs, consola y telemetría** | Prohibido registrar CURP, nombres, notas clínicas, tokens JWT o payloads completos en consola del navegador, Android Logcat o herramientas externas de monitoreo de errores. |
| **Entornos de desarrollo y demostración** | Uso exclusivo de datos sintéticos reproducibles; nunca versionar ni cargar datos reales en entornos locales o de prueba (respaldado por exclusiones de `data/real/`, `.env*` y respaldos en `.gitignore`). |
