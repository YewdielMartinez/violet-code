import { sanitizeText, type ExportCell, type ExportColumn } from './types';

export const CSV_MIME = 'text/csv;charset=utf-8';

const BOM = '﻿';
const EOL = '\r\n';

function csvField(cell: ExportCell): string {
  if (cell === null || cell === undefined) return '';
  const text = typeof cell === 'number' ? (Number.isFinite(cell) ? String(cell) : '') : sanitizeText(String(cell));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV (RFC 4180) listo para Excel: BOM UTF-8 para los acentos, saltos CRLF, comillas dobles escapadas y
 * campos con `,` `"` o saltos entre comillas. Los textos se sanitizan contra inyección de fórmulas.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const lines = [columns.map((c) => csvField(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvField(c.value(row))).join(','));
  return BOM + lines.join(EOL) + EOL;
}

export function toCsvBlob<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): Blob {
  return new Blob([toCsv(rows, columns)], { type: CSV_MIME });
}
