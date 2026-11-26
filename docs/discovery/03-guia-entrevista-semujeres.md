# 03 · Guía de entrevista — SEMUJERES Ahome

> Reunión de descubrimiento · Martes · Duración sugerida: 60–90 min
> Registrar respuestas en [registro/acta-reunion.md](registro/acta-reunion.md) usando los mismos IDs (Q-xx).

## Antes de empezar

**Roles del equipo en la reunión**

| Rol | Responsabilidad |
|---|---|
| Moderador/a | Conduce, respeta tiempos, repregunta "¿me puede dar un ejemplo reciente?". |
| Relator/a 1 | Anota respuestas literales con ID de pregunta. |
| Relator/a 2 | Anota frases textuales, dolores, documentos mencionados, nombres de áreas/formatos. |
| Arquitecto/a | Marca en vivo decisiones desbloqueadas y nuevas dudas. |

**Reglas de entrevista**

1. Pedir **ejemplos concretos y recientes** (anonimizados), no opiniones sobre el futuro. "Cuénteme la última vez que…" > "¿Le gustaría que…?".
2. **No pedir ni aceptar datos reales de usuarias.** Si nos enseñan formatos, pedir versiones en blanco.
3. No vender la solución en la primera mitad. Mostrar la propuesta solo al final (bloque 12).
4. Si algo no lo saben, anotar quién lo sabe y cómo contactarle.
5. Preguntar por permiso antes de grabar audio; si no, solo notas.

**Prioridad:** si el tiempo se acaba, las preguntas ★ son las que bloquean el diseño del MVP.

---

## 1. Procesos actuales

| ID | Pregunta | Decisión de diseño que desbloquea |
|---|---|---|
| ★Q-01 | Cuénteme, paso a paso, qué pasa desde que una mujer los contacta por primera vez hasta que su caso se cierra. | Flujo de negocio base, estados del caso, módulos realmente necesarios. |
| ★Q-02 | ¿Por qué canales llegan hoy las mujeres? (presencial, teléfono, WhatsApp, redes, canalizadas por otra instancia) ¿Cuál es el más común? | Si la app es un canal más o el principal; necesidad de registrar solicitudes capturadas por personal (alta manual en Admin). |
| Q-03 | ¿Qué herramientas usan hoy para registrar? (papel, Excel, sistema estatal, otro software) | Migración/integración; si debemos convivir con otro sistema; formato de exportación. |
| Q-04 | ¿Qué parte de ese proceso les quita más tiempo o les preocupa más? | Prioridad del MVP (ciudadana vs. institucional). |
| Q-05 | ¿Existe un manual, protocolo o modelo de atención que sigan? ¿Podemos verlo? | Alinear estados, campos y terminología a su protocolo oficial en vez de inventarlo. |
| Q-06 | ¿Cuántas solicitudes/casos atienden aproximadamente al mes? ¿Cuántas personas en el equipo? | Dimensionamiento, paginación, necesidad de tiempo real, carga por profesional. |

## 2. Atención ciudadana

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| ★Q-07 | ¿Qué información mínima necesitan para iniciar una atención? ¿Qué preguntan en el primer contacto? | Campos del formulario de solicitud (minimización de datos). |
| Q-08 | ¿Atienden solicitudes anónimas o sin identificación? | Si la app permite uso anónimo; modelo de cuenta (OTP vs. anónimo). |
| Q-09 | ¿Cuál es su horario de atención? ¿Hay guardias fuera de horario? | Mensajes de expectativa en la app; ruteo fuera de horario (911/línea estatal). |
| Q-10 | ¿Cuáles son las razones más frecuentes por las que una mujer los busca? | Catálogo de tipos de solicitud; contenido de Orientación. |
| Q-11 | ¿Qué barreras tienen las mujeres para acercarse? (miedo, transporte, horario, no saber que existen, vigilancia del agresor) | Funciones de discreción, contenido, directorio, Puntos Violeta. |
| Q-12 | ¿Qué perfil tecnológico tienen sus usuarias? ¿Smartphone propio? ¿Datos? ¿Zonas rurales/sindicaturas? ¿Lenguas indígenas? | Offline, peso de la app, SMS como alternativa, idioma, accesibilidad. |
| Q-13 | ¿Hay información que hoy les gustaría poder darles a las mujeres y no pueden? | Contenido de Orientación; fuente de verdad del directorio. |

