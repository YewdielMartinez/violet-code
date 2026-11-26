import { useSyncExternalStore } from 'react';
import type { StaffRole } from '@/domain/models/Auth';

/**
 * Widgets del dashboard filtrados según los permisos de cada rol en Supabase.
 * La preferencia visible por persona se guarda en localStorage.
 */
export type WidgetId = 'kpis' | 'alerts' | 'cases' | 'trend' | 'agenda' | 'security' | 'directory';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  column: 'main' | 'side';
  defaultFor: StaffRole[];
  onlyFor?: StaffRole[];
}

const ALL_EMPLOYEES: StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
  'recepcion',
];

const CLINICAL_AND_DIRECTION: StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
];

export const WIDGETS: WidgetDef[] = [
  {
    id: 'kpis',
    title: 'Resumen del día',
    description: 'Alertas activas, próxima cita y expedientes pendientes.',
    column: 'main',
    defaultFor: ALL_EMPLOYEES,
    onlyFor: ALL_EMPLOYEES,
  },
  {
    id: 'alerts',
    title: 'Alertas por atender',
    description: 'Bandeja de alertas nuevas y en atención.',
    column: 'main',
    defaultFor: ['titular', 'subdireccion', 'juridico', 'trabajo_social'],
    onlyFor: CLINICAL_AND_DIRECTION,
  },
  {
    id: 'cases',
    title: 'Expedientes en curso',
    description: 'Casos abiertos o en seguimiento que requieren atención.',
    column: 'main',
    defaultFor: CLINICAL_AND_DIRECTION,
    onlyFor: CLINICAL_AND_DIRECTION,
  },
  {
    id: 'agenda',
    title: 'Agenda',
    description: 'Calendario del mes y citas de hoy.',
    column: 'side',
    defaultFor: ALL_EMPLOYEES,
    onlyFor: ALL_EMPLOYEES,
  },
  {
    id: 'trend',
    title: 'Alertas de la semana',
    description: 'Alertas recibidas en los últimos 7 días.',
    column: 'side',
    defaultFor: ['titular', 'subdireccion'],
    onlyFor: CLINICAL_AND_DIRECTION,
  },
  {
    id: 'security',
    title: 'Actividad de seguridad',
    description: 'Eventos recientes de bitacora_acceso.',
    column: 'side',
    defaultFor: ['titular', 'subdireccion'],
    onlyFor: ['titular', 'subdireccion'],
  },
  {
    id: 'directory',
    title: 'Directorio',
    description: 'Instancias de apoyo y líneas de emergencia activas.',
    column: 'side',
    defaultFor: ['recepcion'],
    onlyFor: ALL_EMPLOYEES,
  },
];

export const availableWidgets = (role: StaffRole) =>
  WIDGETS.filter((w) => !w.onlyFor || w.onlyFor.includes(role));

const key = (userId: string) => `vc-dashboard:${userId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, WidgetId[]>();

function read(userId: string, role: StaffRole): WidgetId[] {
  const cached = cache.get(userId);
  if (cached) return cached;
  let ids: WidgetId[] | null = null;
  try {
    ids = JSON.parse(localStorage.getItem(key(userId)) ?? 'null');
  } catch {
    ids = null;
  }
  const allowed = new Set(availableWidgets(role).map((w) => w.id));
  const value = (ids ?? WIDGETS.filter((w) => w.defaultFor.includes(role)).map((w) => w.id)).filter((id) =>
    allowed.has(id),
  );
  cache.set(userId, value);
  return value;
}

export function setVisibleWidgets(userId: string, ids: WidgetId[]) {
  cache.set(userId, ids);
  try {
    localStorage.setItem(key(userId), JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: solo en memoria */
  }
  listeners.forEach((l) => l());
}

export function useVisibleWidgets(userId: string, role: StaffRole) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(userId, role),
  );
}
