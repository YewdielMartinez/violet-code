# ADR-0001: Monorepo con workspaces por ecosistema

- **Estado:** Aceptada
- **Fecha:** 2026-11-16
- **Decisores:** Equipo
- **Evidencia:** Solicitud del equipo; C-02, C-03

## Contexto

Tres componentes en tres ecosistemas (Gradle, .NET, npm) desarrollados en paralelo durante 5 días. Necesitamos documentación, tokens de diseño y contratos compartidos visibles para todos, y una sola historia de cambios para la demo.

## Opciones consideradas

1. **Tres repositorios** — aislados, pero contratos y docs se desincronizan; más fricción.
2. **Monorepo con un orquestador único (Nx/Turborepo)** — potente, pero no gestiona bien Gradle ni .NET y añade curva de aprendizaje.
3. **Monorepo simple: cada app usa su herramienta nativa; npm workspaces solo para JS** — mínimo acoplamiento, cero herramientas nuevas.

## Decisión

Opción 3. Estructura `apps/{admin,mobile,core}`, `packages/design-tokens`, `infra/`, `docs/`. npm workspaces para `apps/admin` y `packages/*`. Android (Gradle) y Core (dotnet) viven en sus carpetas con su propio build.

## Consecuencias

- Positivas: un clon, docs y ADRs junto al código, tokens de diseño compartidos, PRs que cruzan componentes.
- Negativas: sin caché/orquestación de builds entre ecosistemas; CI debe filtrar por ruta.
- Reconsiderar si: el número de paquetes JS crece y los builds se vuelven lentos (añadir Turborepo).
