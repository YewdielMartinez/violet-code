import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ALL_PAGES } from './navigation';
import {
  AlertasPage,
  CanalizacionesPage,
  DashboardPage,
  DirectoryPage,
  ExpedientesPage,
  IntervencionesPage,
  LoginPage,
  NuevaFichaPage,
  PendingModulePage,
  preloadPage,
} from './pages';

const loadAppLayout = () => import('./AppLayout');
const loadRequireAuth = () => import('./RequireAuth');
const AppLayout = lazy(() => loadAppLayout().then((m) => ({ default: m.AppLayout })));
const RequireAuth = lazy(() => loadRequireAuth().then((m) => ({ default: m.RequireAuth })));

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
}

warmStart();

// Páginas implementadas. Al terminar un módulo: agregarlo aquí y marcar `ready: true` en navigation.ts.
const READY: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/directorio': DirectoryPage,
  '/expedientes': ExpedientesPage,
  '/canalizaciones': CanalizacionesPage,
  '/solicitudes': AlertasPage,
  '/intervenciones': IntervencionesPage,
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
