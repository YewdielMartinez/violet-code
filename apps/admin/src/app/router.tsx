import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ALL_PAGES } from './navigation';

// Cada página es su propio chunk: la tabla de datos, gráficas, etc. solo se descargan
// al entrar a la ruta que los usa (bundle-dynamic-imports).
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const DirectoryPage = lazy(() => import('@/features/directory/DirectoryPage'));
const PendingModulePage = lazy(() => import('@/shared/ui/PendingModulePage'));

// Páginas implementadas. Al terminar un módulo: agregarlo aquí y marcar `ready: true` en navigation.ts.
const READY: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/directorio': DirectoryPage,
};

const pageFallback = <div className="h-64 animate-pulse rounded-3xl bg-surface-container" />;

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      ...ALL_PAGES.map(({ path, label }) => {
        const Page = READY[path];
        return {
          path,
          element: <Suspense fallback={pageFallback}>{Page ? <Page /> : <PendingModulePage title={label} />}</Suspense>,
        };
      }),
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
