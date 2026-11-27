import type { CSSProperties } from 'react';
import './vc-ui.css';

export interface SkeletonRowsProps {
  /** Nombre accesible del estado de carga («Cargando actividades»). */
  label: string;
  rows?: number;
  /** Alto de cada fila (CSS), igual al de la tarjeta real para evitar saltos. */
  rowHeight?: string;
}

/** Filas de carga con shimmer (respeta `prefers-reduced-motion` desde el CSS). */
export function SkeletonRows({ label, rows = 4, rowHeight }: SkeletonRowsProps) {
  const style = rowHeight ? ({ '--vc-skeleton-h': rowHeight } as CSSProperties) : undefined;
  return (
    <div className="vc-skeleton" role="status" aria-busy="true" aria-label={label} style={style}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="vc-skeleton__row" />
      ))}
    </div>
  );
}
