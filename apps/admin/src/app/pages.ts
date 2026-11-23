import { lazy } from 'react';

// Cada página es su propio chunk. Las funciones de carga se reutilizan para precargar.
const loadLogin = () => import('@/features/auth/LoginPage');
const loadDashboard = () => import('@/features/dashboard/DashboardPage');
const loadDirectory = () => import('@/features/directory/DirectoryPage');
const loadPending = () => import('@/shared/ui/PendingModulePage');

export const LoginPage = lazy(loadLogin);
export const DashboardPage = lazy(loadDashboard);
export const DirectoryPage = lazy(loadDirectory);
export const PendingModulePage = lazy(loadPending);

/**
 * Descarga las páginas del panel en segundo plano después de iniciar sesión.
 * Así, al navegar no aparece primero un esqueleto y luego la página ("carga doble").
 */
export function preloadPages() {
  void loadDashboard();
  void loadDirectory();
  void loadPending();
}
