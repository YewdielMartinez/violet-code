/**
 * Mapa de navegación del panel. Coincide con docs/discovery/02-estructura-funcional.md.
 * `ready: false` = módulo con página vacía, pendiente de implementar.
 */
export interface NavLeaf {
  path: string;
  label: string;
  ready: boolean;
}

export interface NavSection {
  label: string;
  items: NavLeaf[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: 'Atención',
    items: [
      { path: '/', label: 'Dashboard', ready: true },
      { path: '/solicitudes', label: 'Solicitudes y alertas', ready: false },
      { path: '/expedientes', label: 'Expedientes', ready: false },
      { path: '/casos', label: 'Gestión de casos', ready: false },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { path: '/profesionales', label: 'Profesionales', ready: false },
      { path: '/intervenciones', label: 'Intervenciones', ready: false },
      { path: '/canalizaciones', label: 'Canalizaciones', ready: false },
      { path: '/agenda', label: 'Agenda', ready: false },
    ],
  },
  {
    label: 'Información',
    items: [
      { path: '/estadisticas', label: 'Estadísticas', ready: false },
      { path: '/directorio', label: 'Directorio y Puntos Violeta', ready: true },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { path: '/usuarios', label: 'Usuarios', ready: false },
      { path: '/auditoria', label: 'Auditoría', ready: false },
    ],
  },
];

export const ALL_PAGES = NAVIGATION.flatMap((s) => s.items);
