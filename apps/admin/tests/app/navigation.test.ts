import { describe, expect, it } from 'vitest';
import { canAccessPath, getNavigationForRole } from '@/app/navigation';

describe('navigation permissions by role', () => {
  it('restringe a UMECA únicamente a la ruta raíz /', () => {
    expect(getNavigationForRole('umeca').map((p) => p.path)).toEqual(['/']);
    expect(canAccessPath('umeca', '/')).toBe(true);
    expect(canAccessPath('umeca', '/expedientes')).toBe(false);
    expect(canAccessPath('umeca', '/directorio')).toBe(false);
    expect(canAccessPath('umeca', '/usuarios')).toBe(false);
  });

  it('limita a recepción a Dashboard, Agenda y Directorio', () => {
    expect(getNavigationForRole('recepcion').map((p) => p.path)).toEqual(['/', '/agenda', '/directorio']);
    expect(canAccessPath('recepcion', '/agenda')).toBe(true);
    expect(canAccessPath('recepcion', '/directorio')).toBe(true);
    expect(canAccessPath('recepcion', '/expedientes')).toBe(false);
    expect(canAccessPath('recepcion', '/solicitudes')).toBe(false);
    expect(canAccessPath('recepcion', '/usuarios')).toBe(false);
  });

  it('permite módulos operativos a áreas de atención y bloquea módulos de dirección', () => {
    for (const role of ['trabajo_social', 'psicologia', 'juridico'] as const) {
      expect(canAccessPath(role, '/expedientes')).toBe(true);
      expect(canAccessPath(role, '/solicitudes')).toBe(true);
      expect(canAccessPath(role, '/canalizaciones')).toBe(true);
      expect(canAccessPath(role, '/estadisticas')).toBe(false);
      expect(canAccessPath(role, '/usuarios')).toBe(false);
    }
  });

  it('permite todas las rutas del panel a titular y subdirección', () => {
    for (const role of ['titular', 'subdireccion'] as const) {
      expect(getNavigationForRole(role)).toHaveLength(9);
      expect(canAccessPath(role, '/estadisticas')).toBe(true);
      expect(canAccessPath(role, '/usuarios')).toBe(true);
    }
  });

  it('devuelve lista vacía y niega acceso si no hay rol', () => {
    expect(getNavigationForRole(undefined)).toEqual([]);
    expect(canAccessPath(undefined, '/')).toBe(false);
  });
});
