import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistorialClinico, HistorialClinicoVersion } from '@/domain/models/HistorialClinico';
import type { NotaPrivada } from '@/domain/models/NotaPrivada';

const {
  useAuthMock,
  useHistorialMock,
  useVersionesMock,
  guardarMutateMock,
  toastMock,
  useNotasMock,
  crearNotaMock,
} = vi.hoisted(() => ({
  useNotasMock: vi.fn(),
  crearNotaMock: vi.fn(),
  useAuthMock: vi.fn(),
  useHistorialMock: vi.fn(),
  useVersionesMock: vi.fn(),
  guardarMutateMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));

vi.mock('@/features/expedientes/api', () => ({
  useHistorialClinico: useHistorialMock,
  useGuardarHistorialClinico: () => ({ mutateAsync: guardarMutateMock, isPending: false }),
  handleExpedienteMutationError: vi.fn(),
}));

vi.mock('@/features/intervenciones/api', () => ({
  useNotasPrivadas: useNotasMock,
  useCrearNotaPrivada: () => ({ mutateAsync: crearNotaMock, isPending: false }),
  useActualizarNotaPrivada: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchivarNotaPrivada: () => ({ mutateAsync: vi.fn(), isPending: false }),
  traducirErrorIntervencion: (_err: unknown, fallback: string) => fallback,
}));

vi.mock('@/features/expedientes/historialClinicoApi', () => ({
  useHistorialClinicoVersiones: useVersionesMock,
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return { ...actual, toast: toastMock };
});

import { HistorialClinicoPanel } from '@/features/expedientes/HistorialClinicoPanel';

const HISTORIAL: HistorialClinico = {
  id: 'hc-1',
  fichaId: 'ficha-1',
  motivoConsulta: 'Ansiedad por situación familiar',
  antecedentesPersonales: null,
  antecedentesFamiliares: 'Red materna',
  tieneAtencionPsicologicaPrevia: false,
  observacionesIniciales: null,
  creadoEn: '2026-11-27T09:00:00Z',
  actualizadoEn: '2026-11-27T09:00:00Z',
};

function version(partial: Partial<HistorialClinicoVersion>): HistorialClinicoVersion {
  return {
    id: 'ver-1',
    historialClinicoId: 'hc-1',
    fichaId: 'ficha-1',
    version: 1,
    motivoConsulta: 'Ansiedad',
    antecedentesPersonales: null,
    antecedentesFamiliares: 'Red materna',
    tieneAtencionPsicologicaPrevia: false,
    observacionesIniciales: null,
    camposModificados: ['motivoConsulta', 'antecedentesFamiliares'],
    creadoPor: 'emp-1',
    creadoPorNombre: 'Psicóloga Uno',
    creadoEn: '2026-11-27T09:00:00Z',
    ...partial,
  };
}

const VERSIONES = [
  version({
    id: 'ver-2',
    version: 2,
    motivoConsulta: 'Ansiedad por situación familiar',
    camposModificados: ['motivoConsulta'],
    creadoEn: '2026-11-27T11:00:00Z',
  }),
  version({}),
];

const NOTA_PSICOLOGIA: NotaPrivada = {
  id: 'nota-1',
  fichaId: 'ficha-1',
  areaId: 2,
  areaNombre: 'Psicología',
  contenido: 'Reforzar estrategias de contención',
  creadoEn: '2026-11-27T10:00:00Z',
  actualizadoEn: '2026-11-27T10:00:00Z',
  creadoPor: 'emp-1',
};

function renderPanel(role: string, estado: 'abierto' | 'archivado' = 'abierto') {
  useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'u', role, areaId: 2, areaNombre: 'Psicología' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HistorialClinicoPanel fichaId="ficha-1" estado={estado} />
    </QueryClientProvider>,
  );
}

describe('HistorialClinicoPanel', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    guardarMutateMock.mockReset();
    toastMock.mockReset();
    useHistorialMock.mockReset().mockReturnValue({
      data: HISTORIAL,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    crearNotaMock.mockReset();
    useNotasMock.mockReset().mockReturnValue({
      data: [NOTA_PSICOLOGIA],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useVersionesMock.mockReset().mockReturnValue({
      data: VERSIONES,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('muestra el botón Editar solo a Psicología', () => {
    const { unmount } = renderPanel('psicologia');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    unmount();

    for (const role of ['titular', 'subdireccion']) {
      const view = renderPanel(role);
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Registrar historial clínico/ })).toBeNull();
      expect(
        screen.getByText('Solo Psicología puede registrar o editar el historial clínico.'),
      ).toBeTruthy();
      expect(screen.getAllByText('Ansiedad por situación familiar').length).toBeGreaterThan(0);
      view.unmount();
    }
  });

  it('Psicología no ve acciones de escritura en un expediente archivado', () => {
    renderPanel('psicologia', 'archivado');
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('ofrece registrar el historial cuando aún no existe', () => {
    useHistorialMock.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() });
    renderPanel('psicologia');
    expect(screen.getByRole('button', { name: 'Registrar historial clínico' })).toBeTruthy();
    expect(screen.queryByText('Historial de cambios')).toBeNull();
  });

  it('abre el formulario, guarda y vuelve a la vista con el aviso «Guardado»', async () => {
    guardarMutateMock.mockResolvedValue({ ...HISTORIAL, motivoConsulta: 'Ansiedad severa' });
    renderPanel('psicologia');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const motivo = screen.getByLabelText('Motivo de consulta') as HTMLTextAreaElement;
    expect(motivo.value).toBe('Ansiedad por situación familiar');

    fireEvent.change(motivo, { target: { value: 'Ansiedad severa' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar historial/ }));

    await waitFor(() => expect(guardarMutateMock).toHaveBeenCalledTimes(1));
    expect(guardarMutateMock.mock.calls[0][0]).toMatchObject({
      fichaId: 'ficha-1',
      actualizadoEn: '2026-11-27T09:00:00Z',
      motivoConsulta: 'Ansiedad severa',
    });
    await waitFor(() => expect(screen.queryByLabelText('Motivo de consulta')).toBeNull(), { timeout: 3000 });
    expect(await screen.findByText('Guardado')).toBeTruthy();
  });

  it('sin cambios no llama al servidor', async () => {
    renderPanel('psicologia');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar historial/ }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('No hay cambios por guardar.'));
    expect(guardarMutateMock).not.toHaveBeenCalled();
  });

  it('lista las versiones con autor y expande el diff de la versión', () => {
    renderPanel('titular');
    expect(screen.getByText('Historial de cambios')).toBeTruthy();
    expect(screen.getByText('Versión 2')).toBeTruthy();
    expect(screen.getByText('Registro inicial')).toBeTruthy();
    expect(screen.getAllByText(/Psicóloga Uno/).length).toBe(2);

    const [verCambios] = screen.getAllByRole('button', { name: 'Ver cambios' });
    expect(verCambios.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(verCambios);
    expect(verCambios.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Antes')).toBeTruthy();
    expect(screen.getByText('Después')).toBeTruthy();
  });

  describe('notas privadas de Psicología', () => {
    it('Psicología las ve dentro del historial clínico y puede agregar una', async () => {
      crearNotaMock.mockResolvedValue({ ...NOTA_PSICOLOGIA, id: 'nota-2' });
      renderPanel('psicologia');

      expect(screen.getByRole('region', { name: 'Notas privadas' })).toBeTruthy();
      expect(screen.getByText('Reforzar estrategias de contención')).toBeTruthy();
      expect(useNotasMock).toHaveBeenCalledWith('ficha-1', true);

      fireEvent.click(screen.getByRole('button', { name: 'Agregar nota' }));
      fireEvent.change(screen.getByLabelText('Nueva nota'), { target: { value: 'Sesión de seguimiento' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar nota/ }));

      await waitFor(() => expect(crearNotaMock).toHaveBeenCalledTimes(1));
      expect(crearNotaMock.mock.calls[0][0]).toEqual({
        fichaId: 'ficha-1',
        areaId: 2,
        contenido: 'Sesión de seguimiento',
      });
    });

    it('Psicología ve las notas aunque el historial aún no exista', () => {
      useHistorialMock.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() });
      renderPanel('psicologia');
      expect(screen.getByText('Reforzar estrategias de contención')).toBeTruthy();
    });

    it('Titular y Subdirección no ven nada de las notas de Psicología (ni se consultan)', () => {
      for (const role of ['titular', 'subdireccion']) {
        useNotasMock.mockClear();
        const view = renderPanel(role);
        expect(screen.queryByRole('region', { name: 'Notas privadas' })).toBeNull();
        expect(screen.queryByText('Notas privadas')).toBeNull();
        expect(screen.queryByText('Reforzar estrategias de contención')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Agregar nota' })).toBeNull();
        for (const call of useNotasMock.mock.calls) expect(call[1]).toBe(false);
        view.unmount();
      }
    });
  });
});
