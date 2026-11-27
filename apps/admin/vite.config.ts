import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { themeHeadScript } from '@yewdiel21/motion-kit/theme';
import { fileURLToPath, URL } from 'node:url';

/**
 * Inserta el script de tema de motion-kit en <head>: aplica tema y modo (claro/oscuro) guardados
 * ANTES del primer pintado, sin destello. Misma clave que src/app/theme.ts.
 */
function motionKitTheme(): Plugin {
  return {
    name: 'motion-kit-theme',
    transformIndexHtml: () => [
      {
        tag: 'script',
        children: themeHeadScript({ default: 'salmverse', mode: 'system', storageKey: 'vc-theme-v2' }),
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  plugins: [motionKitTheme(), react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Librerías base en chunks propios para reutilizar caché entre deploys.
        // Se usa función (no objeto) para incluir react-dom/client y scheduler en vendor-react.
        // @yewdiel21/motion-kit queda fuera a propósito para que Rollup lo divida por ruta en cuanto
        // publique módulos ESM por componente (en 0.20.2 su dist/react/index.js sigue siendo monolítico).
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
