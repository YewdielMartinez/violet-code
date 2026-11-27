import type { DataColumn, DataTableProps } from '@yewdiel21/motion-kit/react';

type Row = Record<string, unknown>;

/** Filas por página que ofrece el selector del pie de las tablas operativas. */
export const TABLE_PAGE_SIZES: number[] = [10, 25, 50];

/**
 * Textos del kit en español de México. Constante a nivel de módulo: el `DataTable` compara `labels` por contenido,
 * pero una referencia estable evita serializarlo en cada render.
 */
export const TABLE_LABELS: NonNullable<DataTableProps<Row>['labels']> = {
  range: '{from}–{to} de {total}',
  zeroResults: 'Sin resultados',
  pageOf: 'Página {page} de {pages}',
  rows: 'Filas por página',
  noResults: 'Sin resultados',
  noResultsHint: 'Prueba con otra búsqueda o quita los filtros.',
};

const INT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** Entero con separador de miles en es-MX («1,248»). */
export function formatInt(value: number): string {
  return Number.isFinite(value) ? INT.format(Math.round(value)) : '—';
}

/** Número con hasta un decimal en es-MX («12.5»). */
export function formatDecimal(value: number): string {
  return Number.isFinite(value) ? DECIMAL.format(value) : '—';
}

/** «1–10 de 42» (el mismo texto que dibuja el pie del kit); «Sin resultados» si no hay filas. */
export function formatRange(from: number, to: number, total: number): string {
  if (total <= 0) return 'Sin resultados';
  return `${formatInt(from)}–${formatInt(to)} de ${formatInt(total)}`;
}

/** Rango visible de la página `page` (base 1) con `pageSize` filas; `pageSize` 0 = todas. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  if (pageSize <= 0) return { from: 1, to: total };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safe = Math.min(Math.max(1, page), pages);
  return { from: (safe - 1) * pageSize + 1, to: Math.min(total, safe * pageSize) };
}

/**
 * Columna numérica: alineada a la derecha, ordenable y con cifras tabulares (el CSS de `vc-table` las alinea por
 * `data-align='end'`). Pasa `format` si el número necesita un texto propio («—» cuando no hay dato).
 */
export function numericColumn<T extends Row>(
  key: string,
  label: string,
  extra: Partial<DataColumn<T>> = {},
): DataColumn<T> {
  return { key, label, type: 'number', align: 'end', sortable: true, ...extra };
}

/** Texto de una celda numérica que puede venir vacía. */
export function formatNumberCell(value: unknown, empty = '—'): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatInt(value) : empty;
}
