import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { updateEstadoMock, archiveMock, reopenMock } = vi.hoisted(() => ({
  updateEstadoMock: vi.fn().mockResolvedValue(undefined),
  archiveMock: vi.fn().mockResolvedValue(undefined),
  reopenMock: vi.fn().mockResolvedValue('abierto'),
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseDerivacionRepository', () => ({
  supabaseDerivacionRepository: { updateEstado: updateEstadoMock },
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseFichaRepository', () => ({
  supabaseFichaRepository: { archive: archiveMock, reopen: reopenMock },
}));

import { useUpdateEstadoDerivacion } from '@/features/canalizaciones/api';
import { useArchiveFicha, useReopenFicha } from '@/features/expedientes/api';
import { lineaTiempoQueryKey } from '@/features/seguimiento/api';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { spy, wrapper };
}

function invalidated(spy: ReturnType<typeof setup>['spy'], key: readonly unknown[]) {
  return spy.mock.calls.some(([filters]) => {
    const qk = filters?.queryKey as readonly unknown[] | undefined;
    return qk !== undefined && qk.every((part, i) => part === key[i]);
  });
}

describe('invalidación de la línea de tiempo', () => {
  it('cambiar el estado de una canalización invalida la línea de tiempo', async () => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useUpdateEstadoDerivacion(), { wrapper });
    result.current.mutate({ id: 'd1', estado: 'en_proceso' });
    await waitFor(() => expect(invalidated(spy, lineaTiempoQueryKey('ficha-1').slice(0, 2))).toBe(true));
  });

  it('archivar y reabrir un expediente invalidan su línea de tiempo', async () => {
    const { spy, wrapper } = setup();
    const archivar = renderHook(() => useArchiveFicha(), { wrapper });
    archivar.result.current.mutate({ fichaId: 'ficha-1', motivo: 'Caso concluido' });
    await waitFor(() => expect(invalidated(spy, lineaTiempoQueryKey('ficha-1'))).toBe(true));

    spy.mockClear();
    const reabrir = renderHook(() => useReopenFicha(), { wrapper });
    reabrir.result.current.mutate({ fichaId: 'ficha-1', motivo: 'Nueva agresión' });
    await waitFor(() => expect(invalidated(spy, lineaTiempoQueryKey('ficha-1'))).toBe(true));
  });
});
