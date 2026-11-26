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
  column: 'top' | 'main' | 'side';
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
    description: 'Alertas pendientes, citas de hoy, expedientes activos y casos prioritarios.',
    column: 'top',
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

const STORAGE_VERSION = 'v2';
const key = (userId: string) => `vc-dashboard:${STORAGE_VERSION}:${userId}`;
const cacheKey = (userId: string, role: StaffRole) => `${userId}:${role}`;
const listeners = new Set<() => void>();
const memoryFallback = new Map<string, WidgetId[]>();
const cache = new Map<string, WidgetId[]>();

/** Conserva el orden del catálogo (con `kpis` primero cuando está visible) y filtra por rol. */
function normalizeOrder(ids: readonly WidgetId[], allowed?: ReadonlySet<WidgetId>): WidgetId[] {
  const selected = new Set(ids);
  return WIDGETS.map((w) => w.id).filter((id) => selected.has(id) && (!allowed || allowed.has(id)));
}

function read(userId: string, role: StaffRole): WidgetId[] {
  const ck = cacheKey(userId, role);
  const cached = cache.get(ck);
  if (cached) return cached;
  let ids: WidgetId[] | null = memoryFallback.get(userId) ?? null;
  if (!ids) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? 'null');
      ids = Array.isArray(parsed) ? (parsed as WidgetId[]) : null;
    } catch {
      ids = null;
    }
  }
  const allowed = new Set(availableWidgets(role).map((w) => w.id));
  const raw = ids ?? WIDGETS.filter((w) => w.defaultFor.includes(role)).map((w) => w.id);
  const value = normalizeOrder(raw, allowed);
  cache.set(ck, value);
  return value;
}

export function setVisibleWidgets(userId: string, ids: WidgetId[]) {
  const normalized = normalizeOrder(ids);
  memoryFallback.set(userId, normalized);
  for (const existingKey of cache.keys()) {
    if (existingKey.startsWith(`${userId}:`)) {
      cache.delete(existingKey);
    }
  }
  try {
    localStorage.setItem(key(userId), JSON.stringify(normalized));
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
