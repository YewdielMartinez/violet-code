import type { StaffRole } from '@/domain/models/Auth';

/** Qué áreas puede ver cada rol en la agenda (espejo de las reglas de `get_agenda`). */
export type AreaScope =
  | { kind: 'all' }
  | { kind: 'claves'; claves: readonly string[] }
  | { kind: 'own'; areaId: number | null };

/** Recepción gestiona las tres áreas (también Jurídico). */
export const RECEPCION_CLAVES = ['trabajo_social', 'psicologia', 'juridico'] as const;
const TRABAJO_SOCIAL_CLAVES = ['trabajo_social', 'psicologia'] as const;

export function areaScopeFor(role: StaffRole | undefined, areaId: number | null | undefined): AreaScope {
  switch (role) {
    case 'titular':
    case 'subdireccion':
      return { kind: 'all' };
    case 'recepcion':
      return { kind: 'claves', claves: RECEPCION_CLAVES };
    case 'trabajo_social':
      return { kind: 'claves', claves: TRABAJO_SOCIAL_CLAVES };
    default:
      return { kind: 'own', areaId: areaId ?? null };
  }
}
