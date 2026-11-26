# Guía de Frontend: `@yewdiel21/motion-kit` en `apps/admin`

Referencia rápida para el equipo de frontend sobre cómo está integrado `@yewdiel21/motion-kit` (`^0.20.1`) en `apps/admin`, sus reglas de uso y qué componentes ofrece para los módulos del MVP de SEMUJERES.

- **Paquete:** `@yewdiel21/motion-kit` (instalado `0.20.1`)
- **Stack base:** React 19 (`^19.1.0`), TypeScript (`~5.8.3`), Vite (`^6.3.5`), Tailwind CSS v4 (`@tailwindcss/vite` `^4.3.5`), `gsap` (`^3.15.1`)
- **Repositorio de la librería:** `https://github.com/YewdielMartinez/motion-kit`
- **Playground con ejemplos Vanilla y React:** `https://motion-kit-playground.vercel.app`

---

## 1. Integración actual en `apps/admin`

La librería ya está configurada de raíz en el proyecto:

1. **Pre-pintado de tema sin destello (`apps/admin/vite.config.ts`)**
   - El plugin `motionKitTheme()` inyecta `themeHeadScript({ default: 'purple', mode: 'system', storageKey: 'vc-theme' })` al inicio de `<head>`.
   - El build separa la librería y GSAP en un chunk dedicado (`'vendor-motion': ['@yewdiel21/motion-kit/react', 'gsap']`).

2. **Proveedor de tema y notificaciones (`apps/admin/src/main.tsx` + `apps/admin/src/app/theme.ts`)**
   - `<ThemeProvider defaultTheme="purple" mode="system" storageKey={THEME_STORAGE_KEY}>` (donde `THEME_STORAGE_KEY = 'vc-theme'`).
   - `<Toaster />` montado en la raíz junto con `@yewdiel21/motion-kit/css/components/toast` para disparar notificaciones desde cualquier vista con `toast(...)`.

3. **Capas CSS, temas y mapeo a Tailwind v4 (`apps/admin/src/index.css`)**
   - Orden explícito de cascada: `@layer theme, base, motion-kit, components, utilities;` para que las utilidades de Tailwind (`absolute`, `w-full`, etc.) ganen especificidad sobre `.mk-*`.
   - Importa los estilos base en `layer(motion-kit)`:
     - `@yewdiel21/motion-kit/css/tokens`
     - `@yewdiel21/motion-kit/css/controls`
     - `@yewdiel21/motion-kit/css/effects`
   - Importa 7 temas disponibles en **Configuración → Apariencia** (`THEME_CHOICES` en `apps/admin/src/app/preferences.ts`): `purple`, `blue`, `pink`, `red`, `neogreen`, `black`, `oled`.
   - Aplica un override institucional de **blanco puro y grises neutros** en modo claro (`:root[data-mk-mode='light']` y `prefers-color-scheme: light`), dejando el color del tema solo para acentos.
   - Mapea las variables Material 3 (`--md-sys-color-*`) y tipografías (`--mk-font`, `--mk-font-mono`) mediante `@theme inline` a clases de Tailwind.

4. **Íconos y tokens compartidos**
   - `apps/admin/src/shared/ui/Icon.tsx`: renderiza íconos de **Material Symbols Rounded** usando `.mk-icon` (y `.mk-icon--fill` cuando `filled={true}`).
   - `packages/design-tokens`: consume `@yewdiel21/motion-kit` y `@material/material-color-utilities` para exportar los colores del tema `purple` hacia Android (`VioletColors.kt`) y `tokens.json`.

---

## 2. Entry points disponibles en `@yewdiel21/motion-kit`

| Import | Contenido |
|---|---|
| `@yewdiel21/motion-kit` | Factories vanilla, funciones de motion (`press`, `blurIn`, `blurOut`, `collapse`, `shake`, `ringPulse`, `burst`, `rollDigits`), easings (`EASE`, `ELASTIC`, `PATHS`) y helpers (`gsap`, `Flip`, `ScrollTrigger`, `SplitText`, `CustomEase`, `matchScore`, `parseTime`, `formatTime`, `sanitizeHtml`, etc.) |
| `@yewdiel21/motion-kit/react` | Componentes React, hooks (`useTabs`, `useTheme`, `useDialog`, `useChat`, `useSortable`, `useReflow`, etc.), `ThemeProvider`, `Toaster`, `toast`, `FlipGroup`, `AnimatedNumber`, `MkIcon` |
| `@yewdiel21/motion-kit/theme` | Runtime de tema (`initTheme`, `setTheme`, `setMode`, `getTheme`, `THEMES`, `MK_THEME_HEAD_SCRIPT`, `themeHeadScript`) |
| `@yewdiel21/motion-kit/theme/generate` | Generador de paletas Material 3 (`themeCss`, requiere `@material/material-color-utilities`) |
| `@yewdiel21/motion-kit/auto` | Inicialización declarativa vía `data-mk` (`autoInit`, `MK_HEAD_SCRIPT`) |
| `@yewdiel21/motion-kit/elements` | Custom elements `mk-*` (`defineElements()`) |
| `@yewdiel21/motion-kit/gl` | Efectos WebGL opcionales (`particle-hero`, `liquid-blend`, `matcap`, `shader-grain`, `shader-blur`) |
| `@yewdiel21/motion-kit/css` | Bundle CSS completo (~650 KB — **no importar en `apps/admin`**) |
| `@yewdiel21/motion-kit/css/components/<nombre>` | Hoja de estilo individual por componente |
| `@yewdiel21/motion-kit/css/themes/<nombre>` | Hoja de estilo individual por tema |