## 3. Gestión de expedientes

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| ★Q-14 | ¿Qué contiene un expediente hoy? ¿Podemos ver un formato en blanco? | Modelo de datos del expediente. |
| Q-15 | ¿Quién abre el expediente y en qué momento? ¿Toda solicitud se vuelve expediente? | Regla Solicitud → Expediente; estado "descartada". |
| Q-16 | ¿Se adjuntan documentos (identificaciones, actas, fotos, dictámenes)? | Almacenamiento de archivos, cifrado, tamaño; si se excluye del MVP. |
| Q-17 | ¿Cómo identifican un expediente? ¿Tienen folio oficial con formato definido? | Generador de folios. |
| Q-18 | ¿Cuánto tiempo deben conservar un expediente? ¿Qué pasa al cerrarlo? | Retención, archivo, borrado (requisito no funcional). |
| Q-19 | ¿Una mujer puede tener varios expedientes? ¿Se reabren casos? | Relación Usuaria 1..N Expediente; estado "reabierto". |

## 4. Coordinación multidisciplinaria

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| ★Q-20 | ¿Qué áreas o profesionales intervienen en un caso? ¿Cómo se llaman oficialmente? | Roles, catálogo de áreas, tipos de intervención. |
| ★Q-21 | ¿Quién decide qué área atiende un caso y cómo se asigna? | Flujo de asignación (manual por coordinación vs. auto); rol Coordinación. |
| Q-22 | ¿Cómo se pasan información entre áreas hoy? | Notas compartidas vs. privadas; notificaciones internas. |
| ★Q-23 | ¿Hay información que un área **no** debe ver de otra? (p. ej. notas psicológicas) | Permisos a nivel de campo/nota; matriz de visibilidad. |
| Q-24 | ¿A qué instancias externas canalizan y cómo? ¿Hay formato oficial de canalización? | Módulo Canalizaciones: catálogo de destinos, generar documento, seguimiento de respuesta. |
| Q-25 | ¿Reciben casos canalizados por otras instancias? | Origen de la solicitud; alta manual. |

## 5. Solicitudes urgentes

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| ★Q-26 | ¿Qué hacen hoy cuando una mujer está en peligro inmediato? ¿Quién actúa? | Diseño completo del flujo Auxilio. **Si no pueden responder en tiempo real, el botón debe priorizar el 911.** |
| ★Q-27 | ¿Tienen capacidad de responder una alerta en minutos? ¿En qué horario? ¿Con qué personal? | Tiempo real (SignalR) vs. bandeja normal; textos de expectativa en la app. |
| Q-28 | ¿Tienen coordinación con 911, policía municipal, C4 o Fiscalía? ¿Cómo? | Integración futura vs. enlace directo de llamada; protocolo de escalamiento. |
| Q-29 | ¿Cómo clasifican la urgencia o el riesgo? ¿Usan algún instrumento de valoración de riesgo? | Campo/instrumento de riesgo; priorización de bandeja. |
| Q-30 | ¿Qué preocupaciones tienen sobre un botón de auxilio? (falsas alarmas, responsabilidad legal, expectativa de rescate) | Confirmación, cancelación, textos legales, alcance del módulo. |
| Q-31 | ¿Sería útil notificar a una persona de confianza? ¿Ven riesgos? | Incluir/excluir contactos de confianza. |

## 6. Seguimiento

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| Q-32 | Después de la primera atención, ¿cómo dan seguimiento? ¿Cada cuánto? | Agenda, recordatorios, estados de seguimiento. |
| Q-33 | ¿Cuándo se pierde el contacto con una usuaria y por qué? | Recordatorios, canal de contacto seguro. |
| ★Q-34 | ¿Es seguro contactar a la usuaria por teléfono/mensaje? ¿Cómo acuerdan un medio seguro? | Campo "medio y horario de contacto seguro"; notificaciones neutras. |
| Q-35 | ¿Les sería útil que la usuaria vea el estado de su caso o citas en la app? ¿Ven riesgos? | Incluir módulo Seguimiento en Mobile y qué mostrar. |
| Q-36 | ¿Cómo se decide que un caso está concluido? | Criterios y estados de cierre. |

## 7. Reportes

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| ★Q-37 | ¿Qué reportes o indicadores deben entregar, a quién y cada cuánto? ¿Podemos ver un ejemplo en blanco? | Indicadores del dashboard; campos obligatorios para poder calcularlos. |
| Q-38 | ¿Cuánto tiempo les toma hoy armar esos reportes? | Valor de Estadísticas; exportación. |
| Q-39 | ¿Qué dato les gustaría tener y hoy no pueden obtener? | Indicadores nuevos; campos a capturar. |
| Q-40 | ¿Necesitan exportar a Excel/PDF o a un sistema estatal/federal (p. ej. banco de datos de violencia)? | Formatos de exportación; integración futura. |
| Q-41 | ¿Los reportes se desagregan por colonia/sindicatura, edad, tipo de violencia? | Catálogos geográficos y campos demográficos. |

