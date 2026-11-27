import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act as reactAct, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { act } from './fixtures';

const { actualizarEstadoMock } = vi.hoisted(() => ({ actualizarEstadoMock: vi.fn() }));

vi.mock('@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository', () => ({
  supabaseActividadPreventivaRepository: {
    list: vi.fn().mockResolvedValue([]),
    actualizarEstado: actualizarEstadoMock,
  },
}));

import { actividadesQueryKey, useCambiarEstadoActividad } from '@/features/actividades/api';

const KEY_PENDIENTES = actividadesQueryKey({ estado: 'pendiente', limite: 200 });
const KEY_TODAS = actividadesQueryKey({ estado: null, limite: 200 });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const base = [act('a1', '2026-12-04T17:00:00Z'), act('a2', '2026-12-05T17:00:00Z')];
  client.setQueryData(KEY_PENDIENTES, base);
  client.setQueryData(KEY_TODAS, base);
  // El catálogo comparte prefijo de clave y no debe tocarse.
  client.setQueryData(['actividades-preventivas', 'tipos'], [{ id: 1, clave: 'taller', nombre: 'Taller' }]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useCambiarEstadoActividad(), { wrapper }) };
}

const estadoDe = (client: QueryClient, key: readonly unknown[], id: string) =>
  client.getQueryData<ActividadPreventivaItem[]>(key)?.find((a) => a.id === id)?.estado;

describe('useCambiarEstadoActividad', () => {
  beforeEach(() => actualizarEstadoMock.mockReset());

  it('actualiza las listas en caché al instante (optimista), sin tocar las demás ni el catálogo', async () => {
    let resolver: (v: unknown) => void = () => {};
    actualizarEstadoMock.mockReturnValue(new Promise((res) => (resolver = res)));
    const { client, result } = setup();

    reactAct(() => {
      result.current.mutate({ actividadId: 'a1', estado: 'realizada', numeroAsistentes: 30 });
    });

    await waitFor(() => expect(estadoDe(client, KEY_PENDIENTES, 'a1')).toBe('realizada'));
    expect(estadoDe(client, KEY_TODAS, 'a1')).toBe('realizada');
    expect(estadoDe(client, KEY_TODAS, 'a2')).toBe('pendiente');
    expect(client.getQueryData<ActividadPreventivaItem[]>(KEY_TODAS)?.[0]).toMatchObject({ numeroAsistentes: 30 });
    expect(client.getQueryData(['actividades-preventivas', 'tipos'])).toEqual([{ id: 1, clave: 'taller', nombre: 'Taller' }]);

    resolver({ actividadId: 'a1', estado: 'realizada', realizadaEn: '2026-12-03T18:00:00Z' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('manda el cambio de estado al repositorio', async () => {
    actualizarEstadoMock.mockResolvedValue({ actividadId: 'a2', estado: 'pendiente', realizadaEn: null });
    const { result } = setup();

    reactAct(() => {
      result.current.mutate({ actividadId: 'a2', estado: 'pendiente' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(actualizarEstadoMock.mock.calls[0][0]).toEqual({ actividadId: 'a2', estado: 'pendiente' });
  });
});
