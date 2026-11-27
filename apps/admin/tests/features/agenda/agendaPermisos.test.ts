import { describe, expect, it } from 'vitest';
import type { StaffRole } from '@/domain/models/Auth';
import { areasCreablesPorRol, puedeCrearCita, puedeCrearEnArea } from '@/features/agenda/agendaPermisos';
import { areaScopeFor } from '@/features/agenda/agendaScope';

const TODAS = ['trabajo_social', 'psicologia', 'juridico'];
const SIN_ALTA: readonly StaffRole[] = ['trabajo_social', 'umeca'];

describe('areasCreablesPorRol', () => {
  it('Recepción agenda en Trabajo Social, Psicología y Jurídico', () => {
    expect(areasCreablesPorRol('recepcion')).toEqual(TODAS);
  });

  it('Jurídico agenda solo en Jurídico y Psicología solo en Psicología', () => {
    expect(areasCreablesPorRol('juridico')).toEqual(['juridico']);
    expect(areasCreablesPorRol('psicologia')).toEqual(['psicologia']);
  });

  it('Dirección y Subdirección agendan en todas las áreas', () => {
    expect(areasCreablesPorRol('titular')).toEqual(TODAS);
    expect(areasCreablesPorRol('subdireccion')).toEqual(TODAS);
  });

  it.each(SIN_ALTA)('%s no agenda en ningún área', (rol) => {
    expect(areasCreablesPorRol(rol)).toEqual([]);
  });

  it('sin rol no hay áreas', () => {
    expect(areasCreablesPorRol(undefined)).toEqual([]);
  });
});

describe('puedeCrearCita', () => {
  it('Recepción, Jurídico, Psicología y Dirección sí; Trabajo Social y UMECA no', () => {
    for (const rol of ['recepcion', 'juridico', 'psicologia', 'titular', 'subdireccion'] as const) {
      expect(puedeCrearCita(rol)).toBe(true);
    }
    for (const rol of SIN_ALTA) expect(puedeCrearCita(rol)).toBe(false);
    expect(puedeCrearCita(undefined)).toBe(false);
  });
});

describe('puedeCrearEnArea', () => {
  it('respeta el área de cada rol', () => {
    expect(puedeCrearEnArea('recepcion', 'psicologia')).toBe(true);
    expect(puedeCrearEnArea('recepcion', 'juridico')).toBe(true);
    expect(puedeCrearEnArea('recepcion', 'otra')).toBe(false);
    expect(puedeCrearEnArea('juridico', 'juridico')).toBe(true);
    expect(puedeCrearEnArea('juridico', 'psicologia')).toBe(false);
    expect(puedeCrearEnArea('psicologia', 'psicologia')).toBe(true);
    expect(puedeCrearEnArea('psicologia', 'juridico')).toBe(false);
    expect(puedeCrearEnArea('titular', 'juridico')).toBe(true);
    expect(puedeCrearEnArea('subdireccion', 'trabajo_social')).toBe(true);
    expect(puedeCrearEnArea('trabajo_social', 'trabajo_social')).toBe(false);
  });
});

describe('areaScopeFor (qué áreas ve cada rol)', () => {
  it('Recepción ve Trabajo Social, Psicología y Jurídico', () => {
    expect(areaScopeFor('recepcion', null)).toEqual({
      kind: 'claves',
      claves: ['trabajo_social', 'psicologia', 'juridico'],
    });
  });

  it('Trabajo Social conserva Trabajo Social y Psicología', () => {
    expect(areaScopeFor('trabajo_social', 1)).toEqual({ kind: 'claves', claves: ['trabajo_social', 'psicologia'] });
  });

  it('Dirección ve todo y Jurídico/Psicología solo su área', () => {
    expect(areaScopeFor('titular', null)).toEqual({ kind: 'all' });
    expect(areaScopeFor('subdireccion', null)).toEqual({ kind: 'all' });
    expect(areaScopeFor('juridico', 3)).toEqual({ kind: 'own', areaId: 3 });
    expect(areaScopeFor('psicologia', 2)).toEqual({ kind: 'own', areaId: 2 });
  });
});
