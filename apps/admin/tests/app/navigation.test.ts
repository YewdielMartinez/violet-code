import { describe, expect, it } from 'vitest';
import { MOBILE_NAV_MAX, NAVIGATION, canAccessPath, getMobilePaths, getNavigationForRole } from '@/app/navigation';

describe('navigation permissions by role', () => {
  it('restringe a UMECA únicamente a la ruta raíz /', () => {
    expect(getNavigationForRole('umeca').map((p) => p.path)).toEqual(['/']);
    expect(canAccessPath('umeca', '/')).toBe(true);
    expect(canAccessPath('umeca', '/expedientes')).toBe(false);
    expect(canAccessPath('umeca', '/directorio')).toBe(false);
    expect(canAccessPath('umeca', '/usuarios')).toBe(false);
  });

  it('limita a recepción a Tablero, Agenda, Actividades y Estadísticas en el menú (Directorio solo por ruta)', () => {
    expect(getNavigationForRole('recepcion').map((p) => p.path)).toEqual([
      '/',
      '/agenda',
      '/actividades',
      '/estadisticas',
    ]);
    expect(canAccessPath('recepcion', '/actividades')).toBe(true);
    expect(canAccessPath('recepcion', '/agenda')).toBe(true);
    expect(canAccessPath('recepcion', '/estadisticas')).toBe(true);
    expect(canAccessPath('recepcion', '/directorio')).toBe(true);
    expect(canAccessPath('recepcion', '/expedientes')).toBe(false);
    expect(canAccessPath('recepcion', '/solicitudes')).toBe(false);
    expect(canAccessPath('recepcion', '/usuarios')).toBe(false);
  });

  it('permite módulos operativos y estadísticas a áreas de atención y bloquea usuarios', () => {
    for (const role of ['trabajo_social', 'psicologia', 'juridico'] as const) {
      expect(canAccessPath(role, '/expedientes')).toBe(true);
      expect(canAccessPath(role, '/solicitudes')).toBe(true);
      expect(canAccessPath(role, '/intervenciones')).toBe(true);
      expect(canAccessPath(role, '/estadisticas')).toBe(true);
      expect(canAccessPath(role, '/usuarios')).toBe(false);
    }
  });

  it('permite todas las rutas del panel a titular y subdirección', () => {
    for (const role of ['titular', 'subdireccion'] as const) {
      expect(getNavigationForRole(role)).toHaveLength(7);
      expect(canAccessPath(role, '/estadisticas')).toBe(true);
      expect(canAccessPath(role, '/usuarios')).toBe(true);
    }
    expect(NAVIGATION.find((p) => p.path === '/estadisticas')?.ready).toBe(true);
  });

  it('excluye Estadísticas de UMECA', () => {
    expect(getNavigationForRole('umeca').map((p) => p.path)).not.toContain('/estadisticas');
    expect(canAccessPath('umeca', '/estadisticas')).toBe(false);
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

describe('barra móvil calculada por rol', () => {
  const paths = (role: Parameters<typeof getMobilePaths>[0]) => [...getMobilePaths(role)].sort();

  it('las áreas de atención y la dirección llevan Tablero, Agenda, Expedientes, Solicitudes y Actividades', () => {
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'] as const) {
      expect(paths(role)).toEqual(['/', '/agenda', '/actividades', '/expedientes', '/solicitudes'].sort());
    }
  });

  it('recepción lleva todo lo que puede ver (Tablero, Agenda y Actividades) y UMECA solo el Tablero', () => {
    expect(paths('recepcion')).toEqual(['/', '/actividades', '/agenda'].sort());
    expect(paths('umeca')).toEqual(['/']);
  });

  it('nunca pasa de 5 botones ni incluye páginas a las que el rol no accede', () => {
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico', 'recepcion', 'umeca'] as const) {
      const mobile = getMobilePaths(role);
      expect(mobile.size).toBeLessThanOrEqual(MOBILE_NAV_MAX);
      const allowed = getNavigationForRole(role).map((p) => p.path);
      for (const path of mobile) expect(allowed).toContain(path);
    }
    expect(getMobilePaths(undefined).size).toBe(0);
  });

  it('Actividades aparece en la barra móvil de todo el personal', () => {
    for (const role of ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico', 'recepcion'] as const) {
      expect(getMobilePaths(role).has('/actividades')).toBe(true);
    }
  });
});
