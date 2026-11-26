# 02 · Estructura funcional preliminar

> Estado: **PROPUESTA — por validar**. Prioridades: `MVP` · `Deseable` · `Futuro` · `?` (depende de la reunión).
> Las funciones describen intención, no procesos institucionales confirmados.

## Mapa general

```
                 ┌────────────────────────── Violet Code Core (API) ──────────────────────────┐
 Mobile ─HTTPS─► │ Auth · Usuarios · Alertas · Expedientes · Seguimiento · Notificaciones ·   │ ◄─HTTPS─ Administration
 (usuaria)       │ Analítica · Auditoría · Catálogos                                           │          (personal SEMUJERES)
                 └──────────────────────────────── PostgreSQL ─────────────────────────────────┘
```

---

## A. Violet Code Mobile (Android · usuaria)

| Módulo | Propósito | Funciones candidatas | Prioridad | Depende de validar |
|---|---|---|---|---|
| **Auxilio** | Pedir ayuda inmediata | **Alerta silenciosa** (sin sonido ni pantalla visible; activable con gesto o botón disfrazado) · botón de auxilio con confirmación (deslizar/mantener) · envío de ubicación · **acceso directo a llamar 911** · aviso a contactos de confianza (opcional) · cancelar falsa alarma | MVP | ¿SEMUJERES puede responder en tiempo real? ¿Horario? ¿Quién recibe? (H-04, H-05) |
| **Solicitudes** | Pedir orientación/atención no urgente | Formulario corto: tipo de apoyo, descripción opcional, medio y horario de contacto **seguro** · consentimiento informado · folio | MVP | Qué datos mínimos necesitan para abrir un caso |
| **Orientación** | Información confiable | **Violentómetro digital** interactivo · **triaje de orientación inicial** (preguntas simples → nivel de riesgo → ruta sugerida: 911 / SEMUJERES / jurídico / psicológico) · contenido: tipos de violencia, derechos, qué hacer · lenguaje simple, íconos, lectura en voz alta · funciona offline | MVP | Contenido y criterios de triaje aprobados por SEMUJERES |
| **Directorio** | Saber a dónde acudir | **Directorio de emergencia offline** · instancias (SEMUJERES, Fiscalía, salud, refugios…) con horario, teléfono, mapa · llamar con un toque | MVP | Lista oficial de instancias |
| **Puntos Violeta** | Lugares seguros cercanos | Mapa de Puntos Violeta **y refugios** · cómo llegar · qué ofrece cada uno | MVP (lo pide la convocatoria, C-09) | ¿Cómo funciona el programa en Ahome? Ubicación de refugios **no** debe ser pública |
| **Seguimiento** | Ver avance de su caso | Estado de solicitud · próxima cita · mensajes de SEMUJERES (no contenido sensible en notificación) | Deseable | ¿Quieren que la usuaria vea su estado? ¿Riesgo si el agresor revisa el teléfono? |
| *Transversal:* **Seguridad de la usuaria** | Proteger a quien usa la app | Salida rápida · nombre/ícono discreto · PIN/biometría · sin historial visible · notificaciones neutras · borrar datos locales | MVP (mínimo: salida rápida + PIN) | Preferencias de SEMUJERES (H-06) |
| *Transversal:* **Cuenta** | Identificar a la usuaria | Registro con teléfono/OTP o uso anónimo para orientación | MVP | ¿Pueden atender casos anónimos? |

## B. Violet Code Administration (web · personal SEMUJERES)

