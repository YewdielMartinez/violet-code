/** Valor de una celda exportable. Los números se conservan numéricos; todo lo demás es texto. */
export type ExportCell = string | number | null | undefined;

export interface ExportColumn<T> {
  /** Clave estable de la columna (útil para auditar que no haya columnas con datos personales). */
  key: string;
  /** Encabezado visible en el archivo. */
  header: string;
  value: (row: T) => ExportCell;
}

/**
 * Neutraliza la inyección de fórmulas (CSV/Excel): un texto que empieza con `=`, `+`, `-`, `@`, tabulador o retorno de
 * carro se antepone con apóstrofo para que la hoja de cálculo lo trate como texto. Los números no se tocan.
 */
export function sanitizeText(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
