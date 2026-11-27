import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { themeHeadScript } from '@yewdiel21/motion-kit/theme';
import { fileURLToPath, URL } from 'node:url';
import { retiredThemeHeadScript } from './src/app/retiredThemes.ts';
import { THEME_STORAGE_KEY } from './src/app/theme.ts';

/**
 * Inserta el script de tema de motion-kit en <head>: aplica tema y modo (claro/oscuro) guardados
 * ANTES del primer pintado, sin destello. Usa THEME_STORAGE_KEY de src/app/theme.ts (antes el literal
 * 'vc-theme' no coincidía con 'vc-theme-v2' y el modo/tema guardado se aplicaba hasta que cargaba el JS).
 * Antes migra temas retirados (purple, neogreen) guardados en localStorage a salmverse.
 */
function motionKitTheme(): Plugin {
  return {
    name: 'motion-kit-theme',
    transformIndexHtml: () => [
      {
        tag: 'script',
        children:
          retiredThemeHeadScript(THEME_STORAGE_KEY) +
          themeHeadScript({ default: 'salmverse', mode: 'system', storageKey: THEME_STORAGE_KEY }),
        injectTo: 'head-prepend',
      },
    ],
  };
}

/** Módulos de cada ruta que se precargan desde el HTML (misma lista de páginas que src/app/pages.ts). */
const ROUTE_PRELOADS: Record<string, { public?: boolean; modules: string[] }> = {
  '/login': { public: true, modules: ['features/auth/LoginPage'] },
  '/aviso-de-privacidad': { public: true, modules: ['features/auth/PrivacyNoticePage'] },
  '/': { modules: ['features/dashboard/DashboardPage'] },
  '/expedientes': { modules: ['features/expedientes/ExpedientesPage'] },
  '/expedientes/:id': { modules: ['features/expedientes/ExpedienteDetailPage'] },
  '/solicitudes': { modules: ['features/solicitudes/AlertasPage'] },
  '/agenda': { modules: ['features/agenda/AgendaPage'] },
  '/actividades': { modules: ['features/actividades/ActividadesPage'] },
  '/intervenciones': { modules: ['features/intervenciones/IntervencionesPage'] },
  '/usuarios': { modules: ['features/usuarios/UsuariosPage'] },
};
const SHELL_MODULES = ['app/RequireAuth', 'app/AppLayout'];

/**
 * Pistas de precarga por ruta en el HTML de producción. Los chunks de la ruta (guard, layout, página y sus
 * dependencias estáticas) solo se pedían cuando el entry terminaba de ejecutarse (index.js + vendor-react
 * + evaluación con CPU lenta): una cascada de ~450 ms en 4G. Un script inline mínimo añade
 * <link rel="modulepreload"> (y preload de CSS) según location.pathname (el script va al inicio del <head>: tras el <link rel="stylesheet"> bloquearía hasta que llegue el CSS), así todo viaja en paralelo con el
 * entry. Si no hay token de Supabase guardado en una ruta privada, se precarga /login (a donde redirige).
 * Los nombres con hash salen del bundle, por eso solo aplica en build (en dev no hay bundle y se omite).
 */
