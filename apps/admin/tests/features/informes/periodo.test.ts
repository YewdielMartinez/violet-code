import { describe, expect, it } from 'vitest';
import {
  diasEnRango,
  etiquetaMes,
  etiquetaPeriodo,
  mesesEnRango,
  periodoInicial,
  periodoParaArchivo,
  rangoAnterior,
  rangoDePeriodo,
  rangoTendencia,
  rangoValido,
  type Periodo,
} from '@/features/informes/reportes/periodo';

const mensual = (anio: number, mes: number): Periodo => ({ modo: 'mensual', anio, mes, desde: '', hasta: '' });
const anual = (anio: number): Periodo => ({ modo: 'anual', anio, mes: 1, desde: '', hasta: '' });
const rango = (desde: string, hasta: string): Periodo => ({ modo: 'rango', anio: 2026, mes: 1, desde, hasta });

describe('periodoInicial', () => {
  it('abre el mes actual y, en rango, del día 1 a hoy', () => {
    expect(periodoInicial(new Date(2026, 2, 15))).toEqual({
      modo: 'mensual',
      anio: 2026,
      mes: 3,
      desde: '2026-03-01',
      hasta: '2026-03-15',
    });
  });
});

describe('rangoDePeriodo', () => {
  it('cubre el mes completo (incluye bisiestos)', () => {
    expect(rangoDePeriodo(mensual(2026, 3))).toEqual({ desde: '2026-03-01', hasta: '2026-03-31' });
    expect(rangoDePeriodo(mensual(2024, 2))).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
  });

  it('cubre el año completo y respeta el rango libre', () => {
    expect(rangoDePeriodo(anual(2025))).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
    expect(rangoDePeriodo(rango('2026-03-10', '2026-03-15'))).toEqual({ desde: '2026-03-10', hasta: '2026-03-15' });
  });
});

describe('rangoAnterior', () => {
  it('mensual: el mes previo, cruzando de año y con febrero bisiesto', () => {
    expect(rangoAnterior(mensual(2026, 3))).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoAnterior(mensual(2026, 1))).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(rangoAnterior(mensual(2024, 3))).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
  });

  it('anual: el año previo', () => {
    expect(rangoAnterior(anual(2026))).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
  });

  it('rango: los mismos días inmediatamente antes', () => {
    expect(rangoAnterior(rango('2026-03-10', '2026-03-15'))).toEqual({ desde: '2026-03-04', hasta: '2026-03-09' });
    expect(rangoAnterior(rango('2026-03-01', '2026-03-01'))).toEqual({ desde: '2026-02-28', hasta: '2026-02-28' });
  });
});

describe('rangoTendencia', () => {
  it('mensual: 12 meses que terminan en el mes elegido', () => {
    expect(rangoTendencia(mensual(2026, 3))).toEqual({ desde: '2025-04-01', hasta: '2026-03-31' });
    expect(rangoTendencia(mensual(2026, 12))).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' });
    expect(mesesEnRango(rangoTendencia(mensual(2026, 3)))).toHaveLength(12);
  });

  it('anual y rango: el mismo rango del periodo', () => {
    expect(rangoTendencia(anual(2025))).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
    expect(rangoTendencia(rango('2026-01-20', '2026-03-05'))).toEqual({ desde: '2026-01-20', hasta: '2026-03-05' });
  });
});

describe('mesesEnRango', () => {
  it('lista los meses que toca el rango, cruzando de año', () => {
    expect(mesesEnRango({ desde: '2025-11-15', hasta: '2026-02-03' })).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });
});

describe('rangoValido', () => {
  it('exige fechas completas, orden correcto y máximo 5 años', () => {
    expect(rangoValido({ desde: '2026-03-01', hasta: '2026-03-31' })).toBe(true);
    expect(rangoValido({ desde: '', hasta: '2026-03-31' })).toBe(false);
    expect(rangoValido({ desde: '2026-04-01', hasta: '2026-03-31' })).toBe(false);
    expect(rangoValido({ desde: '2018-01-01', hasta: '2026-03-31' })).toBe(false);
  });

  it('cuenta los días con ambos extremos', () => {
    expect(diasEnRango({ desde: '2026-03-10', hasta: '2026-03-15' })).toBe(6);
  });
});

describe('etiquetas', () => {
  it('describe el periodo y arma el fragmento del archivo', () => {
    expect(etiquetaPeriodo(mensual(2026, 3))).toBe('Marzo 2026');
    expect(etiquetaPeriodo(anual(2026))).toBe('Año 2026');
    expect(etiquetaPeriodo(rango('2026-03-01', '2026-03-15'))).toBe('1 mar 2026 – 15 mar 2026');
    expect(etiquetaPeriodo(rango('', ''))).toBe('Rango sin definir');
    expect(periodoParaArchivo(mensual(2026, 3))).toBe('2026-03');
    expect(periodoParaArchivo(anual(2026))).toBe('2026');
    expect(periodoParaArchivo(rango('2026-03-01', '2026-03-15'))).toBe('2026-03-01_a_2026-03-15');
  });

  it('abrevia el mes y agrega el año solo si la serie cruza de año', () => {
    expect(etiquetaMes('2026-03-01', false)).toBe('mar');
    expect(etiquetaMes('2025-12-01', true)).toBe('dic 25');
  });
});
