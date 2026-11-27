import { useId, useRef, useState, type ReactNode } from 'react';
import { Chart } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/chart';
import { useBarValueLabels } from '@/shared/ui/chart/barValueLabels';
import '@/shared/ui/chart/chart.css';
import type { Punto } from './reportes/estadisticas';
import './informes.css';

export const formatNumber = (n: number) => Math.round(n).toLocaleString('es-MX');

export interface ChartTableData {
  /** Encabezados de la tabla «Ver datos». */
  columns: readonly string[];
  rows: readonly (readonly (string | number)[])[];
}

export interface ChartPanelProps {
  title: string;
  /** Frase para lectores de pantalla: qué muestra la gráfica y su dato más relevante. */
  summary: string;
  /** Una línea de lectura visible bajo el título («▲ 12 % vs. mes anterior»). */
  insight?: string | null;
  /** Alternativa en tabla: botón «Ver datos». */
  data: ChartTableData;
  className?: string;
  children: ReactNode;
}

/**
 * Marco de una gráfica: título, una línea de lectura (insight), resumen accesible y alternancia «Ver datos» ↔ «Ver
 * gráfica» (la misma información en tabla). El tamaño responde al ancho del contenedor (container queries), no al de
 * la ventana. La tabla «Ver datos» tiene su propia región con desplazamiento y encabezado fijo: con muchas filas no se
 * corta ni alarga la página.
 */
export function ChartPanel({ title, summary, insight, data, className = '', children }: ChartPanelProps) {
  const [verDatos, setVerDatos] = useState(false);
  const summaryId = useId();

  return (
    <section aria-label={title} aria-describedby={summaryId} className={`est-panel ${className}`}>
      <header className="est-panel__head">
        <div className="est-panel__heading">
          <h3 className="est-panel__title">{title}</h3>
          {insight ? <p className="est-panel__insight">{insight}</p> : null}
        </div>
        <button
          type="button"
          className="mk-button mk-button--text mk-button--sm vc-press"
          aria-pressed={verDatos}
          onClick={() => setVerDatos((v) => !v)}
        >
          {verDatos ? 'Ver gráfica' : 'Ver datos'}
        </button>
      </header>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      {verDatos ? (
        <div className="est-datatable-wrap" tabIndex={0} role="region" aria-label={`Datos de ${title}`}>
          <table className="est-datatable">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {data.columns.map((column, i) => (
                  <th key={column} scope="col" className={i === 0 ? '' : 'est-num'}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className="est-num">
                        {typeof cell === 'number' ? formatNumber(cell) : cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="est-panel__viz">{children}</div>
      )}
    </section>
  );
}

export interface SerieBarras {
  name: string;
  values: number[];
}

const NO_VALUES: number[] = [];

export interface BarrasChartProps {
  /** Nombre accesible de la gráfica (el kit lo usa también como título de su tabla). */
  label: string;
  type: 'bar' | 'area' | 'line';
  labels: string[];
  series: SerieBarras[];
  stacked?: boolean;
  height?: number;
  barWidth?: number;
}

/**
 * Gráfica del kit con la paleta de una sola familia (acento del tema y su tinte para la serie de comparación). Texto
 * de ejes en español, valores con separador de miles, valor sobre cada barra cuando caben, etiqueta directa del último
 * valor (líneas / áreas) y leyenda arriba a la derecha solo cuando hay varias series.
 */
export function KitChart({ label, type, labels, series, stacked, height = 220, barWidth = 28 }: BarrasChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Las barras apiladas ya muestran su total; las líneas y áreas, el último valor.
  const conEtiquetas = type === 'bar' && !stacked && series.length === 1;
  useBarValueLabels(ref, series[0]?.values ?? NO_VALUES, formatNumber, conEtiquetas);
  return (
    <div ref={ref}>
      <Chart
        className="est-chart vc-chart"
        type={type}
        label={label}
        labels={labels}
        series={series}
        stacked={stacked}
        axis
        legend={series.length > 1}
        height={height}
        barWidth={barWidth}
        barStyle="rounded"
        formatValue={formatNumber}
        emptyLabel="Sin datos en el periodo"
      />
    </div>
  );
}

/** Categorías que se muestran de entrada en las barras horizontales; el resto va tras «Ver todo». */
export const HBARS_LIMITE = 10;

/**
 * Barras horizontales con la etiqueta a la izquierda y el valor a la derecha (etiquetado directo, sin leyenda). Para
 * categorías con nombres largos, donde las barras verticales obligarían a girar el texto. Muestra las primeras
 * {@link HBARS_LIMITE} (los puntos llegan de mayor a menor); con más, «Ver todo» las despliega y la lista crece en alto
 * en vez de apretarse ni cortarse.
 */
export function HBars({ puntos, label, limite = HBARS_LIMITE }: { puntos: readonly Punto[]; label: string; limite?: number }) {
  const [todo, setTodo] = useState(false);
  if (puntos.length === 0) return <p className="est-hbars__empty">Sin datos en el periodo</p>;
  const max = Math.max(1, ...puntos.map((p) => p.value));
  const total = puntos.reduce((sum, p) => sum + p.value, 0);
  const hayMas = puntos.length > limite;
  const visibles = hayMas && !todo ? puntos.slice(0, limite) : puntos;
  return (
    <div className="est-hbars-wrap">
      <ul className="est-hbars" aria-label={label}>
        {visibles.map((punto) => {
          const parte = total > 0 ? Math.round((punto.value / total) * 100) : 0;
          return (
            <li key={punto.label} className="est-hbars__row" title={`${punto.label}: ${formatNumber(punto.value)} (${parte} %)`}>
              <span className="est-hbars__label">{punto.label}</span>
              <span className="est-hbars__track" aria-hidden>
                <span className="est-hbars__fill" style={{ width: `${Math.max(2, (punto.value / max) * 100)}%` }} />
              </span>
              <span className="est-hbars__value">{formatNumber(punto.value)}</span>
            </li>
          );
        })}
      </ul>
      {hayMas ? (
        <button
          type="button"
          className="mk-button mk-button--text mk-button--sm vc-press est-hbars__more"
          aria-expanded={todo}
          onClick={() => setTodo((v) => !v)}
        >
          {todo ? 'Ver menos' : `Ver todo (${puntos.length})`}
        </button>
      ) : null}
    </div>
  );
}

/** Esqueleto con la forma del panel de gráfica (barras fantasma). */
export function ChartSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="est-skeleton">
      <div className="est-skeleton__kpis">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="est-skeleton__bone est-skeleton__kpi" />
        ))}
      </div>
      <div className="est-skeleton__panels">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="est-skeleton__bone est-skeleton__panel" />
        ))}
      </div>
    </div>
  );
}
