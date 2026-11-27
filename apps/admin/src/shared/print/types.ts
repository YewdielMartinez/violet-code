import type { ExportColumn } from '@/shared/export';

/** Filtro aplicado al reporte («Periodo: Marzo 2026»). */
export interface PrintFiltro {
  label: string;
  value: string;
}

export interface PrintKpi {
  label: string;
  value: string | number;
  /** Línea pequeña bajo la cifra (p. ej. variación contra el periodo anterior). */
  nota?: string;
}

export interface PrintLegendItem {
  label: string;
  /** Color CSS del símbolo de la leyenda. */
  color: string;
}

export interface PrintBar {
  label: string;
  value: number;
}

/**
 * Gráfica del documento: un SVG ya serializado (`svg`) o, si no hay SVG visible (p. ej. la gráfica está en «Ver datos»
 * o es de barras HTML), barras simples dibujadas con los mismos datos (`bars`).
 */
export interface PrintChart {
  title: string;
  svg?: string;
  legend?: readonly PrintLegendItem[];
  bars?: readonly PrintBar[];
}

export interface PrintReportOptions<T> {
  title: string;
  subtitle?: string;
  filtros: readonly PrintFiltro[];
  kpis?: readonly PrintKpi[];
  /** Las mismas columnas de la exportación CSV / Excel: nunca se agregan datos que el archivo no tenga. */
  columns: readonly ExportColumn<T>[];
  rows: readonly T[];
  /** Atajo para una sola gráfica ya serializada (`svg` de {@link PrintChart}). */
  chartSvg?: string;
  charts?: readonly PrintChart[];
  /** Etiqueta del rol de quien genera el documento (la completa `usePrintable` desde la sesión). */
  usuarioRol?: string;
  /** Nota al pie («Documento sin datos personales»). */
  nota?: string;
  /** Claves de columnas que se muestran en tipografía monoespaciada (folios, identificadores). */
  monoKeys?: readonly string[];
  /** Filas que se resaltan como total. */
  isTotal?: (row: T) => boolean;
  /** Fecha de generación (por defecto, ahora). Útil en pruebas. */
  now?: Date;
}
