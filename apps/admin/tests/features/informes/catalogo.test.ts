import { describe, expect, it } from 'vitest';
import { REPORTE_TIPOS, type ReporteRow, type ReporteTipo } from '@/domain/models/Reporte';
import { REPORTES, REPORTE_OPCIONES, esReporteTipo, tasaAsistencia } from '@/features/informes/reportes/catalogo';

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

describe('catálogo', () => {
  it('define los 6 tipos con etiqueta y selector', () => {
    expect(REPORTE_TIPOS).toHaveLength(6);
    expect(REPORTE_OPCIONES.map((o) => o.label)).toEqual([
      'Atenciones',
      'Citas',
      'Canalizaciones',
      'Órdenes de protección',
      'Actividades preventivas',
      'Alertas',
    ]);
    expect(esReporteTipo('citas')).toBe(true);
    expect(esReporteTipo('personas')).toBe(false);
  });

  it('marca como no divididos por área solo actividades y alertas', () => {
    expect(REPORTE_TIPOS.filter((t) => !REPORTES[t].aplicaArea)).toEqual(['actividades', 'alertas']);
  });

  it('ningún reporte vacío falla y todos se marcan vacíos', () => {
    for (const tipo of REPORTE_TIPOS) {
      const vista = REPORTES[tipo].construir([]);
      expect(vista.vacio).toBe(true);
      expect(vista.tabla.filas).toEqual([]);
      expect(vista.tabla.columnas.length).toBeGreaterThan(0);
      expect(vista.kpis).toHaveLength(3);
    }
  });
});

describe('atenciones', () => {
  const rows = [
    fila('atenciones', { categoria: 'Terapia', estado: 'primera_vez', total: 5, personas: 4, mujeres: 4, hombres: 0 }),
    fila('atenciones', { categoria: 'Terapia', estado: 'seguimiento', total: 9, personas: 4, mujeres: 3, hombres: 1 }),
    fila('atenciones', { area: 'Jurídico', categoria: 'Asesoría', estado: 'primera_vez', total: 2, personas: 2, mujeres: 2, hombres: 0 }),
  ];

  it('una fila por área, tipo y primera vez / seguimiento', () => {
    const { tabla, kpis, grafica } = REPORTES.atenciones.construir(rows);
    expect(tabla.columnas.map((c) => c.header)).toEqual([
      'Área',
      'Tipo de atención',
      'Primera vez / Seguimiento',
      'Mujeres',
      'Hombres',
      'Personas',
      'Atenciones',
    ]);
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas[1]).toMatchObject({ area: 'Psicología', seguimiento: 'Seguimiento', atenciones: 9, hombres: 1 });
    expect(kpis.map((k) => k.value)).toEqual(['16', '7', '9']);
    expect(grafica.kind).toBe('hbars');
  });
});

describe('citas', () => {
  const rows = [
    fila('citas', { estado: 'agendada', total: 2 }),
    fila('citas', { estado: 'asistio', total: 3 }),
    fila('citas', { estado: 'no_asistio', total: 1 }),
    fila('citas', { area: 'Trabajo Social', areaId: 2, estado: 'agendada', total: 4 }),
    fila('citas', { area: 'Trabajo Social', areaId: 2, estado: 'cancelada', total: 1 }),
  ];

  it('pivota por área con tasa de asistencia y fila de total', () => {
    const { tabla, kpis, grafica } = REPORTES.citas.construir(rows);
    expect(tabla.columnas.map((c) => c.header)).toEqual([
      'Área',
      'Agendadas',
      'Confirmadas',
      'Reagendadas',
      'Asistió',
      'No asistió',
      'Canceladas',
      'Total',
      'Tasa de asistencia (%)',
    ]);
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas[0]).toMatchObject({ area: 'Psicología', asistio: 3, no_asistio: 1, total: 6, tasaAsistencia: 75 });
    expect(tabla.filas[1]).toMatchObject({ area: 'Trabajo Social', agendada: 4, cancelada: 1, tasaAsistencia: null });
    expect(tabla.filas[2]).toMatchObject({ id: 'total', area: 'Total', total: 11, tasaAsistencia: 75 });
    expect(kpis.map((k) => k.value)).toEqual(['11', '3', '75 %']);
    expect(grafica).toMatchObject({ kind: 'barras', labels: expect.arrayContaining(['Asistió', 'No asistió']) });
    expect(grafica.kind === 'barras' && grafica.values).toEqual([6, 0, 0, 3, 1, 1]);
  });

  it('con una sola área no agrega fila de total', () => {
    expect(REPORTES.citas.construir(rows.slice(0, 3)).tabla.filas).toHaveLength(1);
  });

  it('la tasa de asistencia solo cuenta citas ya cerradas', () => {
    expect(tasaAsistencia(2, 1)).toBe(66.7);
    expect(tasaAsistencia(0, 0)).toBeNull();
    expect(REPORTES.citas.construir([fila('citas', { estado: 'agendada', total: 2 })]).kpis[2].value).toBe('—');
  });
});

