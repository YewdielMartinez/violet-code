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
        children: themeHeadScript({ default: 'purple', mode: 'system', storageKey: 'vc-theme' }),
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
        // Librerías en chunks propios: cambian poco, así el navegador las reutiliza entre deploys.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'vendor-motion': ['@yewdiel21/motion-kit/react', 'gsap'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
