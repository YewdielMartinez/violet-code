# 01 · Product Discovery — Violet Code

> Estado: **BORRADOR PRE-REUNIÓN** · Última revisión: 2026-11-16
> Todo lo marcado como **[H]** es hipótesis. Solo lo marcado como **[C]** está confirmado.
> Ningún proceso institucional de SEMUJERES Ahome se da por conocido hasta la reunión del martes.

## 0. Hechos confirmados [C]

| ID | Hecho | Fuente |
|---|---|---|
| C-01 | Proyecto para el 2do Hackathon FIM-UAS 2026, en colaboración con SEMUJERES Ahome. | Equipo |
| C-02 | Tres componentes: Mobile (Android, Kotlin + Compose), Administration (web), Core (API central). | Equipo |
| C-03 | Ventana de desarrollo: ~5 días. | Equipo |
| C-04 | Durante el hackathon se usan **exclusivamente datos sintéticos**. | Equipo |
| C-05 | Stack de referencia: Kotlin + Compose, React + TS, ASP.NET Core Web API, PostgreSQL, Docker. | Equipo |
| C-06 | Línea visual: motion-kit (`@yewdiel21/motion-kit`) con color principal violeta. | Equipo |
| C-07 | SEMUJERES declara como problemáticas: barreras para solicitar auxilio oportuno, desconocimiento de rutas de atención y necesidad de canalización discreta (jurídica, psicológica, policial). | Convocatoria, Eje 1 |
| C-08 | SEMUJERES declara procesos **manuales o fragmentados** en registro, seguimiento multidisciplinario (jurídico, psicológico, trabajo social) y generación de estadísticas. | Convocatoria, Eje 3 |
| C-09 | Soluciones esperadas mencionadas: alerta silenciosa, mapa de Puntos Violeta y refugios, violentómetro, triaje de orientación inicial, directorio offline, expediente único cifrado, dashboards, mapas de calor por colonia/sindicatura. | Convocatoria, Ejes 1 y 3 |
| C-10 | Entregables: prototipo ejecutable en vivo, repositorio con README, pitch deck. Demo de 5 min + 3 min de preguntas. | Convocatoria §III, §IV |
| C-11 | Rúbrica: Impacto 25 · Viabilidad técnica 25 · Innovación/UX/Accesibilidad 20 · Seguridad y privacidad 15 · Pitch y trabajo colaborativo 15. | Convocatoria §V |
| C-12 | Solo datos sintéticos, simulados o estadísticas públicas agregadas. | Convocatoria §VI |

Lo que la convocatoria declara es un problema **general** (C-07, C-08). **Cómo** ocurre en Ahome (pasos, herramientas, áreas, volúmenes) sigue sin confirmarse. Lo demás son propuestas.

## 1. Problema principal [H]

**Formulación tentativa:**

> Una mujer que necesita auxilio u orientación no tiene un canal directo, discreto y trazable hacia SEMUJERES, y la dependencia no tiene una vista única de cada caso que permita a su equipo multidisciplinario coordinarse y darle seguimiento.

Se descompone en dos problemas que deben validarse por separado (pueden ser verdaderos uno sin el otro):

| ID | Lado | Problema hipotético | Cómo sabremos si es real |
|---|---|---|---|
| P-1 | Ciudadana | Pedir ayuda/orientación es difícil, lento, poco discreto o no sabe a dónde acudir. | SEMUJERES describe fricción real en el primer contacto (canales, horarios, abandono). |
| P-2 | Institución | La información del caso está dispersa (papel, Excel, WhatsApp, varias áreas) y el seguimiento depende de personas. | Nos muestran o describen cómo registran y transfieren un caso hoy. |
| P-3 | Institución | No hay datos agregados confiables para reportar y decidir. | Describen cómo arman sus reportes y cuánto tardan. |

**Riesgo de enfoque:** si P-2 resulta ser el dolor dominante, el valor del MVP está en Administration/Core, no en el botón de auxilio. Debemos estar listos para pivotar el peso del MVP.

## 2. Usuarios involucrados [H]

| Rol | Componente | Descripción tentativa | Validar |
|---|---|---|---|
| Usuaria | Mobile | Mujer que busca auxilio, orientación o seguimiento de su caso. | ¿Edades, acceso a smartphone/datos, zonas urbanas/rurales? |
| Persona de confianza | Mobile (indirecto) | Contacto que recibe aviso en una alerta. | ¿Es deseable o riesgoso? |
| Personal de primer contacto / recepción | Admin | Recibe y clasifica solicitudes. | ¿Existe como rol? ¿Turnos? |
| Psicóloga/o | Admin | Atención psicológica. | Nombre real de áreas. |
| Abogada/o / asesoría jurídica | Admin | Orientación y acompañamiento legal. | Ídem. |
| Trabajo social | Admin | Visitas, canalización, red de apoyo. | Ídem. |
| Coordinación / jefatura | Admin | Asigna casos, supervisa, aprueba. | ¿Quién asigna? |
| Dirección / titular | Admin | Indicadores y reportes. | ¿Qué decide con datos? |
| Administrador/a del sistema | Admin | Usuarios, roles, catálogos. | ¿Hay área de TI? |
| Responsable de Punto Violeta | Mobile/Admin | Establecimiento o punto seguro. | ¿El programa existe así en Ahome? |

## 3. Stakeholders [H]

