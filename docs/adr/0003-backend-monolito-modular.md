# ADR-0003: Core como monolito modular con Clean Architecture ligera; Mobile con MVVM

- **Estado:** Propuesta (se acepta tras la reunión si no aparecen integraciones que lo contradigan)
- **Fecha:** 2026-11-16
- **Decisores:** Equipo
- **Evidencia:** C-03, C-05; pendiente Q-52…Q-56

## Contexto

5 días, equipo pequeño, un solo cliente institucional, volumen esperado bajo (por confirmar, Q-06). Dominios distinguibles (identidad, alertas, casos, catálogos, auditoría) con requisitos de privacidad distintos.

## Opciones consideradas

1. Microservicios — sobrecosto operativo injustificable.
2. Monolito en capas — rápido, pero mezcla dominios con distinta sensibilidad.
3. **Monolito modular** (un proceso, un PostgreSQL, un schema por módulo, Clean Architecture por carpetas dentro de cada módulo).

Mobile: MVVM (nativo de Jetpack) vs. MVI vs. sin patrón.

## Decisión

- Core: opción 3. Módulos: Identity, Alerts, Cases, Scheduling, Catalogs, Notifications, Analytics, Audit. Comunicación entre módulos por interfaz pública o eventos en proceso.
- Mobile: Clean Architecture + MVVM en **4 módulos Gradle** (`app`, `core:domain` en Kotlin puro, `core:data`, `core:designsystem`), Koin para inyección, Room para el directorio offline. *(Actualizado 2026-11-16: antes decía "un solo módulo"; se separó para que Gradle haga cumplir los límites entre capas. No hay módulos por feature: son trabajo extra que no se justifica en 5 días.)*
- Admin: feature-sliced con TanStack Query sobre cliente OpenAPI.

## Consecuencias

- Positivas: un despliegue Docker; límites claros para auditar datos sensibles; extraíble a servicios si crece.
- Negativas: requiere disciplina para no cruzar schemas; sin aislamiento de fallos entre módulos.
- Reconsiderar si: SEMUJERES requiere integrarse con un sistema estatal existente que dicte otra forma, o si el hosting impone restricciones (p. ej. solo PHP/MySQL).
