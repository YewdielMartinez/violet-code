import { useSyncExternalStore } from 'react';
import type { StaffRole } from '@/domain/models/Auth';

/**
 * Modelo de personalización del tablero.
 *
 * - Catálogo de widgets filtrado por permisos del rol (`onlyFor`, igual que los permisos de Supabase).
 * - Cada widget ocupa una celda de la cuadrícula con un tamaño (`WidgetSize`): 1×1, 2×1, 1×2, 2×2, 4×1 o 4×2.
 * - La persona puede reordenar, cambiar el tamaño, ocultar/mostrar y restablecer; se guarda por usuario en
 *   localStorage (v3). El formato anterior (v2: lista de ids visibles) se migra al leerlo.
 * - Las funciones de transformación son puras: reciben y devuelven la lista de `LayoutItem`.
 */

export type WidgetId =
  | 'kpi_alerts'
  | 'kpi_citas'
  | 'kpi_expedientes'
  | 'kpi_prioritarios'
  | 'alerts'
  | 'cases'
  | 'agenda'
  | 'trend'
  | 'security'
  | 'directory';

export type WidgetSize = 's' | 'm' | 'tall' | 'l' | 'wide' | 'xl';

export interface SizeSpec {
  label: string;
  /** Columnas × filas de la cuadrícula de 4 columnas. */
  hint: string;
  cols: 1 | 2 | 4;
  rows: 1 | 2;
}

export const SIZE_SPECS: Record<WidgetSize, SizeSpec> = {
  s: { label: 'Pequeño', hint: '1×1', cols: 1, rows: 1 },
  m: { label: 'Ancho', hint: '2×1', cols: 2, rows: 1 },
  tall: { label: 'Alto', hint: '1×2', cols: 1, rows: 2 },
  l: { label: 'Grande', hint: '2×2', cols: 2, rows: 2 },
  wide: { label: 'Banda', hint: '4×1', cols: 4, rows: 1 },
  xl: { label: 'Panel completo', hint: '4×2', cols: 4, rows: 2 },
};

export const SIZE_ORDER: readonly WidgetSize[] = ['s', 'm', 'tall', 'l', 'wide', 'xl'];

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  /** Roles que pueden ver el widget (permisos). */
  onlyFor: readonly StaffRole[];
  /** Tamaños admitidos (los que mantienen el contenido legible). */
  sizes: readonly WidgetSize[];
  defaultSize: WidgetSize;
}

export interface LayoutItem {
  id: WidgetId;
  size: WidgetSize;
  visible: boolean;
}

const ALL_EMPLOYEES: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
  'recepcion',
];

const CLINICAL_AND_DIRECTION: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
];

const KPI_SIZES: readonly WidgetSize[] = ['s', 'm', 'tall', 'l'];
const LIST_SIZES: readonly WidgetSize[] = ['m', 'tall', 'l', 'wide', 'xl'];

