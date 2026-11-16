import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    // En desarrollo, /api y /health se reenvían a Violet Code Core (dotnet run → :5080).
    proxy: {
      '/api': 'http://localhost:5080',
      '/health': 'http://localhost:5080',
    },
  },
});
