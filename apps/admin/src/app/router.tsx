import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ALL_PAGES } from './navigation';
import { queryClient } from './queryClient';
import {
  AlertasPage,
  DashboardPage,
  DirectoryPage,
  ExpedienteDetailPage,
  ExpedientesPage,
  LoginPage,
  NuevaFichaPage,
  PendingModulePage,
  preloadPage,
} from './pages';

const loadAppLayout = () => import('./AppLayout');
const loadRequireAuth = () => import('./RequireAuth');
const AppLayout = lazy(() => loadAppLayout().then((m) => ({ default: m.AppLayout })));
const RequireAuth = lazy(() => loadRequireAuth().then((m) => ({ default: m.RequireAuth })));

type PreloadableDrawerTab =
  | 'agresor'
  | 'documentos'
  | 'canalizaciones'
  | 'ordenes'
  | 'seguimiento'
  | 'notas';

function isPreloadableDrawerTab(tab: string | null): tab is PreloadableDrawerTab {
  return (
    tab === 'agresor' ||
    tab === 'documentos' ||
    tab === 'canalizaciones' ||
    tab === 'ordenes' ||
    tab === 'seguimiento' ||
    tab === 'notas'
  );
}

function hasStoredSupabaseSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }
  } catch {
    // Ignora bloqueos de almacenamiento.
  }
  return false;
}

/**
 * Arranque en paralelo: sin esto la carga en frío era serial (chunk de RequireAuth → validar sesión
 * en su useEffect → chunk de AppLayout → chunk de la página). Aquí, al evaluar el entry, se pide la
 * sesión y se descargan el guard, el layout y la página de la URL actual a la vez.
 * RequireAuth/LoginPage siguen llamando a refreshSession() si el estado es 'checking', pero
 * refreshSession() reutiliza la promesa en curso (y al resolverse el estado ya no es 'checking'),
 * así que la sesión se valida una sola vez.
 */
function warmStart() {
  if (typeof window === 'undefined') return;
  void import('@/shared/auth/session').then((m) => m.refreshSession());
  const path = window.location.pathname;
  if (path === '/login') return;
  void loadRequireAuth();
  void loadAppLayout();
  preloadPage(path);

  const detailMatch = /^\/expedientes\/([^/]+)$/.exec(path);
  const detailId =
    detailMatch && detailMatch[1] !== 'nuevo' ? decodeURIComponent(detailMatch[1]) : null;

  if (detailId) {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (isPreloadableDrawerTab(tab)) {
      void import('@/features/expedientes/ExpedienteDrawer').then((m) =>
        m.preloadExpedienteDrawerTab(tab),
      );
    }
    if (hasStoredSupabaseSession()) {
      void import('@/features/expedientes/api').then((api) => {
        void queryClient.prefetchQuery(api.expedienteByIdQueryOptions(detailId));
        void queryClient.prefetchQuery(api.fichaDetailQueryOptions(detailId));
      });
    }
  } else if (path === '/expedientes') {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (isPreloadableDrawerTab(tab)) {
      void import('@/features/expedientes/ExpedienteDrawer').then((m) =>
        m.preloadExpedienteDrawerTab(tab),
      );
    }
    if (hasStoredSupabaseSession()) {
      const expedienteId = params.get('expediente');
      void import('@/features/expedientes/api').then((api) => {
        void queryClient.prefetchQuery(api.expedientesListQueryOptions());
        if (expedienteId) {
          void queryClient.prefetchQuery(api.fichaDetailQueryOptions(expedienteId));
        }
      });
    }
  }
}

warmStart();

// Páginas implementadas. Al terminar un módulo: agregarlo aquí y marcar `ready: true` en navigation.ts.
const READY: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/directorio': DirectoryPage,
  '/expedientes': ExpedientesPage,
  '/solicitudes': AlertasPage,
};

// Sin esqueleto: las páginas ya están precargadas; si alguna tarda, no se muestra un parpadeo intermedio.
const pageFallback = null;

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: (
      <Suspense fallback={null}>
        <RequireAuth>
          <Suspense fallback={null}>
            <AppLayout />
          </Suspense>
        </RequireAuth>
      </Suspense>
    ),
    children: [
      ...ALL_PAGES.map(({ path, label, title }) => {
        const Page = READY[path];
        return {
          path,
          element: <Suspense fallback={pageFallback}>{Page ? <Page /> : <PendingModulePage title={title ?? label} />}</Suspense>,
        };
      }),
      {
        path: '/expedientes/nuevo',
        element: (
          <Suspense fallback={pageFallback}>
            <NuevaFichaPage />
          </Suspense>
        ),
      },
      {
        path: '/expedientes/:id',
        element: (
          <Suspense fallback={pageFallback}>
            <ExpedienteDetailPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={pageFallback}>
            <PendingModulePage title="Página no encontrada" />
          </Suspense>
        ),
      },
    ],
  },
]);
