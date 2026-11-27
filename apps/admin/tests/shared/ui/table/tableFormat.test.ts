import { describe, expect, it } from 'vitest';
import {
  TABLE_LABELS,
  TABLE_PAGE_SIZES,
  formatDecimal,
  formatInt,
  formatNumberCell,
  formatRange,
  numericColumn,
  pageRange,
} from '@/shared/ui/table/tableFormat';

describe('formatos de tabla (es-MX)', () => {
  it('formatea enteros con separador de miles y descarta lo no finito', () => {
    expect(formatInt(1248)).toBe('1,248');
    expect(formatInt(12.6)).toBe('13');
    expect(formatInt(Number.NaN)).toBe('—');
  });

  it('formatea decimales con un decimal como máximo', () => {
    expect(formatDecimal(85.54)).toBe('85.5');
    expect(formatDecimal(12)).toBe('12');
    expect(formatDecimal(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('arma el rango «1–10 de 42» y «Sin resultados» cuando no hay filas', () => {
    expect(formatRange(1, 10, 42)).toBe('1–10 de 42');
    expect(formatRange(1, 25, 1248)).toBe('1–25 de 1,248');
    expect(formatRange(0, 0, 0)).toBe('Sin resultados');
  });

  it('calcula el rango visible de una página, incluida la última parcial y «todas»', () => {
    expect(pageRange(1, 10, 42)).toEqual({ from: 1, to: 10 });
    expect(pageRange(5, 10, 42)).toEqual({ from: 41, to: 42 });
    expect(pageRange(99, 10, 42)).toEqual({ from: 41, to: 42 });
    expect(pageRange(1, 0, 7)).toEqual({ from: 1, to: 7 });
    expect(pageRange(1, 10, 0)).toEqual({ from: 0, to: 0 });
  });

  it('muestra «—» en una celda numérica sin dato', () => {
    expect(formatNumberCell(1500)).toBe('1,500');
    expect(formatNumberCell(null)).toBe('—');
    expect(formatNumberCell('x', 'n/d')).toBe('n/d');
  });
});

describe('numericColumn', () => {
  it('alinea a la derecha, es numérica y ordenable por defecto', () => {
    expect(numericColumn('total', 'Total')).toEqual({
      key: 'total',
      label: 'Total',
      type: 'number',
      align: 'end',
      sortable: true,
    });
  });

  it('admite sobrescribir opciones', () => {
    const format = () => 'x';
    expect(numericColumn('n', 'N', { sortable: false, format })).toMatchObject({ sortable: false, format });
  });
});

describe('configuración compartida', () => {
  it('ofrece 10 / 25 / 50 filas por página y textos en español', () => {
    expect(TABLE_PAGE_SIZES).toEqual([10, 25, 50]);
    expect(TABLE_LABELS.pageOf).toBe('Página {page} de {pages}');
    expect(TABLE_LABELS.range).toBe('{from}–{to} de {total}');
  });
});
