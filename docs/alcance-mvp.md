# Alcance del MVP — SEMUJERES Ahome

## Qué se va a construir

- **Web de gestión (computadora):** para el personal de SEMUJERES (`titular`, `subdirección`, `trabajo social`, `psicología` y `jurídico`). *(Además de `recepción` y consulta de solo lectura para `UMECA`, según RF-21.)*
- **Móvil (app Android nativa, Kotlin y Jetpack Compose):** solo para la usuaria. No agenda citas ni muestra expedientes.
- **Base de datos:** Supabase (PostgreSQL con autenticación, permisos por rol y API automática), conectada directo al frontend. No hay backend propio.

---

## MVP: Web

### Expediente
- Ficha Única digital con folio automático (`RF-01`, `RF-02`).
- La copia de la INE, fotografía y documentos vinculados a órdenes de protección se adjuntan en almacenamiento privado con URLs firmadas temporales (`RF-35`, `RF-35.1`).
- Búsqueda por CURP, nombre o folio, y detección de duplicados (`RF-03`, `RF-04`).
- Datos de la persona agresora (`RF-05`).
- Archivado en lugar de borrar (`RF-24`).
- Datos de ejemplo, sintéticos y en poca cantidad, solo unos cuantos, para mostrar el sistema (`RNF-01`): se generan con un script que siempre produce los mismos, por regla de la convocatoria.

### Agenda
- Citas de Trabajo Social y Psicología, con estados, dejando las citas de mañana por confirmar (`RF-06`).
- Lista de urgencias (`RF-07`): lista de personas con urgencia para llamar y reagendar cuando se cancela una cita. Se arma con los expedientes abiertos o en seguimiento cuya prioridad más reciente es alta y que no tengan ya una cita próxima. La prioridad (`alta`, `media` o `baja`, opcional) se registra en la Ficha de Seguimiento y se puede editar.

### Seguimiento
- Seguimiento por cita y línea de tiempo del caso (`RF-09`, `RF-25`).
- Notas privadas por área (`RF-10`).

### Canalizaciones y capacitaciones
- Canalizar a la instancia que se requiera (`RF-08`).
- Registro de actividades preventivas (charlas) (`RF-16`).

### Psicología
- Historial clínico digital (`RF-11`).
- Dictado por voz que llena el historial (`RF-12`).

### Roles y seguridad
- Siete roles con acceso controlado en PostgreSQL mediante RLS (`RBAC + ABAC`): al iniciar sesión, cada rol llega a su propia pantalla de inicio (`RF-21`, `RF-21.1`, `RN-18.1`).
- Bitácora inmutable de cambios y consultas (`RF-22`, `RF-22.1`).
- Cumplimiento LGPDPPSO con cifrado en 3 capas (HTTPS/TLS, reposo AES-256 + URLs firmadas, y cifrado selectivo por columna para narrativas clínicas), expiración de sesión y cero PII en logs (`RNF-02.1`, `RNF-03.1`).

### Alertas y protección
- Cola de alertas ordenada por prioridad (`alta`, `media` o `baja`), con su origen: `app móvil`, `teléfono` o `presencial` (`RF-20`). Una alerta que viene de la app entra con prioridad `media`; si la persona está ligada a un expediente con orden de protección vigente, entra con prioridad `alta`.
- Órdenes de protección.

### Informes y registro en la app (liga por CURP)
- Informes mensual y anual por área (`RF-13`).
- Registro en la app y liga por CURP (`RF-33`, `RF-34`): la usuaria puede registrarse en la app y usar solamente el botón de ayuda y las demás funciones de la app, sin ir nunca a SEMUJERES. Al capturar la CURP en la Ficha Única, el sistema avisa «Esta persona ya está registrada» si ya tiene expediente, y no crea otro. Si en cambio tiene un registro hecho desde la app, precarga sus datos para confirmarlos y los liga al expediente, sin duplicar. Si ya tiene expediente y se registra en la app, se liga automáticamente por su CURP. La app no revela si una CURP ya tiene expediente.

---

## MVP: Móvil

- Registro en la app con CURP, nombres y apellidos; fecha de nacimiento, sexo y entidad de nacimiento salen de la CURP (`RF-33`).
- Inicio de sesión con correo y contraseña (la CURP se captura en el registro de la app, pero no sirve para iniciar sesión).
- Botón de ayuda: pulsación de 2 segundos, cuenta regresiva y Cancelar (`RF-18`).
- Salir rápido con protección visual `FLAG_SECURE` en Android (`RF-29`, `RF-29.1`).
- Violentómetro, escala de 0 a 30 sin guardar resultados sin consentimiento (`RF-26`, `RF-26.1`).
- Orientación y directorio fijos, sin direcciones de refugios (`RF-30`, `RF-30.1`).

---

## Si alcanza el tiempo

- Canal de apoyo con psicología y su bandeja (`RF-27`, `RF-28`).
- Registro de alertas por teléfono o en persona a cargo de los responsables o encargados de la línea 24/7 (`titular`, `subdirección` y `jurídico`) (`RF-32`).
- Importación de datos históricos desde un archivo CSV o Excel (`RF-23`).

---

## Fuera del MVP (trabajo a futuro)

- Tablero con avance de la meta anual y mapa de calor, con la capa de sectores visitados y por atender (`RF-14`, `RF-15`).
- Ubicación en tiempo real, contactos de confianza y rastreo con ubicación.
- Conexión real con 911 y patrulla de género.
- Integración con BANAVIM.
- Recordatorios automáticos de citas.
- Mis alertas con su estado, en la móvil (`RF-31`).
- Consulta de alertas de prioridad alta para la policía (código 100).
- Llamada de regreso, notificaciones reales y WhatsApp real.
- Mapa de lugares seguros.