## 8. Seguridad

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| Q-42 | ¿Cuántas personas usarían el panel? ¿Desde dónde? (oficina, celular, casa) | Restricción por red/IP, diseño responsivo, 2FA. |
| Q-43 | ¿Comparten computadoras o cuentas? | Sesiones cortas, cierre automático, cuentas individuales obligatorias. |
| Q-44 | ¿Ha habido incidentes de filtración o de agresores buscando información? | Nivel de amenaza; auditoría; ocultar existencia de expedientes. |
| ★Q-45 | ¿Qué riesgos ven si el agresor encuentra la app en el teléfono de la usuaria? | Discreción: nombre/ícono neutro, salida rápida, PIN, sin historial. |
| Q-46 | ¿Quién debe autorizar altas/bajas de personal en el sistema? | Flujo de gestión de usuarios; rol administrador. |

## 9. Privacidad

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| ★Q-47 | ¿Qué normatividad de datos personales aplican? ¿Tienen aviso de privacidad vigente? ¿Hay un área jurídica/transparencia con quien validar? | Aviso de privacidad en app, consentimiento, base legal, datos sensibles. |
| Q-48 | ¿Qué datos consideran más delicados? | Cifrado a nivel de campo; minimización. |
| Q-49 | ¿Cómo atienden solicitudes de acceso/rectificación/cancelación de datos (derechos ARCO)? | Funciones de exportar/anonimizar datos de usuaria. |
| Q-50 | ¿Pueden publicarse estadísticas? ¿Con qué nivel de agregación? | Umbral mínimo de agregación para evitar reidentificación. |
| Q-51 | ¿Es aceptable usar servicios en la nube (Firebase para push, hosting externo)? | Proveedores permitidos; contenido de notificaciones. |

## 10. Infraestructura tecnológica

| ID | Pregunta | Decisión de diseño |
|---|---|---|
| Q-52 | ¿Tienen área de TI propia o depende del Ayuntamiento? | Quién despliega y opera; documentación de operación. |
| Q-53 | ¿Tienen servidores, nube contratada o políticas de hospedaje? | Target de despliegue (Docker on-prem vs. nube). |
| Q-54 | ¿Qué equipos y navegadores usa el personal? ¿Calidad de internet en oficinas? | Compatibilidad, peso del panel, modo degradado. |
| Q-55 | ¿Usan algún sistema institucional con el que convenga integrarse (correo, identidad, sistema estatal)? | Integraciones futuras; SSO. |
| Q-56 | ¿Quién mantendría el sistema después del hackathon? | Simplicidad del stack, documentación, licencias. |

## 11. Preguntas para descubrir problemas no identificados

| ID | Pregunta | Para qué |
|---|---|---|
| Q-57 | Si mañana pudieran cambiar una sola cosa de cómo trabajan, ¿qué sería? | Detectar el dolor real dominante. |
| Q-58 | ¿Qué han intentado antes (apps, sistemas, programas) y por qué no funcionó? | Evitar repetir fracasos; resistencia al cambio. |
| Q-59 | ¿Qué caso reciente "se les cayó" o pudo salir mejor? ¿Qué faltó? (sin datos personales) | Fallas de proceso no evidentes. |
| Q-60 | ¿Qué les preocupa de usar una app/sistema nuevo? | Riesgos de adopción, carga de trabajo, capacitación. |
| Q-61 | ¿Qué tareas hacen dos veces (capturar en papel y luego en Excel, etc.)? | Doble captura = oportunidad de automatización. |
| Q-62 | ¿Hay algo que **no** quieren que haga la app? | Límites; requerimientos descartados. |
| Q-63 | ¿Quién más debería estar en esta conversación? | Stakeholders ocultos. |
| Q-64 | ¿Qué tendría que ver en la demo final para decir "esto sí lo usaríamos"? | Criterio de éxito del MVP. |
| Q-65 | ¿Existen los Puntos Violeta en Ahome? ¿Cómo funcionan y quién los gestiona? | Mantener, rediseñar o eliminar el módulo. |
| Q-66 | ¿Atienden también a hijas/hijos u otras personas relacionadas al caso? | Entidades adicionales en el modelo (personas relacionadas). |
| Q-67 | ¿Hay temporadas o eventos con picos de demanda? | Escalabilidad, campañas de contenido. |
| Q-68 | ¿Podemos volver a consultarles durante la semana? ¿Por qué medio y con quién? | Canal de validación continua durante los 5 días. |

## 12. Cierre (últimos 10–15 min)

1. Mostrar el [mapa de módulos](02-estructura-funcional.md) y el flujo F1→F3 en una lámina.
2. Pedir que marquen: **imprescindible / útil / no necesario / riesgoso** por módulo.
3. Confirmar contacto para dudas durante la semana (Q-68).
4. Pedir formatos en blanco: expediente, canalización, reporte, aviso de privacidad.
5. Agradecer y comprometer fecha de mostrar avance.
