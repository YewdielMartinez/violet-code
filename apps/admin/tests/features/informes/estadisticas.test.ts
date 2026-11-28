import { describe, expect, it } from 'vitest';
import type { ReporteRow } from '@/domain/models/Reporte';
import {
  calcularDelta,
  distribucionPorArea,
  distribucionPorSexo,
  distribucionPorTipo,
  filasDelPeriodo,
  insightPuntos,
  insightSerie,
  insightSeguimiento,
  kpisAtenciones,
  kpiTexto,
  resumenDeTotal,
  resumenPuntos,
  resumenSerie,
  serieAtenciones,
  serieSeguimiento,
} from '@/features/informes/reportes/estadisticas';

function fila(over: Partial<ReporteRow>): ReporteRow {
  return {
    tipo: 'atenciones',
    mes: '2026-03-01',
    areaId: 1,
    area: 'Psicología',
    categoria: 'Terapia',
    estado: 'primera_vez',
    total: 1,
    personas: 1,
    mujeres: 1,
    hombres: 0,
    metrica: null,
    ...over,
  };
}

const SERIE: ReporteRow[] = [
  fila({ mes: '2026-01-01', total: 4, estado: 'primera_vez' }),
  fila({ mes: '2026-01-01', total: 6, estado: 'seguimiento' }),
  fila({ mes: '2026-03-01', total: 5, estado: 'primera_vez', area: 'Jurídico', categoria: 'Asesoría' }),
  fila({ mes: '2026-03-01', total: 2, estado: 'seguimiento', area: 'Jurídico', categoria: 'Asesoría' }),
];
const MESES = ['2026-01-01', '2026-02-01', '2026-03-01'];

describe('calcularDelta', () => {
  it('calcula diferencia, porcentaje y dirección', () => {
    expect(calcularDelta(120, 100)).toEqual({ diff: 20, pct: 20, direccion: 'sube' });
    expect(calcularDelta(75, 100)).toEqual({ diff: -25, pct: -25, direccion: 'baja' });
    expect(calcularDelta(10, 10)).toEqual({ diff: 0, pct: 0, direccion: 'igual' });
  });

  it('no inventa porcentaje cuando el periodo anterior fue 0 o no hay dato', () => {
    expect(calcularDelta(5, 0)).toEqual({ diff: 5, pct: null, direccion: 'sube' });
    expect(calcularDelta(0, 0)).toEqual({ diff: 0, pct: null, direccion: 'igual' });
    expect(calcularDelta(5, null)).toEqual({ diff: 0, pct: null, direccion: 'sin_dato' });
  });
});

describe('resumenDeTotal y KPI', () => {
  const total = fila({ mes: null, total: 20, personas: 9, mujeres: 7, hombres: 2, metrica: 8, estado: null });

  it('toma de la fila única: atenciones, personas, primera vez (metrica) y seguimiento (resto)', () => {
    expect(resumenDeTotal([total])).toEqual({
      atenciones: 20,
      personas: 9,
      primeraVez: 8,
      seguimiento: 12,
      mujeres: 7,
      hombres: 2,
    });
  });

  it('sin filas devuelve ceros', () => {
    expect(resumenDeTotal(undefined).atenciones).toBe(0);
    expect(resumenDeTotal([]).personas).toBe(0);
  });

  it('arma los 4 KPI con su variación y su texto accesible', () => {
    const actual = resumenDeTotal([total]);
    const previo = resumenDeTotal([fila({ mes: null, total: 10, personas: 9, metrica: 5, estado: null })]);
    const kpis = kpisAtenciones(actual, previo);
    expect(kpis.map((k) => k.id)).toEqual(['atenciones', 'personas', 'primeraVez', 'seguimiento']);
    expect(kpis[0].delta).toEqual({ diff: 10, pct: 100, direccion: 'sube' });
    expect(kpis[1].delta.direccion).toBe('igual');
    expect(kpiTexto(kpis[0])).toBe('Atenciones: 20, 100 % más que el periodo anterior (10)');
    expect(kpiTexto(kpis[1])).toBe('Personas atendidas: 9, igual que el periodo anterior');
    expect(kpiTexto(kpisAtenciones(actual, null)[0])).toBe('Atenciones: 20');
  });
});

