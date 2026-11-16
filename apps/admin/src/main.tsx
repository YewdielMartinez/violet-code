import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider, Toaster } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/toast';
import { router } from '@/app/router';
import { THEME_STORAGE_KEY } from '@/app/theme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

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
