import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { useAuthMock, refreshSessionMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  refreshSessionMock: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/shared/auth/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/shared/auth/session', () => ({
  refreshSession: refreshSessionMock,
}));

import { RequireAuth } from '@/app/RequireAuth';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useAuthMock.mockReset();
  refreshSessionMock.mockClear();
});

function renderGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla Login</p>} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <p>Contenido protegido</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth guard', () => {
  it('redirige a /login cuando la sesión es anónima', () => {
    useAuthMock.mockReturnValue({ status: 'anonymous', user: null });

    renderGuard('/expedientes');

    expect(screen.getByText('Pantalla Login')).toBeTruthy();
  });

  it('bloquea rutas no permitidas para recepción y UMECA', () => {
    useAuthMock.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'u-1',
        email: 'recepcion@demo.violetcode.local',
        displayName: 'Recepción',
        role: 'recepcion',
        areaId: null,
        areaClave: null,
        areaNombre: null,
        activo: true,
      },
    });

    renderGuard('/expedientes');

    expect(screen.getByText('Acceso restringido')).toBeTruthy();
    expect(screen.queryByText('Contenido protegido')).toBeNull();
  });

  it('permite el acceso a módulos autorizados para el rol', () => {
    useAuthMock.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'u-2',
        email: 'titular@demo.violetcode.local',
        displayName: 'Titular',
        role: 'titular',
        areaId: null,
        areaClave: null,
        areaNombre: null,
        activo: true,
      },
    });

    renderGuard('/auditoria');

    expect(screen.getByText('Contenido protegido')).toBeTruthy();
  });
});