---

## 3. Reglas de uso y buenas prácticas en `apps/admin`

1. **CSS modular por componente (prohibido importar el bundle completo)**
   - **No importar** `@yewdiel21/motion-kit/css` (~650 KB).
   - Importar únicamente el CSS de cada componente en el archivo que lo usa, para que viaje en el chunk de esa ruta.
   - Si un componente compone otros controles internos, importar también sus hojas de estilo. Ejemplo real de `apps/admin/src/features/directory/DirectoryPage.tsx`:

```tsx
import { DataTable, EmptyState } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/empty-state';
```

2. **Colores semánticos del tema (no paleta fija de Tailwind)**
   - Usar únicamente las utilidades mapeadas en `index.css`: `bg-primary`, `text-on-primary`, `bg-primary-container`, `text-on-primary-container`, `bg-surface`, `text-on-surface`, `bg-surface-container-low`, `bg-surface-container`, `bg-surface-container-high`, `border-outline-variant`, `bg-error-container`, `text-on-error-container`, etc.
   - **No usar** colores por defecto de Tailwind (`bg-purple-500`, `text-gray-700`, etc.), ya que rompen el cambio de tema y el modo claro/oscuro (`data-mk-mode`).

3. **Configuraciones estáticas fuera del componente**
   - Declarar arreglos constantes como `COLUMNS`, `options` o `actions` a nivel de módulo (fuera del cuerpo del componente React), como en `DirectoryPage.tsx`, para no pasar referencias nuevas en cada render y evitar reinicios innecesarios de los motores internos de `motion-kit`.

4. **Íconos**
   - Para UI general y navegación usar `<Icon name="..." />` (`apps/admin/src/shared/ui/Icon.tsx`, fuente Material Symbols Rounded).
   - Para los íconos SVG integrados de controles (`close`, `expand`, `shrink`, `check`, `alert`, `info`, `send`, `mic`, `sparkle`, `grip`, `toTop`) también existe `<MkIcon name="..." />` en `@yewdiel21/motion-kit/react`.

---

## 4. Componentes y utilidades ya en uso en `apps/admin`

| Componente / Hook / Utilidad | CSS asociado | Archivos donde se utiliza actualmente |
|---|---|---|
| `Nav` | `css/components/nav` | `src/app/AppLayout.tsx` |
| `ThemeProvider`, `Toaster` | `css/components/toast` | `src/main.tsx` |
| `toast` | `css/components/toast` (raíz) | `LoginPage.tsx`, `OptionsMenu.tsx` |
| `ThemePicker` | `css/components/theme-picker` | `src/features/settings/AppearanceMenu.tsx` |
| `useTheme`, `useTabs` | `controls` (raíz) | `src/shared/ui/ThemeModeSelector.tsx` |
| `Dialog` | `css/components/dialog` | `LoginPage.tsx`, `PrivacyNoticeDialog.tsx`, `src/features/dashboard/CustomizeDialog.tsx`, `src/features/settings/SettingsDialog.tsx` |
| `Menu` | `css/components/menu` | `src/features/settings/AppearanceMenu.tsx`, `src/features/settings/OptionsMenu.tsx` |
| `DataTable` | `data-table`, `filter-builder`, `menu`, `select`, `pagination` | `src/features/directory/DirectoryPage.tsx` |
| `EmptyState` | `css/components/empty-state` | `src/features/directory/DirectoryPage.tsx`, `src/features/dashboard/widgets/shared.tsx`, `src/shared/ui/PendingModulePage.tsx` |
| `Calendar` | `css/components/calendar` | `AgendaWidget.tsx` |
| `StatCard` | `css/components/stat-card` | `KpisWidget.tsx` |
| `Chart` | `css/components/chart` | `src/features/dashboard/widgets/TrendWidget.tsx` |
| `ActivityFeed` | `css/components/activity-feed` | `SecurityWidget.tsx` |
| `FlipGroup` | — | `src/features/dashboard/DashboardPage.tsx`, `AlertsWidget.tsx`, `CasesWidget.tsx` |
| `LoadingButton`, `PillButton` | `css/components/loading-button`, `css/components/pill-button` | `LoginPage.tsx` |
| `FadeContent`, `GlowCard`, `SlotText` | `css/components/fade-content`, `css/components/glow-card` (+ `slot-text.css` local) | `LoginHero.tsx` |
| `ChatBackground` | `css/components/chat-background` | `src/features/settings/SettingsDialog.tsx` |

---

## 5. Catálogo recomendado por módulo del MVP SEMUJERES

