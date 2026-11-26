# ADR-0002: Sistema de diseño basado en motion-kit con tema "violet"

- **Estado:** Aceptada (color sujeto a D-08)
- **Fecha:** 2026-11-16
- **Decisores:** Equipo
- **Evidencia:** C-06; D-08 (color institucional pendiente)

## Contexto

El equipo quiere usar la línea de diseño de `@yewdiel21/motion-kit` cambiando solo el color principal y usando sus componentes. motion-kit expone temas Material 3 como variables `--md-sys-color-*` bajo `[data-mk-theme]` y un generador `generateTheme(seed)`. Es una librería web (vanilla/React); no existe versión Compose.

## Opciones consideradas

1. Usar un tema existente de motion-kit (`purple`) — rápido, pero no controlamos el tono.
2. **Generar un tema propio desde una semilla violeta con el motor de motion-kit** — misma línea, color propio, reproducible.
3. Sobrescribir variables a mano — frágil, rompe contraste en dark mode.

## Decisión

Opción 2. `packages/design-tokens` ejecuta `generateTheme('#7B2CBF', { variant: 'vibrant' })` y emite:

- `dist/violet.css` → Admin: `[data-mk-theme="violet"]` con light/dark.
- `dist/tokens.json` → fuente neutral.
- `dist/VioletColors.kt` → Mobile: `VioletLightScheme` / `VioletDarkScheme` para `MaterialTheme`.

Admin usa los componentes de motion-kit (`/react`). Mobile usa Material 3 de Compose con los mismos tokens y replica las microinteracciones clave (presión elástica, deslizar para confirmar el auxilio).

**Tailwind (decisión del equipo, 2026-11-16):** el panel usa Tailwind v4 para layout y estilos propios. Sus colores se mapean a las variables del tema (`@theme inline` en `apps/admin/src/index.css`), así `bg-primary` es el mismo violeta que usan los componentes de motion-kit. Se prohíbe la paleta por defecto de Tailwind. En Android, Tailwind no aplica (Compose no usa CSS); la consistencia se mantiene con los mismos tokens.

Regenerar: `npm run tokens` (variables opcionales `VIOLET_SEED`, `VIOLET_VARIANT`).

## Consecuencias

- Positivas: un solo origen de color para web y Android; dark mode y contraste correctos por construcción (Material 3).
- Negativas: Mobile no reutiliza componentes, solo tokens (K-12). motion-kit es `UNLICENSED` (K-11).
- Reconsiderar si: SEMUJERES exige su paleta institucional (cambiar semilla) o pide otra línea visual.
