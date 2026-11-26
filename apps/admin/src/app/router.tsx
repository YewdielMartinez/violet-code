import { Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ALL_PAGES } from './navigation';
import {
  CanalizacionesPage,
  DashboardPage,
  DirectoryPage,
  ExpedientesPage,
  LoginPage,
  NuevaFichaPage,
  PendingModulePage,
} from './pages';
import { RequireAuth } from './RequireAuth';

// Páginas implementadas. Al terminar un módulo: agregarlo aquí y marcar `ready: true` en navigation.ts.
const READY: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/directorio': DirectoryPage,
  '/expedientes': ExpedientesPage,
  '/canalizaciones': CanalizacionesPage,
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
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
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