export const WIDGETS: readonly WidgetDef[] = [
  {
    id: 'kpi_alerts',
    title: 'Alertas pendientes',
    description: 'Cifra del día con tendencia de 7 días y desglose por estado.',
    onlyFor: CLINICAL_AND_DIRECTION,
    sizes: [...KPI_SIZES, 'wide'],
    defaultSize: 's',
  },
  {
    id: 'kpi_citas',
    title: 'Citas de hoy',
    description: 'Citas del día y la próxima programada.',
    onlyFor: ALL_EMPLOYEES,
    sizes: KPI_SIZES,
    defaultSize: 's',
  },
  {
    id: 'kpi_expedientes',
    title: 'Expedientes activos',
    description: 'Casos abiertos o en seguimiento, con su desglose.',
    onlyFor: CLINICAL_AND_DIRECTION,
    sizes: KPI_SIZES,
    defaultSize: 's',
  },
  {
    id: 'kpi_prioritarios',
    title: 'Casos urgentes',
    description: 'Expedientes en lista de urgencias y su peso sobre los activos.',
    onlyFor: CLINICAL_AND_DIRECTION,
    sizes: KPI_SIZES,
    defaultSize: 's',
  },
  {
    id: 'alerts',
    title: 'Alertas por atender',
    description: 'Bandeja de alertas nuevas y en atención.',
    onlyFor: CLINICAL_AND_DIRECTION,
    sizes: LIST_SIZES,
    defaultSize: 'l',
  },
  {
    id: 'cases',
    title: 'Expedientes en curso',
    description: 'Casos abiertos o en seguimiento que requieren atención.',
    onlyFor: CLINICAL_AND_DIRECTION,
    sizes: LIST_SIZES,
    defaultSize: 'm',
  },
  {
    id: 'agenda',
    title: 'Agenda',
    description: 'Citas de hoy, calendario del mes y próximas citas.',
    onlyFor: ALL_EMPLOYEES,
    sizes: ['s', 'm', 'tall', 'l', 'wide', 'xl'],
    defaultSize: 'l',
  },
  {
    id: 'trend',
    title: 'Alertas de la semana',
    description: 'Alertas recibidas por día en los últimos 7 días.',
    onlyFor: CLINICAL_AND_DIRECTION,
    sizes: ['s', 'm', 'tall', 'l', 'wide', 'xl'],
    defaultSize: 'm',
  },
  {
    id: 'security',
    title: 'Actividad de seguridad',
    description: 'Eventos recientes de bitacora_acceso.',
    onlyFor: ['titular', 'subdireccion'],
    sizes: LIST_SIZES,
    defaultSize: 'wide',
  },
  {
    id: 'directory',
    title: 'Directorio',
    description: 'Instancias de apoyo activas y líneas de atención 24 h.',
    onlyFor: ALL_EMPLOYEES,
    sizes: KPI_SIZES,
    defaultSize: 'm',
  },
];

export const KPI_IDS: readonly WidgetId[] = ['kpi_alerts', 'kpi_citas', 'kpi_expedientes', 'kpi_prioritarios'];

const WIDGET_BY_ID: ReadonlyMap<string, WidgetDef> = new Map(WIDGETS.map((w) => [w.id, w]));

export const widgetDef = (id: WidgetId): WidgetDef => {
  const def = WIDGET_BY_ID.get(id);
  if (!def) throw new Error(`Widget desconocido: ${id}`);
  return def;
};

export const availableWidgets = (role: StaffRole) => WIDGETS.filter((w) => w.onlyFor.includes(role));

/**
 * Composición inicial por rol (la cuadrícula es de 4 columnas, así que cada combinación llena sus filas).
 * Dirección ve todo el panorama; áreas de atención, su bandeja y agenda; recepción, agenda y directorio.
 */
const ROLE_PRESETS: Partial<Record<StaffRole, readonly (readonly [WidgetId, WidgetSize])[]>> = {
  titular: [
    ['kpi_alerts', 's'],
    ['kpi_citas', 's'],
    ['kpi_expedientes', 's'],
    ['kpi_prioritarios', 's'],
    ['alerts', 'l'],
    ['agenda', 'l'],
    ['trend', 'm'],
    ['cases', 'm'],
    ['security', 'wide'],
  ],
  subdireccion: [
    ['kpi_alerts', 's'],
    ['kpi_citas', 's'],
    ['kpi_expedientes', 's'],
    ['kpi_prioritarios', 's'],
    ['alerts', 'l'],
    ['agenda', 'l'],
    ['trend', 'm'],
    ['cases', 'm'],
    ['security', 'wide'],
  ],
  trabajo_social: [
    ['kpi_alerts', 's'],
    ['kpi_citas', 's'],
    ['kpi_expedientes', 's'],
    ['kpi_prioritarios', 's'],
    ['alerts', 'l'],
    ['agenda', 'l'],
    ['cases', 'wide'],
  ],
  juridico: [
    ['kpi_alerts', 's'],
    ['kpi_citas', 's'],
    ['kpi_expedientes', 's'],
    ['kpi_prioritarios', 's'],
    ['alerts', 'l'],
    ['agenda', 'l'],
    ['cases', 'wide'],
  ],
  psicologia: [
    ['kpi_alerts', 's'],
    ['kpi_citas', 's'],
    ['kpi_expedientes', 's'],
    ['kpi_prioritarios', 's'],
    ['cases', 'l'],
    ['agenda', 'l'],
  ],
  recepcion: [
    ['kpi_citas', 'm'],
    ['directory', 'm'],
    ['agenda', 'xl'],
  ],
};