describe('series mensuales', () => {
  it('suma por mes y rellena con 0 los meses sin atenciones', () => {
    const serie = serieAtenciones(SERIE, MESES);
    expect(serie.values).toEqual([10, 0, 7]);
    expect(serie.labels).toEqual(['ene', 'feb', 'mar']);
    expect(serie.largas[2]).toBe('marzo de 2026');
  });

  it('agrega el año a las etiquetas cuando la serie cruza de año', () => {
    const serie = serieAtenciones([], ['2025-12-01', '2026-01-01']);
    expect(serie.labels).toEqual(['dic 25', 'ene 26']);
  });

  it('separa primera vez y seguimiento', () => {
    const serie = serieSeguimiento(SERIE, MESES);
    expect(serie.primeraVez).toEqual([4, 0, 5]);
    expect(serie.seguimiento).toEqual([6, 0, 2]);
  });

  it('filasDelPeriodo se queda con los meses desde el inicio del periodo', () => {
    expect(filasDelPeriodo(SERIE, { desde: '2026-03-01', hasta: '2026-03-31' })).toHaveLength(2);
    expect(filasDelPeriodo(SERIE, { desde: '2026-01-15', hasta: '2026-03-31' })).toHaveLength(4);
  });
});

describe('distribuciones', () => {
  it('agrupa por tipo de atención de mayor a menor', () => {
    expect(distribucionPorTipo(SERIE)).toEqual([
      { label: 'Terapia', value: 10 },
      { label: 'Asesoría', value: 7 },
    ]);
  });

  it('junta el resto en «Otros» pasado el máximo', () => {
    const rows = ['A', 'B', 'C', 'D'].map((categoria, i) => fila({ categoria, total: 10 - i }));
    expect(distribucionPorTipo(rows, 3)).toEqual([
      { label: 'A', value: 10 },
      { label: 'B', value: 9 },
      { label: 'Otros', value: 15 },
    ]);
  });

  it('agrupa por área y usa «Sin área» si falta', () => {
    expect(distribucionPorArea([...SERIE, fila({ area: null, total: 1 })]).map((p) => p.label)).toEqual([
      'Psicología',
      'Jurídico',
      'Sin área',
    ]);
  });

  it('personas por sexo', () => {
    const resumen = resumenDeTotal([fila({ mes: null, total: 5, mujeres: 3, hombres: 2, estado: null })]);
    expect(distribucionPorSexo(resumen)).toEqual([
      { label: 'Mujeres', value: 3 },
      { label: 'Hombres', value: 2 },
    ]);
  });
});

describe('resúmenes accesibles', () => {
  it('describe total y pico de una serie', () => {
    const serie = serieAtenciones(SERIE, MESES);
    expect(resumenSerie('Atenciones por mes', serie.largas, serie.values)).toBe(
      'Atenciones por mes: 17 en total de enero de 2026 a marzo de 2026; el mes con más fue enero de 2026 con 10.',
    );
    expect(resumenSerie('Atenciones por mes', [], [])).toBe('Atenciones por mes: sin datos en el periodo.');
  });

  it('describe una distribución', () => {
    expect(resumenPuntos('Por tipo', distribucionPorTipo(SERIE))).toBe('Por tipo: 17 en total; Terapia es el mayor con 10.');
    expect(resumenPuntos('Por tipo', [])).toBe('Por tipo: sin datos en el periodo.');
  });
});

describe('insights de las gráficas', () => {
  it('insightSerie: variación del último punto contra el anterior, con flecha y texto', () => {
    expect(insightSerie([10, 20, 22])).toBe('▲ 10 % vs. mes anterior');
    expect(insightSerie([20, 10])).toBe('▼ 50 % vs. mes anterior');
    expect(insightSerie([5, 5])).toBe('= Igual que el mes anterior');
    // Sin base de comparación (anterior 0): diferencia absoluta con signo.
    expect(insightSerie([0, 7])).toBe('▲ +7 vs. mes anterior');
    expect(insightSerie([1, 2], 'semana anterior')).toBe('▲ 100 % vs. semana anterior');
  });

  it('insightSerie: sin dato suficiente no devuelve nada', () => {
    expect(insightSerie([])).toBeNull();
    expect(insightSerie([9])).toBeNull();
    expect(insightSerie([0, 0, 0])).toBeNull();
  });

  it('insightPuntos: el mayor y su parte del total', () => {
    expect(
      insightPuntos([
        { label: 'Psicología', value: 45 },
        { label: 'Jurídico', value: 55 },
      ]),
    ).toBe('Mayor: Jurídico · 55 %');
    expect(insightPuntos([])).toBeNull();
    expect(insightPuntos([{ label: 'A', value: 0 }])).toBeNull();
  });

  it('insightSeguimiento: parte de las atenciones que son seguimiento', () => {
    expect(insightSeguimiento([5, 5], [10, 10])).toBe('Seguimiento: 67 % de las atenciones');
    expect(insightSeguimiento([0], [0])).toBeNull();
  });
});
