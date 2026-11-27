import type { ReporteTipo } from '@/domain/models/Reporte';
import type { ExportColumn } from '@/shared/export';
import { assertNoPiiColumns } from '../informeExport';
import type { ReporteFila, ReporteTabla } from './catalogo';
import { periodoParaArchivo, type Periodo } from './periodo';

/**
 * Columnas de exportación de un reporte: las mismas de la tabla en pantalla. Los textos pasan por la sanitización de
 * fórmulas de `@/shared/export` (CSV y Excel) y se verifica que ningún encabezado delate datos personales.
 */
export function columnasExportacion(tabla: ReporteTabla): ExportColumn<ReporteFila>[] {
  const columnas = tabla.columnas.map<ExportColumn<ReporteFila>>((columna) => ({
    key: columna.key,
    header: columna.header,
    value: (fila) => fila[columna.key],
  }));
  assertNoPiiColumns(columnas);
  return columnas;
}

/** `Trabajo Social` → `trabajo-social` (para nombres de archivo). */
export function slugArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `reporte-citas-2026-03-psicologia.csv`; sin área, `reporte-citas-2026-03-todas.csv`. */
export function reporteFileName(
  tipo: ReporteTipo,
  periodo: Periodo,
  area: string | null,
  ext: 'csv' | 'xlsx',
): string {
  const areaSlug = area ? slugArchivo(area) : 'todas';
  return `reporte-${tipo.replace(/_/g, '-')}-${periodoParaArchivo(periodo)}-${areaSlug || 'todas'}.${ext}`;
}
