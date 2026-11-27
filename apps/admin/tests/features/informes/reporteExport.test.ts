import { describe, expect, it } from 'vitest';
import { REPORTE_TIPOS, type ReporteRow, type ReporteTipo } from '@/domain/models/Reporte';
import { REPORTES } from '@/features/informes/reportes/catalogo';
import { columnasExportacion, reporteFileName, slugArchivo } from '@/features/informes/reportes/reporteExport';
import type { Periodo } from '@/features/informes/reportes/periodo';
import { toCsv, toXlsxBytes } from '@/shared/export';

function fila(tipo: ReporteTipo, over: Partial<ReporteRow>): ReporteRow {
  return {
    tipo,
    mes: null,
    areaId: 1,
    area: 'Psicología',
    categoria: null,
    estado: null,
    total: 1,
    personas: null,
    mujeres: null,
    hombres: null,
    metrica: null,
    ...over,
  };
}

const MUESTRAS: Record<ReporteTipo, ReporteRow[]> = {
  atenciones: [fila('atenciones', { categoria: 'Terapia', estado: 'primera_vez', total: 5, personas: 4, mujeres: 4, hombres: 0 })],
  citas: [fila('citas', { estado: 'asistio', total: 3 }), fila('citas', { estado: 'no_asistio', total: 1 })],
  canalizaciones: [fila('canalizaciones', { categoria: 'juridico', estado: 'concluida', total: 2, metrica: 4 })],
  ordenes_proteccion: [fila('ordenes_proteccion', { estado: 'vigente', total: 4 })],
  actividades: [fila('actividades', { area: null, categoria: 'comunidad', estado: 'realizada', total: 2, metrica: 70 })],
  alertas: [fila('alertas', { area: null, categoria: 'telefono', estado: 'atendida', total: 2, metrica: 20 })],
};

const MARZO: Periodo = { modo: 'mensual', anio: 2026, mes: 3, desde: '', hasta: '' };

describe('exportación por tipo de reporte', () => {
  it.each(REPORTE_TIPOS)('%s: CSV con encabezados de la tabla y sin columnas de datos personales', (tipo) => {
    const { tabla } = REPORTES[tipo].construir(MUESTRAS[tipo]);
    const columnas = columnasExportacion(tabla);
    expect(columnas.map((c) => c.header)).toEqual(tabla.columnas.map((c) => c.header));

    const csv = toCsv(tabla.filas, columnas);
    const [encabezado, primera] = csv.replace('﻿', '').split('\r\n');
    expect(encabezado).toBe(tabla.columnas.map((c) => c.header).join(','));
    expect(primera.split(',').length).toBeGreaterThanOrEqual(tabla.columnas.length);
  });

  it.each(REPORTE_TIPOS)('%s: Excel (.xlsx) válido', (tipo) => {
    const { tabla } = REPORTES[tipo].construir(MUESTRAS[tipo]);
    const bytes = toXlsxBytes(tabla.filas, columnasExportacion(tabla), 'Reporte');
    // Un .xlsx es un zip: empieza con «PK».
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    expect(bytes.length).toBeGreaterThan(200);
  });

  it('los números se exportan como números (tasa y promedios incluidos)', () => {
    const { tabla } = REPORTES.citas.construir(MUESTRAS.citas);
    const csv = toCsv(tabla.filas, columnasExportacion(tabla));
    expect(csv).toContain('Psicología,0,0,0,3,1,0,4,75');
  });

  it('neutraliza la inyección de fórmulas en los textos (CSV y Excel)', () => {
    const malicioso = [fila('atenciones', { area: '=HYPERLINK("http://x")', categoria: '+SUMA(A1)', estado: 'primera_vez' })];
    const { tabla } = REPORTES.atenciones.construir(malicioso);
    const csv = toCsv(tabla.filas, columnasExportacion(tabla));
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain("'+SUMA(A1)");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);

    const xml = new TextDecoder().decode(toXlsxBytes(tabla.filas, columnasExportacion(tabla)));
    expect(xml).toContain("'=HYPERLINK");
    expect(xml).not.toContain('>=HYPERLINK');
  });

  it('rechaza una columna que parezca exponer datos personales', () => {
    expect(() =>
      columnasExportacion({ columnas: [{ key: 'curp', header: 'CURP' }], filas: [] }),
    ).toThrow(/datos personales/);
    expect(() =>
      columnasExportacion({ columnas: [{ key: 'x', header: 'Nombre de la usuaria' }], filas: [] }),
    ).toThrow(/datos personales/);
  });
});

describe('nombres de archivo', () => {
  it('incluye tipo, periodo y área', () => {
    expect(reporteFileName('citas', MARZO, 'Psicología', 'csv')).toBe('reporte-citas-2026-03-psicologia.csv');
    expect(reporteFileName('ordenes_proteccion', { ...MARZO, modo: 'anual' }, null, 'xlsx')).toBe(
      'reporte-ordenes-proteccion-2026-todas.xlsx',
    );
    expect(
      reporteFileName('alertas', { ...MARZO, modo: 'rango', desde: '2026-03-01', hasta: '2026-03-15' }, null, 'csv'),
    ).toBe('reporte-alertas-2026-03-01_a_2026-03-15-todas.csv');
  });

  it('normaliza acentos y símbolos', () => {
    expect(slugArchivo('Trabajo Social')).toBe('trabajo-social');
    expect(slugArchivo('  Jurídico / Área  ')).toBe('juridico-area');
  });
});
