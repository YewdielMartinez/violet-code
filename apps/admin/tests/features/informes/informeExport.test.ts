import { describe, expect, it } from 'vitest';
import {
  INFORME_EXPORT_COLUMNS,
  assertNoPiiColumns,
  informeFileName,
  resumirInforme,
} from '@/features/informes/informeExport';
import { puedeVerInformes } from '@/features/informes/informesPermisos';
import { toCsv } from '@/shared/export';
import { ROWS } from './fixtures';

describe('informeFileName', () => {
  it('mensual con mes de dos dígitos y anual sin mes', () => {
    expect(informeFileName(2026, 3, 'csv')).toBe('informe-2026-03.csv');
    expect(informeFileName(2026, 11, 'xlsx')).toBe('informe-2026-11.xlsx');
    expect(informeFileName(2026, null, 'xlsx')).toBe('informe-2026.xlsx');
  });
});

describe('resumirInforme', () => {
  it('suma atenciones por primera vez y seguimiento (RN-19)', () => {
    expect(resumirInforme(ROWS)).toEqual({ total: 16, primeraVez: 7, seguimiento: 9 });
    expect(resumirInforme([])).toEqual({ total: 0, primeraVez: 0, seguimiento: 0 });
  });
});

describe('columnas de exportación', () => {
  it('no incluyen datos personales', () => {
    expect(() => assertNoPiiColumns(INFORME_EXPORT_COLUMNS)).not.toThrow();
  });

  it('el aserto rechaza columnas con datos personales', () => {
    expect(() => assertNoPiiColumns([{ key: 'curp', header: 'CURP' }])).toThrow(/datos personales/);
    expect(() => assertNoPiiColumns([{ key: 'x', header: 'Nombre completo' }])).toThrow();
    expect(() => assertNoPiiColumns([{ key: 'telefono', header: 'Contacto' }])).toThrow();
  });

  it('generan el CSV con las siete columnas del informe', () => {
    const csv = toCsv(ROWS, INFORME_EXPORT_COLUMNS);
    const [header, first] = csv.replace('﻿', '').split('\r\n');
    expect(header).toBe('Área,Tipo de atención,Primera vez / Seguimiento,Mujeres,Hombres,Personas,Atenciones');
    expect(first).toBe('Psicología,Terapia individual,Primera vez,4,0,4,5');
  });
});

describe('puedeVerInformes', () => {
  it('Dirección y áreas de atención sí; Recepción, UMECA y sin sesión no', () => {
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'] as const) {
      expect(puedeVerInformes(role)).toBe(true);
    }
    expect(puedeVerInformes('recepcion')).toBe(false);
    expect(puedeVerInformes('umeca')).toBe(false);
    expect(puedeVerInformes(undefined)).toBe(false);
    expect(puedeVerInformes(null)).toBe(false);
  });
});
