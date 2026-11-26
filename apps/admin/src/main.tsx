import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider, Toaster } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/toast';
import { router } from '@/app/router';
import { registerCustomThemes, THEME_STORAGE_KEY } from '@/app/theme';
import './index.css';

registerCustomThemes();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

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
    {/* Tema "purple" de motion-kit; modo claro/oscuro sigue al sistema hasta que la persona elija. */}
    <ThemeProvider defaultTheme="purple" mode="system" storageKey={THEME_STORAGE_KEY}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