| Módulo | Propósito | Funciones candidatas | Prioridad | Depende de validar |
|---|---|---|---|---|
| **Dashboard** | Situación de un vistazo | Alertas activas · solicitudes nuevas · casos por estado/área · agenda del día | MVP | Qué miran primero cada mañana |
| **Solicitudes** | Bandeja de entrada | Lista de alertas y solicitudes · tomar/asignar · clasificar · convertir en expediente · descartar con motivo | MVP | Quién hace triage y con qué criterios |
| **Expedientes** | Registro único del caso | Datos de la usuaria (mínimos) · tipo de violencia · historial · documentos · estado | MVP | Estructura real del expediente actual |
| **Gestión de casos** | Ciclo de vida | Estados (abierto, en atención, canalizado, cerrado…) · responsable · prioridad · riesgo | MVP | Estados reales y quién los cambia |
| **Profesionales** | Equipo multidisciplinario | Perfil, área, carga de casos, disponibilidad | Deseable | Áreas y roles reales |
| **Intervenciones** | Lo que se hizo en cada atención | Registro por área (psicológica, jurídica, social) · notas con visibilidad por rol | MVP | ¿Qué notas son confidenciales entre áreas? |
| **Canalizaciones** | Envío a otras instancias | Destino, motivo, fecha, estatus de respuesta | Deseable | Instancias y formatos oficiales |
| **Agenda** | Citas y seguimiento | Citas por profesional · recordatorios · reprogramar | Deseable | ¿Usan agenda hoy? ¿Cuál? |
| **Estadísticas** | Indicadores y reportes | Gráficas por periodo, tipo, área · **mapa de calor por colonia/sindicatura** (agregado, umbral mínimo para evitar reidentificar) · exportar CSV/PDF | MVP | Reportes obligatorios y su formato · catálogo de colonias/sindicaturas |
| **Usuarios** | Personal y permisos | Alta/baja · roles · área · restablecer acceso | MVP | Matriz de permisos |
| **Auditoría** | Quién vio/cambió qué | Bitácora de accesos y cambios, filtrable · solo lectura | MVP (registro) / Deseable (UI) | Requisitos legales de bitácora |
| **Catálogos** *(sugerido)* | Contenido configurable | Directorio, Puntos Violeta, tipos de violencia, áreas | Deseable | Quién mantiene el contenido |

### Componentes motion-kit candidatos (Admin)

`data-table` (bandejas, expedientes) · `stat-card` + `chart` + `heatmap-chart` (dashboard/estadísticas) · `timeline` / `activity-feed` (historial del expediente, alertas en vivo) · `drawer` / `dialog` (detalle rápido) · `filter-builder` (estadísticas) · `stepper` (alta de expediente) · `date-time-picker` / `calendar` (agenda) · `tag-input` / `multi-select` (clasificación) · `notification-stack` (alertas entrantes) · `command-search` (buscar expediente por folio) · `empty-state` · `breadcrumb` · `rich-text-editor` (notas de intervención, con `sanitizeHtml`).

### Equivalente Mobile

motion-kit es web; en Android usamos **Material 3 de Compose con los mismos tokens** (`packages/design-tokens/dist/VioletColors.kt`) y replicamos los patrones de movimiento clave (presión elástica, deslizar para confirmar) en Compose. Ver [ADR-0002](../adr/0002-sistema-de-diseno-motion-kit.md).

## C. Violet Code Core (backend)

| Módulo | Responsabilidad | Prioridad | Depende de validar |
|---|---|---|---|
| **Autenticación** | Login de personal (correo + contraseña, 2FA deseable) · usuarias (OTP/anónimo) · JWT de vida corta + refresh | MVP | Política de cuentas |
| **Gestión de usuarios** | Personal, roles, áreas, usuarias | MVP | Matriz de roles |
| **Alertas** | Recibir auxilio, ubicación, estado (nueva→atendida→cerrada), empujar a Admin en tiempo real (SignalR) | MVP | Flujo de respuesta real |
| **Expedientes** | Solicitudes, expedientes, intervenciones, canalizaciones, documentos | MVP | Estructura del expediente |
| **Seguimiento** | Estados, asignaciones, agenda, recordatorios | MVP (estados) / Deseable (agenda) | |
| **Notificaciones** | Push a la usuaria (FCM, contenido neutro) · en-app/tiempo real a personal · SMS (futuro) | MVP (tiempo real Admin) | Canales permitidos |
| **Analítica** | Consultas agregadas, sin datos personales, para dashboard/estadísticas | MVP (básico) | Indicadores oficiales |
| **Auditoría** | Bitácora inmutable (append-only) de accesos y cambios a datos sensibles | MVP | Requisitos legales |
| **Catálogos** *(sugerido)* | Directorio, Puntos Violeta, tipos, áreas | MVP | |

## D. Trazabilidad flujo ↔ módulos

| Flujo | Mobile | Admin | Core |
|---|---|---|---|
| F1 Auxilio | Auxilio | Dashboard, Solicitudes | Alertas, Notificaciones, Auditoría |
| F2 Orientación | Solicitudes, Orientación | Solicitudes, Expedientes | Expedientes, Notificaciones |
| F3 Seguimiento | Seguimiento | Gestión de casos, Intervenciones, Canalizaciones, Agenda | Expedientes, Seguimiento, Auditoría |
| F4 Información | Directorio, Puntos Violeta | Catálogos | Catálogos |
| F5 Indicadores | — | Dashboard, Estadísticas | Analítica |
