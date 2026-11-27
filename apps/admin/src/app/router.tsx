import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ALL_PAGES } from './navigation';
import { BootBar } from './BootBar';
import { queryClient } from './queryClient';
import {
  ActividadesPage,
  AgendaPage,
  AlertasPage,
  BitacoraPage,
  DashboardPage,
  DirectoryPage,
  EstadisticasPage,
  ExpedienteDetailPage,
  ExpedientesPage,
  IntervencionesPage,
  LoginPage,
  NuevaFichaPage,
  ActividadFormPage,
  PendingModulePage,
  PrivacyNoticePage,
  UsuarioFormPage,
  UsuariosPage,
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
 * en su useEffect → chunk de AppLayout → chunk de la página). Aquí, al evaluar el entry, se descargan
 * el guard, el layout y la página de la URL actual a la vez.
 * RequireAuth/LoginPage siguen llamando a refreshSession() si el estado es 'checking', pero
 * refreshSession() reutiliza la promesa en curso (y al resolverse el estado ya no es 'checking'),
 * así que la sesión se valida una sola vez.
 *
 * Rutas públicas (/login, /aviso-de-privacidad): se precarga SOLO su página; la sesión se valida
 * únicamente si hay token guardado (si no, no hay nada que validar y se evita traer el cliente de
 * Supabase antes de tiempo: LoginPage lo importa de todos modos al renderizar).
 */
function warmStart() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  const hasSession = hasStoredSupabaseSession();
  if (path === '/login' || path === '/aviso-de-privacidad') {
    preloadPage(path);
    if (hasSession) void import('@/shared/auth/session').then((m) => m.refreshSession());
    return;
  }
  void import('@/shared/auth/session').then((m) => m.refreshSession());
  void loadRequireAuth();
  // Sin sesión guardada el guard redirigirá a /login: se precarga esa pantalla en lugar del layout y la página pedida.
  if (!hasSession) {
    preloadPage('/login');
    return;
  }
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
  '/expedientes': ExpedientesPage,
  '/solicitudes': AlertasPage,
  '/agenda': AgendaPage,
  '/actividades': ActividadesPage,
  '/intervenciones': IntervencionesPage,
  '/estadisticas': EstadisticasPage,
  '/bitacora': BitacoraPage,
  '/usuarios': UsuariosPage,
};

// Las páginas se precargan, así que normalmente no se ve: si una tarda, aparece (tras 150 ms) una barra fija
// en el borde superior, que no ocupa espacio y por tanto no desplaza el contenido cuando llega la página.
const pageFallback = <BootBar late />;
// Arranque: ocupa el lugar de la barra estática de index.html para que no desaparezca al montar React.
const bootFallback = <BootBar />;

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={bootFallback}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/aviso-de-privacidad',
    element: (
      <Suspense fallback={bootFallback}>
        <PrivacyNoticePage />
      </Suspense>
    ),
  },
  {
    element: (
      <Suspense fallback={bootFallback}>
        <RequireAuth>
          <Suspense fallback={bootFallback}>
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
        path: '/directorio',
        element: (
          <Suspense fallback={pageFallback}>
            <DirectoryPage />
          </Suspense>
        ),
      },
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
        path: '/actividades/nuevo',
        element: (
          <Suspense fallback={pageFallback}>
            <ActividadFormPage />
          </Suspense>
        ),
      },
      {
        path: '/usuarios/nuevo',
        element: (
          <Suspense fallback={pageFallback}>
            <UsuarioFormPage />
          </Suspense>
        ),
      },
      {
        path: '/usuarios/:id',
        element: (
          <Suspense fallback={pageFallback}>
            <UsuarioFormPage />
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
