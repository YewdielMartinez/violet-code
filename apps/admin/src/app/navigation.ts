import type { StaffRole } from '@/domain/models/Auth';

/**
 * Mapa de navegación del panel alineado con los 7 roles reales en Supabase.
 * `ready: false` = módulo con página "en construcción".
 * `icon`: nombre de Material Symbols Rounded. `mobilePriority`: prioridad en la barra inferior móvil (menor = antes);
 * la barra de cada rol toma las `MOBILE_NAV_MAX` páginas de mayor prioridad a las que ese rol tiene acceso.
 */
export interface NavPage {
  path: string;
  /** Nombre corto para el nav (una línea). */
  label: string;
  /** Título completo de la pantalla (si difiere del nombre corto). */
  title?: string;
  icon: string;
  ready: boolean;
  /** Prioridad en la barra móvil (1 = la primera en entrar). Sin valor: nunca va en la barra. */
  mobilePriority?: number;
  allowedRoles: readonly StaffRole[];
}

const ALL_EMPLOYEES: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
  'recepcion',
];

const ATTENTION_AND_DIRECTION: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
];

const DIRECTION_ONLY: readonly StaffRole[] = ['titular', 'subdireccion'];

export const NAVIGATION: NavPage[] = [
  {
    path: '/',
    label: 'Tablero',
    icon: 'space_dashboard',
    ready: true,
    mobilePriority: 1,
    allowedRoles: [...ALL_EMPLOYEES, 'umeca'],
  },
  {
    path: '/solicitudes',
    label: 'Solicitudes',
    title: 'Solicitudes y alertas',
    icon: 'notifications_active',
    ready: true,
    mobilePriority: 4,
    allowedRoles: ATTENTION_AND_DIRECTION,
  },
  {
    path: '/expedientes',
    label: 'Expedientes',
    icon: 'folder_shared',
    ready: true,
    mobilePriority: 3,
    allowedRoles: ATTENTION_AND_DIRECTION,
  },
  {
    path: '/agenda',
    label: 'Agenda',
    icon: 'calendar_month',
    ready: true,
    mobilePriority: 2,
    allowedRoles: ALL_EMPLOYEES,
  },
  {
    // `actividad.ver` = todo el personal activo; solo dirección y áreas de atención ven «Nueva actividad».
    path: '/actividades',
    label: 'Actividades',
    title: 'Actividades preventivas',
    icon: 'diversity_3',
    ready: true,
    mobilePriority: 5,
    allowedRoles: ALL_EMPLOYEES,
  },
  {
    path: '/estadisticas',
    label: 'Estadísticas',
    icon: 'monitoring',
    ready: false,
    allowedRoles: DIRECTION_ONLY,
  },
  {
    path: '/usuarios',
    label: 'Usuarios',
    icon: 'manage_accounts',
    ready: false,
    allowedRoles: DIRECTION_ONLY,
  },
];

export const ALL_PAGES = NAVIGATION;

/** Máximo de botones en la barra inferior móvil. */
export const MOBILE_NAV_MAX = 5;

/**
 * Rutas que van en la barra móvil del rol: las `MOBILE_NAV_MAX` páginas de mayor `mobilePriority` a las que el rol
 * puede entrar (Tablero, Agenda, Expedientes, Solicitudes, Actividades, Directorio). El kit no ofrece «Más»,
 * así que el resto solo se ve en el riel de escritorio.
 */
export function getMobilePaths(role: StaffRole | undefined): ReadonlySet<string> {
  const top = getNavigationForRole(role)
    .filter((page) => page.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority as number) - (b.mobilePriority as number))
    .slice(0, MOBILE_NAV_MAX);
  return new Set(top.map((page) => page.path));
}

export function getNavigationForRole(role: StaffRole | undefined): NavPage[] {
  if (!role) return [];
  return NAVIGATION.filter((page) => page.allowedRoles.includes(role));
}

export function canAccessPath(role: StaffRole | undefined, pathname: string): boolean {
  if (!role) return false;
  if (pathname === '/expedientes/nuevo') {
    return role === 'titular' || role === 'subdireccion' || role === 'trabajo_social';
  }
  if (pathname.startsWith('/expedientes/')) {
    return ATTENTION_AND_DIRECTION.includes(role);
  }
  const page = NAVIGATION.find((item) => item.path === pathname);
  if (!page) return role !== 'umeca';
  return page.allowedRoles.includes(role);
}
