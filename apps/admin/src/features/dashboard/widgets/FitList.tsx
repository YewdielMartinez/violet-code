import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { Link } from 'react-router-dom';
import { listColumns, rowsThatFit, useElementBox, useWidgetBox } from './box';

/** Selector que no coincide con nada: FlipGroup no captura ni anima mientras la lista aún se está acomodando. */
const NO_FLIP = '[data-flip-pending]';

/**
 *  cuando la lista ya se midió y pintó con su tamaño real. Los cambios de capacidad de la primera carga
 * (estimación → medida real) no son un reacomodo que merezca animarse: FLIP del kit lee estilos calculados de
 * cada ítem. Sin medidas (jsdom, oculto) nunca se activa.
 */
function useSettled(measured: boolean) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!measured || settled) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [measured, settled]);
  return settled;
}

/** Alto reservado al enlace «+N más» cuando la lista no cabe completa. */
const MORE_HEIGHT = 32;

export interface FitListRenderContext {
  /** Ancho (px) de cada columna: permite versiones compactas de la fila. */
  colWidth: number;
  compact: boolean;
}

interface FitListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, ctx: FitListRenderContext) => ReactNode;
  /** Alto fijo (px) de cada fila: así la capacidad se calcula exacta. */
  rowHeight: number;
  gap?: number;
  /** Ancho mínimo por columna; con celdas anchas la lista pasa a 2 o 3 columnas. */
  minColWidth?: number;
  maxCols?: number;
  /** Alto (px) ocupado por otros elementos del cuerpo; solo se usa antes de la primera medición. */
  reserve?: number;
  label: string;
  /** Enlace «+N más» cuando hay más elementos que espacio. */
  more?: { label: string; to: string };
}

/**
 * Lista que llena el espacio de su celda: mide el alto y ancho disponibles y muestra tantas filas
 * (y columnas) como caben, en vez de un número fijo. Más alto ⇒ más filas; más ancho ⇒ más columnas.
 */
export function FitList<T>({
  items,
  getKey,
  renderItem,
  rowHeight,
  gap = 8,
  minColWidth = 300,
  maxCols = 3,
  reserve = 0,
  label,
  more,
}: FitListProps<T>) {
  const [areaRef, measured] = useElementBox<HTMLDivElement>();
  const listRef = useRef<HTMLUListElement>(null);
  const settled = useSettled(measured !== null);
  const widget = useWidgetBox();
  const w = measured?.w ?? widget.w;
  const h = measured?.h ?? Math.max(rowHeight, widget.h - reserve);

  const cols = listColumns(w, minColWidth, gap, maxCols);
  let capacity = rowsThatFit(h, rowHeight, gap) * cols;
  const overflow = items.length > capacity;
  if (overflow && more) capacity = rowsThatFit(h - MORE_HEIGHT, rowHeight, gap) * cols;
  const shown = items.slice(0, capacity);
  const hiddenCount = items.length - shown.length;
  const perColumn = Math.max(1, Math.ceil(shown.length / cols));
  const colWidth = (w - gap * (cols - 1)) / cols;

  const style: CSSProperties = {
    display: 'grid',
    gap,
    gridAutoFlow: 'column',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${perColumn}, ${rowHeight}px)`,
  };

  return (
    <div ref={areaRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
      <FlipGroup root={listRef} selector={settled ? undefined : NO_FLIP} signature={shown.map(getKey).join(',')}>
        <ul ref={listRef} aria-label={label} style={style}>
          {shown.map((item) => (
            <li key={getKey(item)} data-flip-id={getKey(item)} className="min-w-0">
              {renderItem(item, { colWidth, compact: colWidth < 300 })}
            </li>
          ))}
        </ul>
      </FlipGroup>
      {hiddenCount > 0 && more ? (
        <Link
          to={more.to}
          className="mt-auto self-start rounded-full px-1 text-xs font-medium text-primary hover:underline"
        >
          +{hiddenCount} más · {more.label}
        </Link>
      ) : null}
    </div>
  );
}
