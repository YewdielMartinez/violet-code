import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistorialClinico } from '@/domain/models/HistorialClinico';
import type { EstadoDictado } from '@/features/dictado-voz/useSpeechDictation';

const { useAuthMock, guardarMutateMock, dictadoStore } = vi.hoisted(() => {
  /** Estado del dictado simulado: el panel se suscribe como a un hook real y se repinta al cambiar. */
  let valor: unknown = null;
  const oyentes = new Set<() => void>();
  return {
    useAuthMock: vi.fn(),
    guardarMutateMock: vi.fn(),
    dictadoStore: {
      get: () => valor,
      set(nuevo: unknown) {
        valor = nuevo;
        oyentes.forEach((oyente) => oyente());
      },
      subscribe(oyente: () => void) {
        oyentes.add(oyente);
        return () => oyentes.delete(oyente);
      },
    },
  };
});

vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/expedientes/api', () => ({
  useHistorialClinico: () => ({ data: HISTORIAL, isLoading: false, isError: false, refetch: vi.fn() }),
  useGuardarHistorialClinico: () => ({ mutateAsync: guardarMutateMock, isPending: false }),
  handleExpedienteMutationError: vi.fn(),
}));
vi.mock('@/features/intervenciones/api', () => ({
  useNotasPrivadas: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCrearNotaPrivada: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useActualizarNotaPrivada: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchivarNotaPrivada: () => ({ mutateAsync: vi.fn(), isPending: false }),
  traducirErrorIntervencion: (_err: unknown, fallback: string) => fallback,
}));
vi.mock('@/features/expedientes/historialClinicoApi', () => ({
  useHistorialClinicoVersiones: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/features/dictado-voz/useSpeechDictation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/dictado-voz/useSpeechDictation')>()),
  useSpeechDictation: () => useSyncExternalStore(dictadoStore.subscribe, dictadoStore.get),
}));

import { HistorialClinicoPanel } from '@/features/expedientes/HistorialClinicoPanel';

const HISTORIAL: HistorialClinico = {
  id: 'hc-1',
  fichaId: 'ficha-1',
  motivoConsulta: 'Motivo sintético',
  antecedentesPersonales: null,
  antecedentesFamiliares: 'Antecedente sintético',
  tieneAtencionPsicologicaPrevia: false,
  observacionesIniciales: null,
  creadoEn: '2026-11-27T09:00:00Z',
  actualizadoEn: '2026-11-27T09:00:00Z',
};

const descartar = vi.fn();

function dictadoEn(estado: EstadoDictado) {
  const activo = estado.tipo !== 'inactivo' && estado.tipo !== 'error';
  act(() =>
    dictadoStore.set({ estado, disponible: true, activo, iniciar: vi.fn(), detener: vi.fn(), descartar }),
  );
}

function renderPanel(role: string) {
  useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'u', role, areaId: 2, areaNombre: 'Psicología' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <HistorialClinicoPanel fichaId="ficha-1" estado="abierto" />
    </QueryClientProvider>
  );
  return render(tree());
}

describe('HistorialClinicoPanel con dictado por voz', () => {
  beforeEach(() => {
    // VoiceDots (motion-kit) observa su visibilidad; jsdom no trae IntersectionObserver.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    descartar.mockReset();
    guardarMutateMock.mockReset();
    dictadoEn({ tipo: 'inactivo' });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('muestra el dictado y el aviso RF-12.1 solo al editar como Psicología', () => {
    renderPanel('psicologia');
    expect(screen.queryByRole('region', { name: 'Dictado por voz' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('region', { name: 'Dictado por voz' })).toBeTruthy();
    expect(screen.getByText('No dictes CURP ni nombres propios.')).toBeTruthy();
    expect(screen.getByLabelText('Motivo de consulta').getAttribute('spellcheck')).toBe('false');
  });

  it('Dirección no ve el dictado porque no puede editar', () => {
    renderPanel('titular');
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Dictado por voz' })).toBeNull();
  });

  it('anexa la transcripción revisada al campo elegido sin borrar lo escrito', async () => {
    renderPanel('psicologia');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dictar en Antecedentes familiares' }));

    dictadoEn({ tipo: 'revision', texto: 'Texto sintético dictado.' });
    expect(screen.getByText(/Revisa la transcripción antes de añadirla a «Antecedentes familiares»/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Añadir al campo/ }));

    expect((screen.getByLabelText('Antecedentes familiares') as HTMLTextAreaElement).value).toBe(
      'Antecedente sintético\n\nTexto sintético dictado.',
    );
    expect((screen.getByLabelText('Motivo de consulta') as HTMLTextAreaElement).value).toBe('Motivo sintético');
    expect(descartar).toHaveBeenCalled();

    dictadoEn({ tipo: 'inactivo' });
    guardarMutateMock.mockResolvedValue({ ...HISTORIAL, antecedentesFamiliares: 'x' });
    fireEvent.click(screen.getByRole('button', { name: /Guardar historial/ }));
    await waitFor(() => expect(guardarMutateMock).toHaveBeenCalledTimes(1));
    expect(guardarMutateMock.mock.calls[0][0]).toMatchObject({
      antecedentesFamiliares: 'Antecedente sintético\n\nTexto sintético dictado.',
      actualizadoEn: '2026-11-27T09:00:00Z',
    });
  });

  it('no deja guardar mientras hay un dictado en curso', () => {
    renderPanel('psicologia');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    dictadoEn({ tipo: 'transcribiendo' });
    expect((screen.getByRole('button', { name: /Guardar historial/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