export const rolePreset = (role: StaffRole) => ROLE_PRESETS[role] ?? [];

const isSize = (value: unknown): value is WidgetSize =>
  typeof value === 'string' && (SIZE_ORDER as readonly string[]).includes(value);

/** Tamaño pedido si el widget lo admite; si no, el predeterminado del widget. */
export function validSize(id: WidgetId, size: unknown): WidgetSize {
  const def = widgetDef(id);
  return isSize(size) && def.sizes.includes(size) ? size : def.defaultSize;
}

/** Composición por defecto del rol: los widgets de su preset visibles y el resto disponibles pero ocultos. */
export function defaultLayout(role: StaffRole): LayoutItem[] {
  const available = new Set(availableWidgets(role).map((w) => w.id));
  const preset = rolePreset(role).filter(([id]) => available.has(id));
  const inPreset = new Set(preset.map(([id]) => id));
  return [
    ...preset.map(([id, size]): LayoutItem => ({ id, size: validSize(id, size), visible: true })),
    ...availableWidgets(role)
      .filter((w) => !inPreset.has(w.id))
      .map((w): LayoutItem => ({ id: w.id, size: w.defaultSize, visible: false })),
  ];
}

const isKnownId = (id: unknown): id is WidgetId => typeof id === 'string' && WIDGET_BY_ID.has(id);

/** Agrega los widgets disponibles que la lista no menciona (ocultos) para que el catálogo quede completo. */
function completeWith(items: LayoutItem[], role: StaffRole): LayoutItem[] {
  const present = new Set(items.map((i) => i.id));
  const missing = availableWidgets(role)
    .filter((w) => !present.has(w.id))
    .map((w): LayoutItem => ({ id: w.id, size: w.defaultSize, visible: false }));
  return [...items, ...missing];
}

/** v2: arreglo con los ids visibles (en el catálogo anterior, `kpis` era un solo widget). */
function migrateLegacy(ids: readonly unknown[], role: StaffRole): LayoutItem[] {
  const available = new Set(availableWidgets(role).map((w) => w.id));
  const presetSize = new Map(rolePreset(role));
  const seen = new Set<WidgetId>();
  const items: LayoutItem[] = [];
  for (const raw of ids) {
    const expanded: readonly unknown[] = raw === 'kpis' ? KPI_IDS : [raw];
    for (const id of expanded) {
      if (!isKnownId(id) || !available.has(id) || seen.has(id)) continue;
      seen.add(id);
      items.push({ id, size: validSize(id, presetSize.get(id)), visible: true });
    }
  }
  return completeWith(items, role);
}

interface StoredItem {
  id?: unknown;
  size?: unknown;
  visible?: unknown;
}

/**
 * Convierte lo guardado (v3, v2 o nada) en una lista completa y válida para el rol:
 * descarta ids desconocidos o sin permiso, corrige tamaños no admitidos y agrega lo que falte.
 */
export function resolveLayout(stored: unknown, role: StaffRole): LayoutItem[] {
  if (Array.isArray(stored)) return migrateLegacy(stored, role);
  if (stored && typeof stored === 'object' && (stored as { v?: unknown }).v === 3) {
    const raw = (stored as { items?: unknown }).items;
    if (Array.isArray(raw)) {
      const available = new Set(availableWidgets(role).map((w) => w.id));
      const seen = new Set<WidgetId>();
      const items: LayoutItem[] = [];
      for (const entry of raw as StoredItem[]) {
        const id = entry?.id;
        if (!isKnownId(id) || !available.has(id) || seen.has(id)) continue;
        seen.add(id);
        items.push({ id, size: validSize(id, entry.size), visible: entry.visible !== false });
      }
      return completeWith(items, role);
    }
  }
  return defaultLayout(role);
}

export const serializeLayout = (items: readonly LayoutItem[]) => ({
  v: 3 as const,
  items: items.map(({ id, size, visible }) => ({ id, size, visible })),
});

// ── Transformaciones puras ───────────────────────────────────────────────────────────────────────