| Stakeholder | Interés | Influencia | Nota |
|---|---|---|---|
| SEMUJERES Ahome | Operar el sistema, mejorar atención | Alta | Cliente/usuario principal. |
| Usuarias | Seguridad, discreción, respuesta | Alta (ética) | No las entrevistaremos directamente en el hackathon; voz vía SEMUJERES. |
| Jurado FIM-UAS | Viabilidad, impacto, calidad técnica | Alta (evento) | |
| Ayuntamiento de Ahome / TI municipal | Infraestructura, normatividad | Media | ¿Quién hospedaría? |
| Seguridad pública / 911 | Emergencias | Media | **No reemplazamos al 911.** |
| Fiscalía, salud, DIF, refugios, otras instancias | Destino de canalizaciones | Media | Validar cuáles. |
| Órgano de transparencia / protección de datos | Cumplimiento | Media | Datos sensibles. |
| Equipo de desarrollo | Entregar MVP en 5 días | — | |

## 4. Objetivos del producto [H]

| ID | Objetivo | Métrica candidata (demo) |
|---|---|---|
| O-1 | Que una usuaria pueda pedir auxilio u orientación en pocos toques y de forma discreta. | ≤ 3 interacciones para enviar alerta; tiempo a recepción en panel < 5 s. |
| O-2 | Que cada solicitud se convierta en un expediente trazable con responsable. | 100 % de solicitudes con estado y responsable. |
| O-3 | Que el equipo multidisciplinario registre intervenciones y canalizaciones sobre el mismo expediente. | Historial completo por caso. |
| O-4 | Que la dirección obtenga estadísticas sin armar reportes a mano. | Dashboard con indicadores acordados. |
| O-5 | Proteger la información desde el diseño. | Roles, auditoría de accesos, cifrado en tránsito, datos mínimos. |

## 5. Hipótesis iniciales

Registro completo y estado en [registro/hipotesis.md](registro/hipotesis.md). Resumen:

- **H-01** Hoy el primer contacto ocurre por canales no integrados (presencial, teléfono, redes, WhatsApp).
- **H-02** Los expedientes se llevan en papel u hojas de cálculo, total o parcialmente. *(Respaldada en general por C-08; falta el detalle.)*
- **H-03** Un caso pasa por varias áreas (psicología, jurídico, trabajo social) y la coordinación es manual. *(Respaldada en general por C-08; falta el detalle.)*
- **H-04** SEMUJERES **no** opera atención de emergencias 24/7; las emergencias van al 911.
- **H-05** Un botón de auxilio que solo avise a SEMUJERES, sin 911, puede generar falsa expectativa de rescate.
- **H-06** Las usuarias valorarían una app discreta (nombre/ícono neutros, salida rápida, sin rastro).
- **H-07** Existe o se desea un directorio de instancias y "Puntos Violeta".
- **H-08** SEMUJERES debe reportar indicadores periódicos a otras instancias (estatal/federal).
- **H-09** No hay infraestructura de TI propia para hospedar el sistema.
- **H-10** El seguimiento posterior (citas, recordatorios) se pierde con frecuencia.
- **H-11** Hay obligaciones de protección de datos personales sensibles aplicables a la dependencia.
- **H-12** Las usuarias pueden no tener datos móviles constantes.

## 6. Necesidades que debemos validar

1. Qué ocurre hoy, paso a paso, desde que una mujer pide ayuda hasta que el caso se cierra.
2. Qué significa "urgente" para SEMUJERES y qué capacidad real de respuesta tienen (horarios, personal).
3. Qué información registran, quién la ve y quién no debe verla.
4. Cómo se asignan y transfieren casos entre áreas.
5. Qué reportes están obligados a producir y con qué formato.
6. Qué canalizaciones externas hacen y si requieren formatos oficiales.
7. Qué restricciones legales y de seguridad aplican.
8. Qué esperan concretamente de nosotros (y qué **no** quieren).
9. Si el programa de Puntos Violeta existe en Ahome y cómo funciona.
10. Quién operaría y mantendría el sistema después del hackathon.

## 7. Alcance preliminar

### 7.1 Candidato a MVP (5 días) — sujeto a reunión

| Flujo extremo a extremo | Mobile | Admin | Core |
|---|---|---|---|
| **F1. Solicitud de auxilio** | Botón con confirmación + ubicación + aviso de llamar al 911 | Bandeja en tiempo (casi) real, tomar alerta | Alerta, notificación, auditoría |
| **F2. Solicitud de orientación** | Formulario breve (tipo de apoyo, medio de contacto seguro) | Bandeja, clasificar, asignar | Solicitud → expediente |
| **F3. Expediente y seguimiento** | Ver estado/cita de su solicitud | Expediente, intervenciones, canalización, agenda simple | Expedientes, seguimiento |
| **F4. Información** | Orientación (contenido estático), Directorio, Puntos Violeta en mapa | CRUD de directorio/puntos | Catálogos |
| **F5. Indicadores** | — | Dashboard con 4–6 indicadores | Analítica (consultas agregadas) |

### 7.2 Fuera del MVP (por ahora)

- Integración real con 911 / C4 / Fiscalía (se simula o se enlaza a llamada).
- Videollamada / chat en tiempo real con profesionales.
- App iOS.
- Firma electrónica, generación de documentos oficiales.
- Migración de expedientes existentes.
- Despliegue productivo con datos reales.

### 7.3 Principios de alcance

- **Un flujo completo vale más que muchos módulos a medias.** F1→F3 de punta a punta es la demo central.
- Cada módulo de la [estructura funcional](02-estructura-funcional.md) tiene prioridad `MVP`, `Deseable` o `Futuro`; se reasigna después de la reunión.
- **Seguridad de la usuaria > funcionalidad.** Si una función puede ponerla en riesgo (p. ej. notificaciones visibles para el agresor), se descarta o se rediseña.
