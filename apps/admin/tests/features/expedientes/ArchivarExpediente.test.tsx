import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { archiveMock, reopenMock, toastMock } = vi.hoisted(() => ({
  archiveMock: vi.fn(),
  reopenMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    toast: toastMock,
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

vi.mock('@/infrastructure/supabase/adapters/SupabaseFichaRepository', () => ({
  supabaseFichaRepository: {
    archive: archiveMock,
    reopen: reopenMock,
  },
}));

import { ArchivarExpedienteDialog } from '@/features/expedientes/ArchivarExpedienteDialog';
import { useArchiveExpediente } from '@/features/expedientes/ficha/useArchiveExpediente';
import { useReopenExpediente } from '@/features/expedientes/ficha/useReopenExpediente';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('Archivado y reapertura de expedientes', () => {
  beforeEach(() => {
    archiveMock.mockReset();
    reopenMock.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('ArchivarExpedienteDialog no deja confirmar sin motivo y envía el motivo recortado', () => {
    const onConfirm = vi.fn();
    render(
      <ArchivarExpedienteDialog
        folio="SEM-2026-0008"
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sí, archivar' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/motivo/i);

    fireEvent.change(screen.getByPlaceholderText(/Usuaria concluyó/i), {
      target: { value: '  Usuaria concluyó proceso  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, archivar' }));

    expect(onConfirm).toHaveBeenCalledWith('Usuaria concluyó proceso');
  });

  it('useArchiveExpediente envía el motivo y traduce errores reales de la RPC', async () => {
    archiveMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useArchiveExpediente(), { wrapper: createWrapper() });

    let ok = false;
    await act(async () => {
      ok = await result.current.archive(
        { id: 'ficha-8', folio: 'SEM-2026-0008' },
        'Cierre administrativo',
      );
    });
    expect(ok).toBe(true);
    expect(archiveMock).toHaveBeenCalledWith('ficha-8', 'Cierre administrativo');
    expect(toastMock).toHaveBeenCalledWith('Expediente SEM-2026-0008 archivado.', {
      tone: 'success',
    });

    const casos: Array<[Record<string, string>, string]> = [
      [{ code: '42501', message: 'row-level security' }, 'No tienes permiso para archivar expedientes.'],
      [
        { code: '23514', message: 'No se puede archivar un expediente con citas futuras agendadas o confirmadas' },
        'No se puede archivar un expediente con citas futuras agendadas o confirmadas',
      ],
      [
        { code: '23514', message: 'No se puede archivar un expediente con alertas abiertas' },
        'No se puede archivar un expediente con alertas abiertas',
      ],
      [
        { code: '23514', message: 'El expediente ya se encuentra archivado o en un estado no archivable' },
        'El expediente ya se encuentra archivado o en un estado no archivable',
      ],
      [{ code: 'PGRST202', message: 'Could not find the function' }, 'El servidor no está actualizado; avisa a soporte.'],
    ];

    for (const [error, expected] of casos) {
      archiveMock.mockRejectedValueOnce(error);
      await act(async () => {
        ok = await result.current.archive({ id: 'ficha-8', folio: 'SEM-2026-0008' }, 'Motivo');
      });
      expect(ok).toBe(false);
      expect(toastMock).toHaveBeenLastCalledWith(expected, { tone: 'error' });
    }
  });

  it('useReopenExpediente muestra mensaje amigable en español ante PGRST202', async () => {
    reopenMock.mockRejectedValueOnce({
      code: 'PGRST202',
      message: 'Could not find the function public.reabrir_ficha(p_ficha_id, p_motivo) in the schema cache',
    });

    const { result } = renderHook(() => useReopenExpediente(), { wrapper: createWrapper() });

    let ok = true;
    await act(async () => {
      ok = await result.current.reopen({ id: 'ficha-8', folio: 'SEM-2026-0008' }, 'Reingreso');
    });

    expect(ok).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      'El servidor no está actualizado; avisa a soporte.',
      { tone: 'error' },
    );
  });
});