describe('canalizaciones', () => {
  const rows = [
    fila('canalizaciones', { area: 'Trabajo Social', categoria: 'juridico', estado: 'concluida', total: 2, metrica: 4 }),
    fila('canalizaciones', { area: 'Trabajo Social', categoria: 'juridico', estado: 'pendiente', total: 1 }),
    fila('canalizaciones', { area: 'Trabajo Social', categoria: 'psicologia', estado: 'concluida', total: 1, metrica: 10 }),
    fila('canalizaciones', { area: null, areaId: null, categoria: 'refugio', estado: 'en_proceso', total: 1 }),
  ];

  it('pivota por área de origen y destino con días promedio ponderados', () => {
    const { tabla, kpis, grafica } = REPORTES.canalizaciones.construir(rows);
    expect(tabla.columnas.map((c) => c.header)).toEqual([
      'Área de origen',
      'Destino',
      'Pendientes',
      'En proceso',
      'Concluidas',
      'Canceladas',
      'Total',
      'Días promedio a conclusión',
    ]);
    expect(tabla.filas[0]).toMatchObject({ area: 'Trabajo Social', destino: 'Jurídico', concluida: 2, pendiente: 1, total: 3, diasPromedio: 4 });
    expect(tabla.filas[2]).toMatchObject({ area: 'Sin área', destino: 'Refugio', en_proceso: 1, diasPromedio: null });
    expect(tabla.filas[3]).toMatchObject({ id: 'total', total: 5, concluida: 3, diasPromedio: 6 });
    expect(kpis.map((k) => k.value)).toEqual(['5', '3', '6']);
    expect(grafica.kind === 'hbars' && grafica.puntos[0]).toEqual({ label: 'Jurídico', value: 3 });
  });
});

describe('órdenes de protección', () => {
  it('pivota por área que registró y estado', () => {
    const { tabla, kpis, grafica } = REPORTES.ordenes_proteccion.construir([
      fila('ordenes_proteccion', { area: 'Jurídico', estado: 'vigente', total: 4 }),
      fila('ordenes_proteccion', { area: 'Jurídico', estado: 'vencida', total: 1 }),
      fila('ordenes_proteccion', { area: 'Trabajo Social', estado: 'en_tramite', total: 2 }),
    ]);
    expect(tabla.columnas.map((c) => c.header)).toEqual([
      'Área que registró',
      'En trámite',
      'Vigentes',
      'Vencidas',
      'Canceladas',
      'Total',
    ]);
    expect(tabla.filas[0]).toMatchObject({ area: 'Jurídico', vigente: 4, vencida: 1, total: 5 });
    expect(kpis.map((k) => k.value)).toEqual(['7', '4', '2']);
    expect(grafica.kind === 'barras' && grafica.values).toEqual([2, 4, 1, 0]);
  });
});

describe('actividades preventivas', () => {
  const rows = [
    fila('actividades', { area: null, areaId: null, categoria: 'comunidad', estado: 'realizada', total: 2, metrica: 70 }),
    fila('actividades', { area: null, areaId: null, categoria: 'comunidad', estado: 'pendiente', total: 1, metrica: 0 }),
    fila('actividades', { area: null, areaId: null, categoria: 'escuela', estado: 'realizada', total: 1, metrica: 25 }),
    fila('actividades', { area: null, areaId: null, categoria: 'escuela', estado: 'cancelada', total: 1, metrica: 0 }),
  ];

  it('por tipo de institución con asistentes de las realizadas', () => {
    const { tabla, kpis, grafica } = REPORTES.actividades.construir(rows);
    expect(tabla.columnas.map((c) => c.header)).toEqual([
      'Tipo de institución',
      'Pendientes',
      'Realizadas',
      'Canceladas',
      'Total',
      'Asistentes (realizadas)',
    ]);
    expect(tabla.filas[0]).toMatchObject({ institucion: 'Comunidad', realizada: 2, pendiente: 1, asistentes: 70 });
    expect(tabla.filas[1]).toMatchObject({ institucion: 'Escuela', cancelada: 1, asistentes: 25 });
    expect(tabla.filas[2]).toMatchObject({ id: 'total', total: 5, asistentes: 95 });
    expect(kpis.map((k) => k.value)).toEqual(['5', '3', '95']);
    expect(grafica.kind === 'hbars' && grafica.puntos.map((p) => p.label)).toEqual(['Comunidad', 'Escuela']);
  });
});

describe('alertas', () => {
  it('por origen y estado con minutos promedio ponderados', () => {
    const { tabla, kpis } = REPORTES.alertas.construir([
      fila('alertas', { area: null, areaId: null, categoria: 'telefono', estado: 'atendida', total: 2, metrica: 20 }),
      fila('alertas', { area: null, areaId: null, categoria: 'app_movil', estado: 'atendida', total: 1, metrica: 50 }),
      fila('alertas', { area: null, areaId: null, categoria: 'app_movil', estado: 'nueva', total: 1 }),
    ]);
    expect(tabla.columnas.map((c) => c.header)).toEqual([
      'Origen',
      'Nuevas',
      'Tomadas',
      'Atendidas',
      'Total',
      'Minutos promedio de atención',
    ]);
    expect(tabla.filas[0]).toMatchObject({ origen: 'Teléfono', atendida: 2, minutosPromedio: 20 });
    expect(tabla.filas[1]).toMatchObject({ origen: 'App móvil', nueva: 1, atendida: 1, minutosPromedio: 50 });
    expect(tabla.filas[2]).toMatchObject({ id: 'total', total: 4, minutosPromedio: 30 });
    expect(kpis.map((k) => k.value)).toEqual(['4', '3', '30']);
  });
});
