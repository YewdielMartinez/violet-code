import type { InformeRow } from '@/domain/models/Informe';
import type { ExportColumn } from '@/shared/export';

export const SEGUIMIENTO_LABELS: Record<InformeRow['primeraVezOSeguimiento'], string> = {
  primera_vez: 'Primera vez',
  seguimiento: 'Seguimiento',
};

/** Columnas del informe: solo conteos agregados por área y tipo de atención (sin datos personales). */
export const INFORME_EXPORT_COLUMNS: readonly ExportColumn<InformeRow>[] = [
  { key: 'area', header: 'Área', value: (r) => r.area },
  { key: 'tipoAtencion', header: 'Tipo de atención', value: (r) => r.tipoAtencion },
  {
    key: 'primeraVezOSeguimiento',
    header: 'Primera vez / Seguimiento',
    value: (r) => SEGUIMIENTO_LABELS[r.primeraVezOSeguimiento],
  },
  { key: 'mujeres', header: 'Mujeres', value: (r) => r.mujeres },
  { key: 'hombres', header: 'Hombres', value: (r) => r.hombres },
  { key: 'totalPersonas', header: 'Personas', value: (r) => r.totalPersonas },
  { key: 'totalAtenciones', header: 'Atenciones', value: (r) => r.totalAtenciones },
];

/** Claves / encabezados que delatarían datos personales de las usuarias: el informe nunca debe exportarlos. */
const PII_PATTERN = /curp|nombre|apellido|tel[eé]fono|celular|correo|e-?mail|domicilio|direcci[oó]n|rfc|folio|expediente/i;

/** Falla si alguna columna parece exponer datos personales (el informe es solo estadístico). */
export function assertNoPiiColumns(columns: readonly Pick<ExportColumn<unknown>, 'key' | 'header'>[]): void {
  for (const column of columns) {
    if (PII_PATTERN.test(column.key) || PII_PATTERN.test(column.header)) {
      throw new Error(`La columna «${column.header}» parece contener datos personales y no puede exportarse.`);
    }
  }
}

/** `informe-2026.csv` (anual) o `informe-2026-03.csv` (mensual). */
export function informeFileName(anio: number, mes: number | null, ext: 'csv' | 'xlsx'): string {
  const periodo = mes === null ? String(anio) : `${anio}-${String(mes).padStart(2, '0')}`;
  return `informe-${periodo}.${ext}`;
}

export interface InformeResumen {
  total: number;
  primeraVez: number;
  seguimiento: number;
}

/** Total de atenciones y su reparto primera vez / seguimiento (RN-19). */
export function resumirInforme(rows: readonly InformeRow[]): InformeResumen {
  let primeraVez = 0;
  let seguimiento = 0;
  for (const row of rows) {
    if (row.primeraVezOSeguimiento === 'seguimiento') seguimiento += row.totalAtenciones;
    else primeraVez += row.totalAtenciones;
  }
  return { total: primeraVez + seguimiento, primeraVez, seguimiento };
}
