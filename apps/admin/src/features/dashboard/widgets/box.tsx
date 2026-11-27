import { createContext, useContext, useLayoutEffect, useRef, useState, type RefObject } from 'react';
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

/** Mide un elemento con ResizeObserver (null hasta la primera medición o si no hay soporte). */
export function useElementBox<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number } | null] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      // Sin layout (jsdom, elemento oculto): se conserva la estimación por tamaño.
      if (el.clientWidth === 0 && el.clientHeight === 0) return;
      const next = { w: el.clientWidth, h: el.clientHeight };
      setBox((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
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
