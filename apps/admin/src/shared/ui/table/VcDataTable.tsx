import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DataTable } from '@yewdiel21/motion-kit/react';
import type { DataTableProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/data-table';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/filter-builder';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/pagination';
import '@yewdiel21/motion-kit/css/components/select';
import { createRowDecorator, type RowDecorSpec } from './tableDecorate';
import { TABLE_LABELS, TABLE_PAGE_SIZES } from './tableFormat';
import { useTableDensity, type TableDensity } from './useTableDensity';
import './table.css';

type Row = Record<string, unknown>;

export interface VcDataTableProps<T extends Row> extends DataTableProps<T>, RowDecorSpec {
  /** Densidad fija; sin ella se usa la preferencia compartida («Cómoda» / «Compacta»). */
  density?: TableDensity;
  /** Muestra el botón de densidad en la barra de la tabla (por defecto sí). */
  densityToggle?: boolean;
}

function DensityIcon({ compact }: { compact: boolean }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {compact ? <path d="M4 6h16M4 10h16M4 14h16M4 18h16" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
    </svg>
  );
}

/**
 * `DataTable` del kit con el aspecto y la configuración compartidos de Violet Code: densidad cómoda (o compacta, con
 * preferencia guardada), encabezado fijo, filas con bandas y hover por tokens, cifras tabulares, cápsulas de estado,
 * truncado con `title`, pie «1–10 de 42» con filas por página y, en pantallas angostas, filas apiladas como tarjetas.
 * Las columnas y el comportamiento siguen siendo los de cada pantalla; aquí solo vive la presentación.
 */
export function VcDataTable<T extends Row>({
  className,
  density,
  densityToggle = true,
  pills,
  strong,
  mono,
  muted,
  truncate,
  interactive,
  striped = true,
  pageSizes = TABLE_PAGE_SIZES,
  labels = TABLE_LABELS,
  onRender,
  ...props
}: VcDataTableProps<T>) {
  const shared = useTableDensity();
  const effective = density ?? shared.density;
  const decorate = useMemo(
    () => createRowDecorator({ pills, strong, mono, muted, truncate, interactive }),
    // Las especificaciones son constantes de módulo en cada pantalla: el decorador se crea una sola vez.
    [pills, strong, mono, muted, truncate, interactive],
  );

  // El botón de densidad se monta (portal) en la barra de herramientas que dibuja el kit.
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const handleRender = useCallback(
    (tbody: HTMLTableSectionElement) => {
      decorate(tbody);
      const host = tbody.closest('.mk-data-table')?.querySelector<HTMLElement>('[data-mk-dt-tools]') ?? null;
      if (host !== hostRef.current) {
        hostRef.current = host;
        setToolsHost(host);
      }
      onRender?.(tbody);
    },
    [decorate, onRender],
  );

  const compact = effective === 'compact';
  const classes = ['vc-table', interactive ? 'vc-table--interactive' : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <>
      <DataTable<T>
        {...(props as DataTableProps<T>)}
        className={classes}
        density={effective}
        striped={striped}
        pageSizes={pageSizes}
        labels={labels}
        onRender={handleRender}
      />
      {densityToggle && toolsHost
        ? createPortal(
            <button
              type="button"
              data-mk-dt-tool=""
              className="vc-table__density"
              aria-pressed={compact}
              aria-label={compact ? 'Densidad compacta. Cambiar a cómoda' : 'Densidad cómoda. Cambiar a compacta'}
              title={compact ? 'Filas compactas' : 'Filas cómodas'}
              onClick={shared.toggle}
            >
              <DensityIcon compact={compact} />
            </button>,
            toolsHost,
          )
        : null}
    </>
  );
}
