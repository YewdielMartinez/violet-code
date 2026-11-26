# Violet Code Administration

Panel web de SEMUJERES. React 19 + TypeScript + Vite + **Tailwind v4** + **motion-kit**.

```sh
npm run dev -w @violet-code/admin     # http://localhost:5173 (conectado directo a Supabase)
npm run lint -w @violet-code/admin
npm run build -w @violet-code/admin
```

## Estructura (por feature)

```
src/
  app/            router, layout, navegación (navigation.ts = mapa de módulos)
  features/
    dashboard/    indicadores
    directory/    directorio y Puntos Violeta (ejemplo completo: api.ts + página)
    <modulo>/     api.ts (hooks TanStack Query) + páginas + componentes del módulo
  shared/
    api/          cliente HTTP (token en memoria)
    ui/           componentes propios reutilizables
```

**Agregar un módulo:** crear `src/features/<modulo>/`, registrar la página en `app/router.tsx` y marcar `ready: true` en `app/navigation.ts`.

## Estilos

- **Componentes complejos** (tablas, gráficas, navegación, estados vacíos, diálogos): `@yewdiel21/motion-kit/react`.
- **Layout y estilos propios:** Tailwind. Los colores de Tailwind son los del tema: `bg-primary`, `text-on-surface`, `bg-surface-container`, `border-outline-variant`, `bg-error-container`…
- **No usar colores de la paleta por defecto de Tailwind** (`bg-purple-500`, etc.): rompen el modo oscuro y el tema.

## Problemas conocidos de motion-kit

Ver [MOTION-KIT-ISSUES.md](MOTION-KIT-ISSUES.md): errores y fricciones detectados, con su parche temporal y la corrección sugerida.
