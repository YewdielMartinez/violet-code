import { describe, expect, it } from 'vitest';
import { REPORTE_TIPOS } from '@/domain/models/Reporte';
import { areaEfectiva, puedeElegirArea, puedeVerInformes, reportesDisponibles } from '@/features/informes/informesPermisos';

describe('permisos de informes', () => {
  it.each(['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'] as const)('%s puede ver informes', (role) => {
    expect(puedeVerInformes(role)).toBe(true);
    expect(reportesDisponibles(role)).toEqual(REPORTE_TIPOS);
  });

  it.each(['recepcion', 'umeca', undefined, null] as const)('%s no puede ver informes ni reportes', (role) => {
    expect(puedeVerInformes(role)).toBe(false);
    expect(reportesDisponibles(role)).toEqual([]);
  });

  it('solo Dirección elige el área', () => {
    expect(puedeElegirArea('titular')).toBe(true);
    expect(puedeElegirArea('subdireccion')).toBe(true);
    for (const role of ['trabajo_social', 'psicologia', 'juridico', 'recepcion', 'umeca'] as const) {
      expect(puedeElegirArea(role)).toBe(false);
    }
  });
});

describe('areaEfectiva', () => {
  it('Dirección usa lo elegido (o todas)', () => {
    expect(areaEfectiva('titular', null, null)).toBeNull();
    expect(areaEfectiva('subdireccion', null, 2)).toBe(2);
  });

  it('las áreas de atención quedan fijas en la suya aunque se elija otra', () => {
    expect(areaEfectiva('psicologia', 2, 3)).toBe(2);
    expect(areaEfectiva('trabajo_social', 1, null)).toBe(1);
    expect(areaEfectiva('juridico', null, 3)).toBeNull();
  });
});
