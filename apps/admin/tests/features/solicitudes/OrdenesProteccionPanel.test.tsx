import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdenProteccion } from '@/domain/models/OrdenProteccion';

const { actualizarMock, desactivarMock, listarMock, toastMock, useAuthMock } = vi.hoisted(() => ({
  actualizarMock: vi.fn(),
  desactivarMock: vi.fn(),
  listarMock: vi.fn(),
  toastMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    toast: toastMock,
    Skeleton: ({ loading, children }: { loading: boolean; children: ReactNode }) =>
      loading ? <div role="status" /> : <>{children}</>,
    Dialog: {
      Root: ({ open, children }: { open: boolean; children: ReactNode }) =>
        open ? <div role="dialog">{children}</div> : null,
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
      Close: () => <button type="button">Cerrar</button>,
      Body: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  };
});

vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/expedientes/api', () => ({
  formatErrorEscrituraExpediente: (_err: unknown, fallback: string) => fallback,
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseOrdenProteccionRepository', () => ({
  supabaseOrdenProteccionRepository: {
    listarPorFicha: listarMock,
    actualizar: actualizarMock,
    desactivar: desactivarMock,
    crear: vi.fn(),
  },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseAgresorRepository', () => ({
  supabaseAgresorRepository: { listarPorFicha: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseDocumentoStorageRepository', () => ({
  supabaseDocumentoStorageRepository: {
    listarPorFicha: vi.fn().mockResolvedValue([]),
    listarTipos: vi.fn().mockResolvedValue([]),
    subir: vi.fn(),
    obtenerUrlFirmada: vi.fn(),
  },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository', () => ({
  supabaseSeguimientoRepository: { getLineaTiempo: vi.fn().mockResolvedValue([]), registrar: vi.fn() },
}));

import { OrdenesProteccionPanel } from '@/features/solicitudes/OrdenesProteccionPanel';
import { useActualizarOrdenProteccion } from '@/features/solicitudes/ordenesApi';

const ORDEN: OrdenProteccion = {
  id: 'ord-1',
  fichaId: 'ficha-1',
  agresorId: null,
  numeroOficio: 'OF-100',
  autoridadEmisora: 'Juzgado Primero',
  fechaEmision: '2026-11-20',
  fechaVigencia: null,
  estado: 'vigente',
  vigente: true,
  activo: true,
  creadoEn: '2026-11-20T10:00:00Z',
  actualizadoEn: '2026-11-21T10:00:00Z',
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPanel(client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <OrdenesProteccionPanel fichaId="ficha-1" />
    </QueryClientProvider>,
  );
}

describe('OrdenesProteccionPanel: botones y seguimiento', () => {
  beforeEach(() => {
    listarMock.mockReset().mockResolvedValue([ORDEN]);
    desactivarMock.mockReset().mockResolvedValue(undefined);
    actualizarMock.mockReset().mockResolvedValue(ORDEN);
    toastMock.mockReset();
    useAuthMock.mockReturnValue({ user: { role: 'trabajo_social' } });
  });

  afterEach(() => {
    cleanup();
  });

  it('usa las mismas clases de botón que los formularios y ningún botón lleva icono', async () => {
    renderPanel();
    const editar = await screen.findByRole('button', { name: 'Editar' });
    const archivar = screen.getByRole('button', { name: 'Archivar' });
    const nueva = screen.getByRole('button', { name: 'Nueva orden' });

    expect(editar.className).toBe('mk-button mk-button--tonal');
    expect(archivar.className).toBe('mk-button mk-button--tonal');
    expect(nueva.className).toBe('mk-button mk-button--primary');

    for (const boton of screen.getAllByRole('button')) {
      expect(boton.querySelector('.mk-icon')).toBeNull();
    }
  });

  it('archivar pide confirmación con el diseño de ArchivarExpedienteDialog y archiva al confirmar', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Archivar' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(desactivarMock).not.toHaveBeenCalled();

    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    const confirmar = screen.getByRole('button', { name: 'Sí, archivar' });
    expect(cancelar.className).toContain('mk-button--tonal');
    expect(confirmar.className).toContain('mk-button--filled');

    await act(async () => {
      fireEvent.click(confirmar);
    });

    await waitFor(() => {
      expect(desactivarMock).toHaveBeenCalledWith('ord-1', '2026-11-21T10:00:00Z');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('cancelar la confirmación no archiva la orden', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Archivar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(desactivarMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('guardar un cambio de estado invalida la línea de tiempo (Seguimiento) del expediente', async () => {
    const client = makeClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useActualizarOrdenProteccion('ficha-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'ord-1',
        input: {
          fichaId: 'ficha-1',
          numeroOficio: 'OF-100',
          autoridadEmisora: 'Juzgado Primero',
          fechaEmision: '2026-11-20',
          estado: 'vencida',
          notaCambioEstado: 'Venció el plazo',
        },
      });
    });

    expect(actualizarMock).toHaveBeenCalledWith(
      'ord-1',
      expect.objectContaining({ estado: 'vencida', notaCambioEstado: 'Venció el plazo' }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['seguimiento', 'linea-tiempo', 'ficha-1'],
    });
  });
});
