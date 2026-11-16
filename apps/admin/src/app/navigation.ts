/**
 * Mapa de navegación del panel. Coincide con docs/discovery/02-estructura-funcional.md.
 * `ready: false` = módulo con página "en construcción".
 * `icon`: nombre de Material Symbols Rounded. `mobile`: aparece en la barra inferior del teléfono (máx. 5).
 */
export interface NavPage {
  path: string;
  label: string;
  icon: string;
  ready: boolean;
  mobile?: boolean;
}

export const NAVIGATION: NavPage[] = [
  { path: '/', label: 'Dashboard', icon: 'space_dashboard', ready: true, mobile: true },
  { path: '/solicitudes', label: 'Solicitudes y alertas', icon: 'notifications_active', ready: false, mobile: true },
  { path: '/expedientes', label: 'Expedientes', icon: 'folder_shared', ready: false, mobile: true },
  { path: '/casos', label: 'Gestión de casos', icon: 'account_tree', ready: false },
  { path: '/profesionales', label: 'Profesionales', icon: 'groups', ready: false },
  { path: '/intervenciones', label: 'Intervenciones', icon: 'clinical_notes', ready: false },
  { path: '/canalizaciones', label: 'Canalizaciones', icon: 'alt_route', ready: false },
  { path: '/agenda', label: 'Agenda', icon: 'calendar_month', ready: false, mobile: true },
  { path: '/estadisticas', label: 'Estadísticas', icon: 'monitoring', ready: false },
  { path: '/directorio', label: 'Directorio y Puntos Violeta', icon: 'location_on', ready: true, mobile: true },
  { path: '/usuarios', label: 'Usuarios', icon: 'manage_accounts', ready: false },
  { path: '/auditoria', label: 'Auditoría', icon: 'policy', ready: false },
];

export const ALL_PAGES = NAVIGATION;
