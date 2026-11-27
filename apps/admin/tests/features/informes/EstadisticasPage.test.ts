import { describe, expect, it } from 'vitest';
import { estadisticasWidgetsForRole } from '@/features/informes/EstadisticasPage';
import { WIDGETS } from '@/features/dashboard/layout';

const defaultSizeMap = new Map(WIDGETS.map((w) => [w.id, w.defaultSize]));

describe('estadisticasWidgetsForRole', () => {
  it('muestra KPIs, tendencia y bitácora a dirección', () => {
    for (const role of ['titular', 'subdireccion'] as const) {
      const items = estadisticasWidgetsForRole(role);
      expect(items.map((i) => i.id)).toEqual([
        'kpi_alerts',
        'kpi_citas',
        'kpi_expedientes',
        'kpi_prioritarios',
        'trend',
        'security',
      ]);
      for (const item of items) {
        expect(item.visible).toBe(true);
        expect(item.size).toBe(defaultSizeMap.get(item.id));
      }
    }
  });

  it('muestra KPIs y tendencia sin bitácora ni agenda a áreas de atención', () => {
    for (const role of ['trabajo_social', 'psicologia', 'juridico'] as const) {
      const items = estadisticasWidgetsForRole(role);
      expect(items.map((i) => i.id)).toEqual([
        'kpi_alerts',
        'kpi_citas',
        'kpi_expedientes',
        'kpi_prioritarios',
        'trend',
      ]);
      for (const item of items) {
        expect(item.visible).toBe(true);
        expect(item.size).toBe(defaultSizeMap.get(item.id));
      }
    }
  });

  it('limita a recepción a citas y agenda (sin alertas ni expedientes)', () => {
    const items = estadisticasWidgetsForRole('recepcion');
    expect(items.map((i) => i.id)).toEqual(['kpi_citas', 'agenda']);
    for (const item of items) {
      expect(item.visible).toBe(true);
      expect(item.size).toBe(defaultSizeMap.get(item.id));
    }
  });

  it('devuelve lista vacía para UMECA', () => {
    expect(estadisticasWidgetsForRole('umeca')).toEqual([]);
  });
});
