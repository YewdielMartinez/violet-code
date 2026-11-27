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

  it('limita a recepción a Dashboard, Agenda, Actividades y Directorio', () => {
    expect(getNavigationForRole('recepcion').map((p) => p.path)).toEqual(['/', '/agenda', '/actividades', '/directorio']);
    expect(canAccessPath('recepcion', '/actividades')).toBe(true);
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
      expect(canAccessPath(role, '/intervenciones')).toBe(true);
      expect(canAccessPath(role, '/estadisticas')).toBe(false);
      expect(canAccessPath(role, '/usuarios')).toBe(false);
    }
  });

  it('permite todas las rutas del panel a titular y subdirección', () => {
    for (const role of ['titular', 'subdireccion'] as const) {
      expect(getNavigationForRole(role)).toHaveLength(8);
      expect(canAccessPath(role, '/estadisticas')).toBe(true);
      expect(canAccessPath(role, '/usuarios')).toBe(true);
    }
  });

  it('muestra Agenda y Actividades a los 6 roles del personal y las niega a UMECA', () => {
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico', 'recepcion'] as const) {
      const paths = getNavigationForRole(role).map((p) => p.path);
      expect(paths).toContain('/agenda');
      expect(paths).toContain('/actividades');
      expect(canAccessPath(role, '/actividades')).toBe(true);
    }
    expect(canAccessPath('umeca', '/actividades')).toBe(false);
    expect(canAccessPath('umeca', '/agenda')).toBe(false);
  });

  it('no incluye Intervenciones en el menú', () => {
    expect(getNavigationForRole('titular').map((p) => p.path)).not.toContain('/intervenciones');
  });

  it('devuelve lista vacía y niega acceso si no hay rol', () => {
    expect(getNavigationForRole(undefined)).toEqual([]);
    expect(canAccessPath(undefined, '/')).toBe(false);
  });
});
