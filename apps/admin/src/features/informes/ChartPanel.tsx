import { useId, useState, type ReactNode } from 'react';
import { Chart } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/chart';
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
  /** Alternativa en tabla: botón «Ver datos». */
  data: ChartTableData;
  className?: string;
  children: ReactNode;
}

/**
 * Marco de una gráfica: título, resumen accesible y alternancia «Ver datos» ↔ «Ver gráfica» (la misma información en
 * tabla). El tamaño responde al ancho del contenedor (container queries), no al de la ventana.
 */
export function ChartPanel({ title, summary, data, className = '', children }: ChartPanelProps) {
  const [verDatos, setVerDatos] = useState(false);
  const summaryId = useId();

  return (
    <section aria-label={title} aria-describedby={summaryId} className={`est-panel ${className}`}>
      <header className="est-panel__head">
        <h3 className="est-panel__title">{title}</h3>
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
        <div className="est-datatable-wrap">
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
 * Gráfica del kit con la paleta de una sola familia (burdeos / rosas del tema). Texto de ejes en español, valores con
 * separador de miles y etiqueta directa del último valor (líneas / áreas) o leyenda cuando hay varias series.
 */
export function KitChart({ label, type, labels, series, stacked, height = 220, barWidth = 28 }: BarrasChartProps) {
  return (
    <Chart
      className="est-chart"
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
  );
}

/**
 * Barras horizontales con la etiqueta a la izquierda y el valor al final de cada barra (etiquetado directo, sin
 * leyenda). Para categorías con nombres largos, donde las barras verticales obligarían a girar el texto.
 */
export function HBars({ puntos, label }: { puntos: readonly Punto[]; label: string }) {
  const max = Math.max(1, ...puntos.map((p) => p.value));
  if (puntos.length === 0) return <p className="est-hbars__empty">Sin datos en el periodo</p>;
  return (
    <ul className="est-hbars" aria-label={label}>
      {puntos.map((punto) => (
        <li key={punto.label} className="est-hbars__row">
          <span className="est-hbars__label" title={punto.label}>
            {punto.label}
          </span>
          <span className="est-hbars__track" aria-hidden>
            <span className="est-hbars__fill" style={{ width: `${Math.max(2, (punto.value / max) * 100)}%` }} />
          </span>
          <span className="est-hbars__value">{formatNumber(punto.value)}</span>
        </li>
      ))}
    </ul>
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
