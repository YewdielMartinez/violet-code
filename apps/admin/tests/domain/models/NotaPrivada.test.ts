import { describe, expect, it } from 'vitest';
import {
  NOTA_PRIVADA_MAX_LENGTH,
  ordenarNotasRecientes,
  puedeGestionarNotasPrivadas,
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

  it('solo las áreas de atención gestionan notas; Dirección, recepción y UMECA no', () => {
    expect(puedeGestionarNotasPrivadas('trabajo_social')).toBe(true);
    expect(puedeGestionarNotasPrivadas('psicologia')).toBe(true);
    expect(puedeGestionarNotasPrivadas('juridico')).toBe(true);
    expect(puedeGestionarNotasPrivadas('titular')).toBe(false);
    expect(puedeGestionarNotasPrivadas('subdireccion')).toBe(false);
    expect(puedeGestionarNotasPrivadas('recepcion')).toBe(false);
    expect(puedeGestionarNotasPrivadas('umeca')).toBe(false);
    expect(puedeGestionarNotasPrivadas(undefined)).toBe(false);
  });

  it('ordena por la última edición, de la más reciente a la más antigua', () => {
    const base = { fichaId: 'f-1', areaId: 2, contenido: 'Nota', creadoPor: null };
    const notas: NotaPrivada[] = [
      { ...base, id: 'a', creadoEn: '2026-11-01T10:00:00Z', actualizadoEn: '2026-11-01T10:00:00Z' },
      { ...base, id: 'b', creadoEn: '2026-10-01T10:00:00Z', actualizadoEn: '2026-11-20T10:00:00Z' },
      { ...base, id: 'c', creadoEn: '2026-11-10T10:00:00Z', actualizadoEn: '2026-11-10T10:00:00Z' },
    ];
    expect(ordenarNotasRecientes(notas).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
});