export const visibleItems = (items: readonly LayoutItem[]) => items.filter((i) => i.visible);

export function setItemSize(items: readonly LayoutItem[], id: WidgetId, size: WidgetSize): LayoutItem[] {
  return items.map((i) => (i.id === id ? { ...i, size: validSize(id, size) } : i));
}

/** Oculta, o muestra el widget al final del tablero. */
export function setItemVisible(items: readonly LayoutItem[], id: WidgetId, visible: boolean): LayoutItem[] {
  const target = items.find((i) => i.id === id);
  if (!target || target.visible === visible) return [...items];
  const updated = { ...target, visible };
  return visible ? [...items.filter((i) => i.id !== id), updated] : items.map((i) => (i.id === id ? updated : i));
}

/** Mueve un widget visible una posición antes (-1) o después (+1) entre los visibles. */
export function moveItemBy(items: readonly LayoutItem[], id: WidgetId, delta: -1 | 1): LayoutItem[] {
  const visible = visibleItems(items);
  const from = visible.findIndex((i) => i.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= visible.length) return [...items];
  return reorderVisible(items, id, to);
}

/** Lleva un widget visible a la posición `toIndex` (entre los visibles); los ocultos conservan su lugar. */
export function reorderVisible(items: readonly LayoutItem[], id: WidgetId, toIndex: number): LayoutItem[] {
  const visible = visibleItems(items);
  const from = visible.findIndex((i) => i.id === id);
  if (from < 0) return [...items];
  const to = Math.max(0, Math.min(visible.length - 1, Math.trunc(toIndex)));
  if (from === to) return [...items];
  const next = [...visible];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  let cursor = 0;
  return items.map((i) => (i.visible ? next[cursor++] : i));
}

// ── Persistencia por usuario ─────────────────────────────────────────────────────────────────────

const STORAGE_VERSION = 'v3';
const LEGACY_VERSION = 'v2';
const key = (userId: string, version = STORAGE_VERSION) => `vc-dashboard:${version}:${userId}`;
const cacheKey = (userId: string, role: StaffRole) => `${userId}:${role}`;
const listeners = new Set<() => void>();
/** Último valor guardado por usuario (respaldo si localStorage no está disponible). */
const memory = new Map<string, unknown>();
const cache = new Map<string, LayoutItem[]>();

function readStored(userId: string): unknown {
  if (memory.has(userId)) return memory.get(userId);
  try {
    for (const version of [STORAGE_VERSION, LEGACY_VERSION]) {
      const raw = localStorage.getItem(key(userId, version));
      if (raw !== null) return JSON.parse(raw) as unknown;
    }
  } catch {
    /* JSON inválido o sin almacenamiento: se usan los valores por defecto */
  }
  return null;
}

function read(userId: string, role: StaffRole): LayoutItem[] {
  const ck = cacheKey(userId, role);
  const cached = cache.get(ck);
  if (cached) return cached;
  const value = resolveLayout(readStored(userId), role);
  cache.set(ck, value);
  return value;
}

function invalidate(userId: string) {
  for (const existing of cache.keys()) {
    if (existing.startsWith(`${userId}:`)) cache.delete(existing);
  }
  listeners.forEach((l) => l());
}

/** Aplica una transformación a la composición actual y la guarda. */
export function updateLayout(userId: string, role: StaffRole, change: (items: LayoutItem[]) => LayoutItem[]) {
  const stored = serializeLayout(change(read(userId, role)));
  memory.set(userId, stored);
  try {
    localStorage.setItem(key(userId), JSON.stringify(stored));
  } catch {
    /* sin almacenamiento: solo en memoria */
  }
  invalidate(userId);
}

/** Borra la personalización (incluida la versión anterior) y vuelve a la composición del rol. */
export function resetLayout(userId: string) {
  memory.delete(userId);
  try {
    localStorage.removeItem(key(userId));
    localStorage.removeItem(key(userId, LEGACY_VERSION));
  } catch {
    /* sin almacenamiento */
  }
  invalidate(userId);
}

export function useDashboardLayout(userId: string, role: StaffRole): LayoutItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(userId, role),
  );
}
