import { useSyncExternalStore } from 'react';

export type TableDensity = 'regular' | 'compact';

/** Preferencia compartida por todas las tablas (por navegador). */
export const TABLE_DENSITY_KEY = 'vc-table-density';

type Listener = () => void;
const listeners = new Set<Listener>();
let current: TableDensity = readStored();

function readStored(): TableDensity {
  try {
    return globalThis.localStorage?.getItem(TABLE_DENSITY_KEY) === 'compact' ? 'compact' : 'regular';
  } catch {
    return 'regular';
  }
}

export function getTableDensity(): TableDensity {
  return current;
}

export function setTableDensity(next: TableDensity): void {
  if (next === current) return;
  current = next;
  try {
    globalThis.localStorage?.setItem(TABLE_DENSITY_KEY, next);
  } catch {
    // Sin almacenamiento (ventana privada, datos bloqueados): la preferencia vale solo en esta sesión.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Densidad actual de las tablas y su alternador (cómoda ↔ compacta). */
export function useTableDensity(): { density: TableDensity; toggle: () => void } {
  const density = useSyncExternalStore(subscribe, getTableDensity, () => 'regular' as TableDensity);
  return { density, toggle: () => setTableDensity(density === 'compact' ? 'regular' : 'compact') };
}
