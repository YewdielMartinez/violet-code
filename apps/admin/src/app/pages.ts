import { lazy } from 'react';

// Cada página es su propio chunk. Las funciones de carga se reutilizan para precargar.
const loadLogin = () => import('@/features/auth/LoginPage');
const loadDashboard = () => import('@/features/dashboard/DashboardPage');
const loadDirectory = () => import('@/features/directory/DirectoryPage');
const loadExpedientes = () => import('@/features/expedientes/ExpedientesPage');
const loadExpedienteDetail = () => import('@/features/expedientes/ExpedienteDetailPage');
const loadNuevaFicha = () => import('@/features/expedientes/ficha/NuevaFichaPage');
const loadAgenda = () => import('@/features/agenda/AgendaPage');
const loadActividades = () => import('@/features/actividades/ActividadesPage');
const loadIntervenciones = () => import('@/features/intervenciones/IntervencionesPage');
const loadAlertas = () => import('@/features/solicitudes/AlertasPage');
const loadUsuarios = () => import('@/features/usuarios/UsuariosPage');
const loadUsuarioForm = () => import('@/features/usuarios/UsuarioFormPage');
const loadPending = () => import('@/shared/ui/PendingModulePage');

export const LoginPage = lazy(loadLogin);
export const DashboardPage = lazy(loadDashboard);
export const DirectoryPage = lazy(loadDirectory);
export const ExpedientesPage = lazy(loadExpedientes);
export const ExpedienteDetailPage = lazy(loadExpedienteDetail);
export const NuevaFichaPage = lazy(loadNuevaFicha);
export const AgendaPage = lazy(loadAgenda);
export const ActividadesPage = lazy(loadActividades);
export const IntervencionesPage = lazy(loadIntervenciones);
export const AlertasPage = lazy(loadAlertas);
export const UsuariosPage = lazy(loadUsuarios);
export const UsuarioFormPage = lazy(loadUsuarioForm);
export const PendingModulePage = lazy(loadPending);

const started = new WeakSet<() => Promise<unknown>>();

function loadOnce(loader: () => Promise<unknown>) {
  if (started.has(loader)) return;
  started.add(loader);
  void loader();
}

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  '/': loadDashboard,
  '/directorio': loadDirectory,
  '/expedientes': loadExpedientes,
  '/expedientes/nuevo': loadNuevaFicha,
  '/solicitudes': loadAlertas,
  '/agenda': loadAgenda,
  '/actividades': loadActividades,
  '/intervenciones': loadIntervenciones,
  '/usuarios': loadUsuarios,
  '/usuarios/nuevo': loadUsuarioForm,
};

/** Precarga el chunk de una ruta al pasar el cursor o enfocar un enlace de navegación. */
export function preloadPage(path: string): void {
  if (/^\/expedientes\/(?!nuevo$)[^/]+$/.test(path)) {
    loadOnce(loadExpedienteDetail);
    return;
  }
  if (/^\/usuarios\/[^/]+$/.test(path)) {
    loadOnce(loadUsuarioForm);
    return;
  }
  loadOnce(ROUTE_LOADERS[path] ?? loadPending);
}

const PANEL_LOADERS = [loadDashboard, loadExpedientes, loadDirectory, loadNuevaFicha, loadAlertas, loadAgenda, loadActividades, loadIntervenciones, loadUsuarios, loadUsuarioForm, loadPending];

function scheduleIdle(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => { };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(cb, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 1500);
  return () => window.clearTimeout(id);
}

/**
 * Descarga las páginas del panel una a una en momentos de inactividad después de iniciar sesión,
 * sin competir con la ruta actual (y respetando ahorro de datos).
 */
export function preloadPages(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => { };
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: { saveData?: boolean } }) : null;
  if (nav?.connection?.saveData) return () => { };

  let index = 0;
  let cancel: (() => void) | null = null;
  let graceTimer: number | null = null;
  let cancelled = false;

  const step = () => {
    while (index < PANEL_LOADERS.length && started.has(PANEL_LOADERS[index])) index++;
    if (cancelled || index >= PANEL_LOADERS.length) return;
    loadOnce(PANEL_LOADERS[index++]);
    if (index < PANEL_LOADERS.length) cancel = scheduleIdle(step);
  };

  const startGraceTimer = () => {
    if (cancelled) return;
    graceTimer = window.setTimeout(() => {
      graceTimer = null;
      if (!cancelled) cancel = scheduleIdle(step);
    }, 4000);
  };

  const onLoad = () => {
    window.removeEventListener('load', onLoad);
    startGraceTimer();
  };

  if (document.readyState === 'complete') {
    startGraceTimer();
  } else {
    window.addEventListener('load', onLoad, { once: true });
  }

  return () => {
    cancelled = true;
    window.removeEventListener('load', onLoad);
    if (graceTimer !== null) {
      window.clearTimeout(graceTimer);
      graceTimer = null;
    }
    cancel?.();
  };
}
