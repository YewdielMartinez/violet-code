# 00 · Convocatoria, rúbrica y cómo la cubrimos

> Fuente: Convocatoria 2do Hackathon FIM-UAS 2026 (SEMUJERES Ahome). Este documento traduce cada criterio de evaluación a **evidencia verificable** en la demo y en este repositorio.

## Entregables obligatorios

| # | Entregable | Dónde | Estado |
|---|---|---|---|
| 1 | Prototipo funcional ejecutable en vivo | `apps/mobile`, `apps/admin`, `apps/core` + `infra/docker-compose.yml` | Pendiente |
| 2 | Repositorio con documentación técnica (README) | [README.md](../README.md) + `docs/` | En curso |
| 3 | Pitch deck (impacto y factibilidad de adopción) | `docs/pitch/` | Pendiente |

## Eje temático

Violet Code cubre el **Eje 1** (prevención, alerta temprana y atención) desde Mobile y el **Eje 3** (gestión interna, trazabilidad y analítica) desde Admin/Core. La convocatoria pide inscribirse en **un** eje: confirmar cuál se registró (riesgo K-14) y presentar el otro como la mitad que cierra el ciclo.

## Rúbrica → evidencia

### 1. Impacto social y pertinencia — 25 pts

| Qué evalúan | Nuestra evidencia |
|---|---|
| Resuelve una problemática real de las mujeres en Ahome | Las problemáticas que SEMUJERES declara (C-07, C-08) llevan a funciones concretas: alerta silenciosa, rutas de atención, canalización, expediente único. |
| Factibilidad de piloto en la dependencia | Acta de la reunión con SEMUJERES, requerimientos con evidencia (R-xx), plan de despliegue en Docker, costos de operación y quién lo mantiene. |

### 2. Viabilidad técnica y funcionalidad — 25 pts

| Qué evalúan | Nuestra evidencia |
|---|---|
| MVP completo | Flujo de punta a punta en vivo: alerta desde Android → aparece en Admin → se abre expediente → intervención → estadística. |
| Ejecución estable, **sin pantallas estáticas simuladas** | Todo lo que se ve sale del API real con datos sintéticos (K-15). Ensayo de demo con checklist. |
| Arquitectura limpia | ADRs, monolito modular con límites por schema, MVVM, contrato OpenAPI compartido. |
| Escalabilidad | Módulos extraíbles, contenedores, base de datos única por ahora con un schema por módulo. |

### 3. Innovación, UX y accesibilidad — 20 pts

| Qué evalúan | Nuestra evidencia |
|---|---|
| Diseño inclusivo para distintos niveles de alfabetización digital | Lenguaje simple, íconos con texto, botones grandes, lectura en voz alta, compatible con TalkBack, contraste AA (tema Material 3). |
| Rapidez de acceso en emergencias | Alerta en ≤ 3 interacciones medidas en la demo; acceso directo al 911. |
| Originalidad | Alerta silenciosa disfrazada, triaje que lleva a una ruta de atención, un solo ciclo de la usuaria al expediente. |

### 4. Seguridad de la información y privacidad por diseño — 15 pts

| Qué evalúan | Nuestra evidencia |
|---|---|
| Resguardo de identidad | Modo discreto (ícono/nombre neutro), salida rápida, PIN, notificaciones sin contenido. |
| Protección de datos sensibles | Cifrado a nivel de columna en campos sensibles, TLS, minimización de datos. |
| Control de accesos | Roles + autorización por recurso (área / caso asignado), sesiones cortas. |
| Ética y confidencialidad | Auditoría de lecturas y cambios, solo datos sintéticos, umbral mínimo en mapas de calor. Documento `docs/security/`. |

### 5. Pitch y trabajo colaborativo — 15 pts

| Qué evalúan | Nuestra evidencia |
|---|---|
| Síntesis de la demo | Guion de 5 min con el flujo de punta a punta; respuestas preparadas para preguntas técnicas y operativas. |
| Participación equilibrada | Cada integrante es dueño de un componente y hace commits/PRs propios (ver `CONTRIBUTING.md`); todas y todos hablan en el pitch. |

## Ética (condición, no puntos)

Solo datos sintéticos, simulados o estadísticas públicas agregadas (C-12). Incumplir puede llevar a descalificación.

## Pendiente de aclarar con la organización

- Fechas contradictorias: 23–27 nov (encabezado) vs. 09–13 nov (cronograma). Confirmar fecha y hora del pitch y del corte de código (K-13).
- Eje registrado (K-14).
