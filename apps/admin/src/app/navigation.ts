import type { StaffRole } from '@/domain/models/Auth';

/**
 * Mapa de navegación del panel alineado con los 7 roles reales en Supabase.
 * `ready: false` = módulo con página "en construcción".
 * `icon`: nombre de Material Symbols Rounded. `mobile`: barra inferior móvil (máx. 5).
 */
export interface NavPage {
  path: string;
  /** Nombre corto para el nav (una línea). */
  label: string;
  /** Título completo de la pantalla (si difiere del nombre corto). */
  title?: string;
  icon: string;
  ready: boolean;
  mobile?: boolean;
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
    label: 'Dashboard',
    icon: 'space_dashboard',
    ready: true,
    mobile: true,
    allowedRoles: [...ALL_EMPLOYEES, 'umeca'],
  },
  {
    path: '/solicitudes',
    label: 'Solicitudes',
    title: 'Solicitudes y alertas',
    icon: 'notifications_active',
    ready: true,
    mobile: true,
    allowedRoles: ATTENTION_AND_DIRECTION,
  },
  {
    path: '/expedientes',
    label: 'Expedientes',
    icon: 'folder_shared',
    ready: true,
    mobile: true,
    allowedRoles: ATTENTION_AND_DIRECTION,
  },
  {
    path: '/intervenciones',
    label: 'Intervenciones',
    icon: 'clinical_notes',
    ready: true,
    allowedRoles: ATTENTION_AND_DIRECTION,
  },
  {
    path: '/canalizaciones',
    label: 'Canalizaciones',
    icon: 'alt_route',
    ready: true,
    allowedRoles: ATTENTION_AND_DIRECTION,
  },
  {
    path: '/agenda',
    label: 'Agenda',
    icon: 'calendar_month',
    ready: false,
    mobile: true,
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
    path: '/directorio',
    label: 'Directorio',
    title: 'Directorio y Puntos Violeta',
    icon: 'location_on',
    ready: true,
    mobile: true,
    allowedRoles: ALL_EMPLOYEES,
  },
  {
    path: '/usuarios',
    label: 'Usuarios',
    icon: 'manage_accounts',
    ready: false,
    allowedRoles: DIRECTION_ONLY,
  },
  {
    path: '/auditoria',
    label: 'Auditoría',
    icon: 'policy',
    ready: false,
    allowedRoles: DIRECTION_ONLY,
  },
];

export const ALL_PAGES = NAVIGATION;

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
