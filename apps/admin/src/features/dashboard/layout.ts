import { useSyncExternalStore } from 'react';
import type { StaffRole } from '@/shared/auth/session';

/**
 * Widgets del dashboard. Cada rol ve por defecto lo que necesita para su trabajo diario;
 * cada persona puede mostrar u ocultar widgets (se guarda en su navegador).
 */
export type WidgetId = 'kpis' | 'alerts' | 'cases' | 'trend' | 'agenda' | 'security' | 'directory';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  column: 'main' | 'side';
  defaultFor: StaffRole[];
  /** Solo disponible para estos roles (ej. auditoría). */
  onlyFor?: StaffRole[];
}

const ALL: StaffRole[] = ['admin', 'coordinacion', 'profesional', 'recepcion'];

export const WIDGETS: WidgetDef[] = [
  { id: 'kpis', title: 'Resumen del día', description: 'Alertas activas, próxima cita y pendientes.', column: 'main', defaultFor: ALL },
  { id: 'alerts', title: 'Alertas por atender', description: 'Bandeja de alertas nuevas y en atención.', column: 'main', defaultFor: ['admin', 'coordinacion', 'recepcion'] },
  { id: 'cases', title: 'Expedientes por revisar', description: 'Casos que requieren revisión.', column: 'main', defaultFor: ['admin', 'coordinacion', 'profesional'] },
  { id: 'agenda', title: 'Agenda', description: 'Calendario del mes y citas de hoy.', column: 'side', defaultFor: ['coordinacion', 'profesional', 'recepcion'] },
  { id: 'trend', title: 'Alertas de la semana', description: 'Alertas recibidas en los últimos 7 días.', column: 'side', defaultFor: ['admin', 'coordinacion'] },
  { id: 'security', title: 'Actividad de seguridad', description: 'Accesos recientes al sistema.', column: 'side', defaultFor: ['admin'], onlyFor: ['admin', 'coordinacion'] },
  { id: 'directory', title: 'Directorio', description: 'Instancias y Puntos Violeta activos.', column: 'side', defaultFor: [] },
];

export const availableWidgets = (role: StaffRole) => WIDGETS.filter((w) => !w.onlyFor || w.onlyFor.includes(role));

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
  const value = (ids ?? WIDGETS.filter((w) => w.defaultFor.includes(role)).map((w) => w.id)).filter((id) => allowed.has(id));
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