Todos los componentes listados abajo existen en `@yewdiel21/motion-kit/react` (`0.20.1`) con su hoja correspondiente en `@yewdiel21/motion-kit/css/components/<kebab-case>`:

### A. Ficha Única, Domicilio, Estudio Socioeconómico y Agresor
- **`Stepper` / `Steps`**: flujo multi-paso (Identidad/CURP → Domicilio → Estudio Socioeconómico → Datos del Agresor → Derivación).
- **`Questionnaire`**: formularios guiados por pasos con validación nativa por etapa y foco automático al primer campo inválido.
- **`Select` / `MultiSelect` / `RadioGroup` / `TagInput`**: catálogos de tipos de violencia, modalidades, redes de apoyo, escolaridad o etiquetas.
- **`DateTimePicker`**: registro de fecha y hora de hechos, recepciones o vencimientos.
- **`Attachment`**: carga y vista previa de oficios, identificaciones u órdenes de protección con validación de tipo, peso y cantidad.
- **`SignaturePad`**: firma autógrafa en pantalla (mouse, lápiz o touch) con exportación SVG/PNG y trazos normalizados.
- **`RichTextEditor`**: notas estructuradas y narrativa de hechos con sanitización segura (`sanitizeHtml`).
- **`LoadingButton` / `GlassSwitch`**: envío con estado de carga/éxito/error y banderas booleanas de consentimiento o riesgo.

### B. Agenda y Citas (Recepción / Psicología)
- **`Calendar`**: vista mensual y semanal con eventos y grilla accesible.
- **`SlotPicker`**: selección de día y horario disponible para agendar o reagendar citas ligadas.
- **`RangeCalendar` / `DateRangePicker`**: filtros de agenda y reportes por rango de fechas.
- **`TimeField`**: captura segmentada de hora (`HH:MM`) con validación mínima/máxima.

### C. Expedientes, Seguimiento e Historial Clínico
- **`DataTable` / `EditableTable` / `FilterBuilder` / `Pagination` / `VirtualList`**: búsqueda por CURP, filtros combinados AND/OR, edición en línea y listados extensos.
- **`Timeline` / `ActivityFeed`**: línea de tiempo del expediente (derivaciones, citas, asistencias, hojas de seguimiento, órdenes de protección).
- **`Drawer` / `SplitView` / `ResizablePanel` / `Breadcrumb` / `ScrollArea`**: vista maestro-detalle de expediente e historial clínico sin perder contexto.
- **`Skeleton` / `EmptyState` / `Tooltip` / `Popover` / `HoverCard`**: estados de carga, vacíos y previsualización rápida sin cambiar de ruta.

### D. Alertas y Acciones Críticas (Botón de ayuda / Orden de Protección)
- **`NotificationBell` / `NotificationStack` / `Toaster` (`toast`)**: alertas entrantes desde la app móvil y escalamiento automático por orden de protección vigente.
- **`HoldConfirm` / `SlideConfirm` / `FuseButton`**: confirmación intencional para acciones sensibles (cerrar caso, revocar acceso, activar alerta crítica o confirmar eliminación con split/fuse).
- **`CommandSearch`**: paleta rápida (`Ctrl/⌘ K`) con coincidencia difusa para saltar por CURP, expediente o módulo.

### E. Dashboard, Estadísticas e Informes
- **`StatCard` / `AnimatedNumber`**: KPIs con conteo animado y tendencia.
- **`Chart` / `PieChart` / `RadarChart` / `RadialChart` / `HeatmapChart` / `SankeyChart` / `ChartTooltip`**: gráficas interactivas sin runtime externo y con tabla accesible integrada.

---

## 6. Ajustes locales vigentes y notas

1. **Overrides actuales en `apps/admin/src/index.css`**
   - `.mk-nav__name`: evita saltos de línea en etiquetas del nav lateral (`white-space: nowrap; text-overflow: ellipsis`).
   - `.mk-nav__icon > .mk-icon`: fija bloque `display: block` y tamaño `--mk-nav-icon-size` (`24px`) para Material Symbols.
   - `.mk-nav--dock` y `.mk-nav--rail` (desde `min-width: 680px`): corrige centrado del dock en `.mk-shell` y añade `gap: 8px` en el riel lateral.
   - `.mk-menu.vc-menu`: variante más amplia (`min-width: 288px`, ítems `min-height: 52px`).
   - `.mk-calendar.vc-calendar-compact`: widget lateral de calendario compacto (`--mk-calendar-day-height: 44px`) que sustituye los chips de eventos por un indicador circular.

2. **Estilo temporal pendiente**
   - `apps/admin/src/shared/ui/slot-text.css` contiene un `TODO` para eliminarse cuando `@yewdiel21/motion-kit` exporte `@yewdiel21/motion-kit/css/recipes/slot-text`.

3. **Nota sobre `MOTION-KIT-ISSUES.md`**
   - `apps/admin/README.md` enlaza a `MOTION-KIT-ISSUES.md`, pero ese archivo no se encuentra presente actualmente en el repositorio.
