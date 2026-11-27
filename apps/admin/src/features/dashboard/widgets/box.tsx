import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { SIZE_SPECS, type WidgetSize } from '../layout';

/** Medidas (px) del área útil de un widget. `measured` es false mientras se usa la estimación por tamaño. */
export interface WidgetBox {
  w: number;
  h: number;
  size: WidgetSize;
  measured: boolean;
}

/** Tamaño de celda que el tablero asignó al widget (llega desde `WidgetShell`). */
const SizeContext = createContext<WidgetSize>('m');
export const WidgetSizeProvider = SizeContext.Provider;
export const useWidgetSize = () => useContext(SizeContext);

const BoxContext = createContext<WidgetBox | null>(null);
export const WidgetBoxProvider = BoxContext.Provider;

/**
 * Área útil aproximada (sin el chrome del widget) para una celda de la cuadrícula de 4 columnas
 * en escritorio. Sirve de valor inicial antes de medir y en pruebas/SSR, donde no hay ResizeObserver.
 */
export function estimateBox(size: WidgetSize): WidgetBox {
  const spec = SIZE_SPECS[size];
  return {
    w: spec.cols === 1 ? 250 : spec.cols === 2 ? 540 : 1120,
    h: spec.rows === 1 ? 130 : 340,
    size,
    measured: false,
  };
}

/** Medidas del cuerpo del widget actual (medidas reales si ya existen; si no, estimadas por tamaño). */
export function useWidgetBox(): WidgetBox {
  const size = useContext(SizeContext);
  const box = useContext(BoxContext);
  return box ?? estimateBox(size);
}

export interface ElementSize {
  w: number;
  h: number;
}

type SizeListener = (size: ElementSize) => void;

/**
 * Un único ResizeObserver para todos los widgets (uno por widget disparaba 9 callbacks con lecturas de
 * layout). Las medidas salen de la entrada del observador (sin `clientWidth`/`clientHeight`, que fuerzan
 * layout) y los avisos se agrupan en un solo cuadro de animación.
 */
const listeners = new Map<Element, SizeListener>();
const pending = new Map<Element, ElementSize>();
let sharedObserver: ResizeObserver | null = null;
let frame = 0;

const requestFrame = (cb: () => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const cancelFrame = (id: number) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

function flushSizes() {
  frame = 0;
  const batch = [...pending];
  pending.clear();
  for (const [el, size] of batch) listeners.get(el)?.(size);
}

/** Tamaño del área útil (content box) de una entrada del observador, en px enteros. */
export function sizeOfEntry(entry: Pick<ResizeObserverEntry, 'contentBoxSize' | 'contentRect'>): ElementSize {
  const list = entry.contentBoxSize as ReadonlyArray<ResizeObserverSize> | ResizeObserverSize | undefined;
  const box = Array.isArray(list) ? list[0] : (list as ResizeObserverSize | undefined);
  const raw = box ? { w: box.inlineSize, h: box.blockSize } : { w: entry.contentRect.width, h: entry.contentRect.height };
  return { w: Math.round(raw.w), h: Math.round(raw.h) };
}

function onResizeEntries(entries: ResizeObserverEntry[]) {
  for (const entry of entries) {
    if (listeners.has(entry.target)) pending.set(entry.target, sizeOfEntry(entry));
  }
  if (!frame && pending.size > 0) frame = requestFrame(flushSizes);
}

/** Observa `el` con el observador compartido. Devuelve la función que deja de observarlo. */
export function observeSize(el: Element, listener: SizeListener): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  sharedObserver ??= new ResizeObserver(onResizeEntries);
  listeners.set(el, listener);
  sharedObserver.observe(el);
  return () => {
    listeners.delete(el);
    pending.delete(el);
    sharedObserver?.unobserve(el);
    if (listeners.size === 0) {
      sharedObserver?.disconnect();
      sharedObserver = null;
      if (frame) cancelFrame(frame);
      frame = 0;
    }
  };
}

/** Cantidad de elementos observados (para pruebas). */
export const observedCount = () => listeners.size;

/** Un cambio menor a 1 px no vale otro render. */
export const sameSize = (a: ElementSize, b: ElementSize) => Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;

/**
 * Mide un elemento. Devuelve `null` hasta la primera medición real (o si no hay ResizeObserver ni layout,
 * como en jsdom): quien lo usa cae a la estimación por tamaño (`estimateBox`) y la primera notificación del
 * observador la corrige. No lee layout de forma síncrona al montar.
 */
export function useElementBox<T extends HTMLElement>(): [RefObject<T | null>, ElementSize | null] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<ElementSize | null>(null);
  const last = useRef<ElementSize | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeSize(el, (next) => {
      // Sin layout (elemento oculto): se conserva la estimación por tamaño.
      if (next.w === 0 && next.h === 0) return;
      if (last.current && sameSize(last.current, next)) return;
      last.current = next;
      setBox(next);
    });
  }, []);

  return [ref, box];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export { clamp };

/** Cuántas columnas de lista caben en `width` px con columnas de al menos `minCol` px. */
export function listColumns(width: number, minCol: number, gap: number, max: number) {
  return clamp(Math.floor((width + gap) / (minCol + gap)), 1, max);
}

/** Cuántas filas de `rowHeight` px caben en `height` px (mínimo 1). */
export function rowsThatFit(height: number, rowHeight: number, gap: number) {
  return Math.max(1, Math.floor((height + gap) / (rowHeight + gap)));
}
