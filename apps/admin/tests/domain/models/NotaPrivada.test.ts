import { describe, expect, it } from 'vitest';
import {
  NOTA_PRIVADA_MAX_LENGTH,
  ordenarNotasRecientes,
  puedeGestionarNotasPrivadas,
  puedeVerNotasPrivadas,
  puedeVerNotasPsicologia,
  validateNotaPrivada,
  type NotaPrivada,
} from '@/domain/models/NotaPrivada';

describe('NotaPrivada (RF-10, RN-09, RN-18.1)', () => {
  it('exige contenido no vacío y respeta el máximo de nota_area', () => {
    expect(validateNotaPrivada('   ')).toMatch(/contenido/i);
    expect(validateNotaPrivada('x'.repeat(NOTA_PRIVADA_MAX_LENGTH + 1))).toMatch(/5000/);
    expect(validateNotaPrivada(`  ${'x'.repeat(NOTA_PRIVADA_MAX_LENGTH)}  `)).toBeNull();
    expect(validateNotaPrivada('Seguimiento del plan de seguridad')).toBeNull();
  });

  it('solo Trabajo Social y Jurídico gestionan notas en la pestaña; Psicología usa el Historial clínico', () => {
    expect(puedeGestionarNotasPrivadas('trabajo_social')).toBe(true);
    expect(puedeGestionarNotasPrivadas('psicologia')).toBe(false);
    expect(puedeGestionarNotasPrivadas('juridico')).toBe(true);
    expect(puedeGestionarNotasPrivadas('titular')).toBe(false);
    expect(puedeGestionarNotasPrivadas('subdireccion')).toBe(false);
    expect(puedeGestionarNotasPrivadas('recepcion')).toBe(false);
    expect(puedeGestionarNotasPrivadas('umeca')).toBe(false);
    expect(puedeGestionarNotasPrivadas(undefined)).toBe(false);
  });

  it('TS, Jurídico y Dirección ven la pestaña de notas; Psicología, recepción y UMECA no', () => {
    expect(puedeVerNotasPrivadas('trabajo_social')).toBe(true);
    expect(puedeVerNotasPrivadas('psicologia')).toBe(false);
    expect(puedeVerNotasPrivadas('juridico')).toBe(true);
    expect(puedeVerNotasPrivadas('titular')).toBe(true);
    expect(puedeVerNotasPrivadas('subdireccion')).toBe(true);
    expect(puedeVerNotasPrivadas('recepcion')).toBe(false);
    expect(puedeVerNotasPrivadas('umeca')).toBe(false);
    expect(puedeVerNotasPrivadas(undefined)).toBe(false);
  });

  it('las notas de Psicología son exclusivas del rol Psicología (ni Dirección ni otras áreas)', () => {
    expect(puedeVerNotasPsicologia('psicologia')).toBe(true);
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'juridico', 'recepcion', 'umeca'] as const) {
      expect(puedeVerNotasPsicologia(role)).toBe(false);
    }
    expect(puedeVerNotasPsicologia(undefined)).toBe(false);
  });

  it('ordena por la última edición, de la más reciente a la más antigua', () => {
    const base = { fichaId: 'f-1', areaId: 2, areaNombre: 'Psicología', contenido: 'Nota', creadoPor: null };
    const notas: NotaPrivada[] = [
      { ...base, id: 'a', creadoEn: '2026-11-01T10:00:00Z', actualizadoEn: '2026-11-01T10:00:00Z' },
      { ...base, id: 'b', creadoEn: '2026-10-01T10:00:00Z', actualizadoEn: '2026-11-20T10:00:00Z' },
      { ...base, id: 'c', creadoEn: '2026-11-10T10:00:00Z', actualizadoEn: '2026-11-10T10:00:00Z' },
    ];
    expect(ordenarNotasRecientes(notas).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
});
