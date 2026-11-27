import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/toast';
import { queryClient } from '@/app/queryClient';
import { router } from '@/app/router';
import { sanitizeStoredTheme } from '@/app/retiredThemes';
import { registerCustomThemes, THEME_STORAGE_KEY } from '@/app/theme';
import { installFileInputCancelGuard } from '@/shared/dom/fileInputCancelGuard';
import './app/boot.css';
import './index.css';

// Temas retirados (purple, neogreen) guardados en vc-theme vuelven a salmverse antes de montar ThemeProvider.
sanitizeStoredTheme(THEME_STORAGE_KEY);
registerCustomThemes();
installFileInputCancelGuard();

// El Toaster arrastra GSAP (~61 kB gzip): se carga aparte para que no bloquee el primer pintado.
// Los toast() emitidos antes de montarlo no se pierden: la cola vive en el store del kit (módulo
// compartido) y el Toaster pinta los pendientes al crearse.
const Toaster = lazy(() => import('@/shared/ui/AppToaster').then((m) => ({ default: m.Toaster })));

const ICON_FONT = '24px "Material Symbols Rounded"';

/**
 * Oculta glifos de Material Symbols mientras carga la hoja de fuentes asíncrona
 * para que no parpadeen nombres de ligadura (p. ej. "light_mode") antes del ícono.
 */
function hideIconsUntilFontReady() {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  if (document.fonts.check(ICON_FONT)) return;

  const root = document.documentElement;
  root.classList.add('vc-icons-loading');

  let done = false;
  let timer: ReturnType<typeof window.setTimeout> | undefined;

  const finish = () => {
    if (done) return;
    done = true;
    root.classList.remove('vc-icons-loading');
    document.fonts.removeEventListener('loadingdone', onLoadingDone);
    if (timer !== undefined) window.clearTimeout(timer);
  };

  const onLoadingDone = () => {
    if (document.fonts.check(ICON_FONT)) finish();
  };

  const triggerFontLoad = () => {
    if (document.fonts.check(ICON_FONT)) {
      finish();
      return;
    }
    void document.fonts.load(ICON_FONT).then(finish, finish);
  };

  document.fonts.addEventListener('loadingdone', onLoadingDone);
  timer = window.setTimeout(finish, 2500);

  const link = document.getElementById('vc-fonts') as HTMLLinkElement | null;
  if (!link || link.rel === 'stylesheet' || link.dataset.loaded === '1') {
    triggerFontLoad();
  } else {
    link.addEventListener('load', () => window.setTimeout(triggerFontLoad, 0), { once: true });
    link.addEventListener('error', finish, { once: true });
  }
}

hideIconsUntilFontReady();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Tema predeterminado "salmverse" (rosa/tinto institucional); modo claro/oscuro sigue al sistema hasta que la persona elija. */}
    <ThemeProvider defaultTheme="salmverse" mode="system" storageKey={THEME_STORAGE_KEY}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
