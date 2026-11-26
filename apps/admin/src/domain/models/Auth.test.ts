import { describe, expect, it } from 'vitest';
import { isAttentionRole, isSupervisor, ROLE_LABELS, type StaffRole } from './Auth';

const ALL_ROLES: StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
  'recepcion',
  'umeca',
];

describe('Auth domain helpers', () => {
  it('define etiquetas legibles para los 7 roles del sistema', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it('identifica correctamente a supervisión (titular y subdirección)', () => {
    expect(isSupervisor('titular')).toBe(true);
    expect(isSupervisor('subdireccion')).toBe(true);
    expect(isSupervisor('trabajo_social')).toBe(false);
    expect(isSupervisor('psicologia')).toBe(false);
    expect(isSupervisor('juridico')).toBe(false);
    expect(isSupervisor('recepcion')).toBe(false);
    expect(isSupervisor('umeca')).toBe(false);
    expect(isSupervisor(undefined)).toBe(false);
  });

  it('identifica correctamente a áreas de atención multidisciplinaria', () => {
    expect(isAttentionRole('trabajo_social')).toBe(true);
    expect(isAttentionRole('psicologia')).toBe(true);
    expect(isAttentionRole('juridico')).toBe(true);
    expect(isAttentionRole('titular')).toBe(false);
    expect(isAttentionRole('subdireccion')).toBe(false);
    expect(isAttentionRole('recepcion')).toBe(false);
    expect(isAttentionRole('umeca')).toBe(false);
    expect(isAttentionRole(undefined)).toBe(false);
  });
});
