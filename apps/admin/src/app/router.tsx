import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ALL_PAGES } from './navigation';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DirectoryPage } from '@/features/directory/DirectoryPage';
import { PendingModulePage } from '@/shared/ui/PendingModulePage';

// Páginas implementadas. Al terminar un módulo: agregarlo aquí y marcar `ready: true` en navigation.ts.
const READY: Record<string, React.ReactNode> = {
  '/': <DashboardPage />,
  '/directorio': <DirectoryPage />,
};

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      ...ALL_PAGES.map((page) => ({
        path: page.path,
        element: READY[page.path] ?? <PendingModulePage title={page.label} />,
      })),
      { path: '*', element: <PendingModulePage title="Página no encontrada" /> },
    ],
  },
]);