function routePreloadHints(): Plugin {
  let base = '/';
  return {
    name: 'vc-route-preload-hints',
    configResolved(config: ResolvedConfig) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return undefined;
        type Chunk = {
          fileName: string;
          imports: string[];
          moduleIds: string[];
          viteMetadata?: { importedCss?: Set<string> };
        };
        const chunks = Object.values(bundle).filter((o) => o.type === 'chunk') as unknown as Chunk[];
        const byName = new Map(chunks.map((c) => [c.fileName, c]));
        const entryImports = new Set<string>();
        const collect = (name: string, into: Set<string>) => {
          if (into.has(name)) return;
          into.add(name);
          for (const dep of byName.get(name)?.imports ?? []) collect(dep, into);
        };
        // Lo que el HTML ya precarga por sí mismo (entry y sus imports estáticos) no se repite.
        for (const c of chunks) if ((c as { isEntry?: boolean }).isEntry) collect(c.fileName, entryImports);
        const entryCss = new Set<string>();
        for (const f of entryImports) for (const c of byName.get(f)?.viteMetadata?.importedCss ?? []) entryCss.add(c);
        const chunkFor = (mod: string) =>
          chunks.find((c) => c.moduleIds.some((id) => id.replace(/\\/g, '/').endsWith(`/src/${mod}.tsx`)));
        const resolve = (mods: string[]) => {
          const js = new Set<string>();
          for (const mod of mods) {
            const chunk = chunkFor(mod);
            if (!chunk) throw new Error(`[vc-route-preload-hints] no hay chunk para src/${mod}.tsx`);
            collect(chunk.fileName, js);
          }
          const css = new Set<string>();
          for (const f of js) for (const c of byName.get(f)?.viteMetadata?.importedCss ?? []) css.add(c);
          return {
            js: [...js].filter((f) => !entryImports.has(f)).map((f) => base + f),
            css: [...css].filter((f) => !entryCss.has(f)).map((f) => base + f),
          };
        };
        const shell = SHELL_MODULES;
        const map: Record<string, { pub?: 1; js: string[]; css: string[] }> = {};
        for (const [route, def] of Object.entries(ROUTE_PRELOADS)) {
          map[route] = { ...(def.public ? { pub: 1 as const } : {}), ...resolve(def.public ? def.modules : [...shell, ...def.modules]) };
        }
        const script =
          `(function(){var p=location.pathname.replace(/\\/+$/,'')||'/',M=${JSON.stringify(map)},s=0;` +
          `try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('sb-')===0&&k.slice(-11)==='-auth-token'){s=1;break}}}catch(e){}` +
          `var r=M[p]||(/^\\/expedientes\\/[^/]+$/.test(p)&&p!=='/expedientes/nuevo'?M['/expedientes/:id']:null);` +
          `if(!r)return;if(!r.pub&&!s)r=M['/login'];` +
          `function a(t,h,x){var l=document.createElement('link');l.rel=t;l.href=h;l.crossOrigin='';if(x)l.setAttribute('as','style');document.head.appendChild(l)}` +
          `r.js.forEach(function(h){a('modulepreload',h)});r.css.forEach(function(h){a('preload',h,1)})})();`;
        return [{ tag: 'script', children: script, injectTo: 'head-prepend' }];
      },
    },
  };
}

export default defineConfig({
  plugins: [motionKitTheme(), routePreloadHints(), react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // El worker de Whisper (dictado por voz local) importa módulos ES.
  worker: { format: 'es' },
  build: {
    // modulePreload queda habilitado (valor por defecto): Vite inyecta <link rel="modulepreload"> para las
    // dependencias estáticas del entry y precarga las de cada import() dinámico antes de ejecutarlo.
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        // @yewdiel21/motion-kit publica ~570 módulos ESM diminutos (tsup con splitting). Sin agrupar,
        // cada ruta pedía 60-90 archivos .js (HTTP/1.1: 6 conexiones por host + 170 ms de RTT en 4G).
        // `experimentalMinChunkSize` hace que Rollup fusione los chunks menores a este tamaño con vecinos
        // que ya se cargan junto con ellos, sin traer código de más a una ruta y conservando el reparto por ruta.
        experimentalMinChunkSize: 40_000,
        // Librerías base en chunks propios para reutilizar caché entre deploys.
        // Se usa función (no objeto) para incluir react-dom/client y scheduler en vendor-react.
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) return undefined;
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/scheduler/') ||
            normalized.includes('/node_modules/react-router/') ||
            normalized.includes('/node_modules/react-router-dom/') ||
            normalized.includes('/node_modules/@tanstack/')
          ) {
            return 'vendor-react';
          }
          if (
            normalized.includes('/node_modules/@supabase/') ||
            normalized.includes('/node_modules/iceberg-js/') ||
            normalized.includes('/node_modules/tslib/')
          ) {
            return 'vendor-supabase';
          }
          if (normalized.includes('/node_modules/gsap/')) {
            return 'vendor-gsap';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
