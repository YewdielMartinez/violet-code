import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { miPerfilMock, logoutMock, navigateMock, toastMock } = vi.hoisted(() => ({
  miPerfilMock: vi.fn(),
  logoutMock: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    toast: toastMock,
  };
});

vi.mock('@/infrastructure/supabase/adapters/SupabaseAuthRepository', () => ({
  supabaseAuthRepository: {
    miPerfil: miPerfilMock,
  },
}));

vi.mock('@/shared/auth/session', () => ({
  logout: logoutMock,
}));

import PerfilPage from '@/features/perfil/PerfilPage';

function renderPerfilPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PerfilPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PerfilPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    miPerfilMock.mockReset();
    logoutMock.mockReset().mockResolvedValue(undefined);
    navigateMock.mockReset();
    toastMock.mockReset();
  });

  it('muestra nombre, correo, rol, área, estado activo y permisos agrupados', async () => {
    miPerfilMock.mockResolvedValue({
      id: 'u-1',
      email: 'ts@semujeres.gob.mx',
      displayName: 'María López',
      role: 'trabajo_social',
      areaId: 1,
      areaClave: 'trabajo_social',
      areaNombre: 'Trabajo Social',
      dependencia: null,
      activo: true,
      permisos: ['expediente.ver', 'expediente.escribir', 'agenda.ver'],
    });

    renderPerfilPage();

    expect(await screen.findByText('María López')).toBeTruthy();
    expect(screen.getByText('ts@semujeres.gob.mx')).toBeTruthy();
    expect(screen.getAllByText('Trabajo Social', { selector: 'dd' })).toHaveLength(2);
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(screen.getByText('Expedientes')).toBeTruthy();
    expect(screen.getByText('expediente.ver')).toBeTruthy();
    expect(screen.getByText('expediente.escribir')).toBeTruthy();
    expect(screen.getByText('Agenda')).toBeTruthy();
    expect(screen.getByText('agenda.ver')).toBeTruthy();
  });

  it('muestra dependencia UMECA y mensaje cuando no tiene permisos internos', async () => {
    miPerfilMock.mockResolvedValue({
      id: 'u-umeca',
      email: 'umeca@semujeres.gob.mx',
      displayName: 'Operador UMECA',
      role: 'umeca',
      areaId: null,
      areaClave: 'umeca',
      areaNombre: 'UMECA',
      dependencia: 'umeca',
      activo: true,
      permisos: [],
    });

    renderPerfilPage();

    expect(await screen.findByText('Operador UMECA')).toBeTruthy();
    expect(screen.getByText('UMECA (Externo)')).toBeTruthy();
    expect(screen.getByText(/no tiene permisos internos asignados/i)).toBeTruthy();
  });

  it('cierra sesión al pulsar el botón «Cerrar sesión»', async () => {
    miPerfilMock.mockResolvedValue({
      id: 'u-1',
      email: 'titular@semujeres.gob.mx',
      displayName: 'Titular',
      role: 'titular',
      areaId: null,
      areaClave: null,
      areaNombre: null,
      dependencia: null,
      activo: true,
      permisos: ['cuentas.gestionar'],
    });

    renderPerfilPage();

    const btn = await screen.findByRole('button', { name: /Cerrar sesión/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(toastMock).toHaveBeenCalledWith('Sesión cerrada', { tone: 'info' });
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});
