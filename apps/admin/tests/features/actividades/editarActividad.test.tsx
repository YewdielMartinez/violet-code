import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act as reactAct, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActividadEdicionCambio } from '@/domain/models/ActividadEdicion';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { aIsoMazatlan, deIsoMazatlan } from '@/features/actividades/actividadesList';
import { act } from './fixtures';

const { actualizarMock } = vi.hoisted(() => ({ actualizarMock: vi.fn() }));

vi.mock('@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository', () => ({
  supabaseActividadPreventivaRepository: {
    list: vi.fn().mockResolvedValue([]),
    actualizar: actualizarMock,
  },
}));

import { actividadesQueryKey, useActualizarActividadPreventiva } from '@/features/actividades/api';
import { actividadAFormValue } from '@/features/actividades/useActividadForm';

const KEY_PENDIENTES = actividadesQueryKey({ estado: 'pendiente', limite: 200 });
const KEY_TODAS = actividadesQueryKey({ estado: null, limite: 200 });

const CAMBIO: ActividadEdicionCambio = {
  input: {
    actividadId: 'a1',
    actualizadoEn: '2026-11-20T00:00:00.000000+00:00',
    titulo: 'Editada',
    tipoActividadId: 2,
    tipoInstitucion: 'comunidad',
    sede: 'Parque',
    programadaEn: '2026-12-10T09:00:00-07:00',
    participantesIds: [],
  },
  vista: {
    tipoActividadClave: 'conferencia',
    tipoActividadNombre: 'Conferencia',
    asentamientoNombre: null,
    codigoPostal: null,
    municipio: null,
    participantes: [],
  },
};

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
  return { client, ...renderHook(() => useActualizarActividadPreventiva(), { wrapper }) };
}

const itemDe = (client: QueryClient, key: readonly unknown[], id: string) =>
  client.getQueryData<ActividadPreventivaItem[]>(key)?.find((a) => a.id === id);

describe('useActualizarActividadPreventiva', () => {
  beforeEach(() => {
    actualizarMock.mockReset();
  });

  it('refleja la edición en las listas en caché al instante (optimista), sin tocar las demás ni el catálogo', async () => {
    let resolver: (v: unknown) => void = () => {};
    actualizarMock.mockReturnValue(new Promise((res) => (resolver = res)));
    const { client, result } = setup();

    reactAct(() => {
      result.current.mutate(CAMBIO);
    });

    await waitFor(() => expect(itemDe(client, KEY_PENDIENTES, 'a1')?.titulo).toBe('Editada'));
    expect(itemDe(client, KEY_TODAS, 'a1')).toMatchObject({ titulo: 'Editada', tipoActividadNombre: 'Conferencia', estado: 'pendiente' });
    expect(itemDe(client, KEY_TODAS, 'a2')?.titulo).toBe('Actividad a2');
    expect(client.getQueryData(['actividades-preventivas', 'tipos'])).toEqual([{ id: 1, clave: 'taller', nombre: 'Taller' }]);

    resolver({ actividadId: 'a1', totalParticipantes: 0, actualizadoEn: '2026-12-03T18:00:00+00:00' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('manda la edición al repositorio con el bloqueo optimista', async () => {
    actualizarMock.mockResolvedValue({ actividadId: 'a1', totalParticipantes: 0, actualizadoEn: 'x' });
    const { result } = setup();

    reactAct(() => {
      result.current.mutate(CAMBIO);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(actualizarMock.mock.calls[0][0]).toEqual(CAMBIO.input);
  });

  it('si el servidor rechaza la edición, restaura las listas', async () => {
    let rechazar: (e: unknown) => void = () => {};
    actualizarMock.mockImplementation(() => new Promise((_res, rej) => (rechazar = rej)));
    const { client, result } = setup();

    reactAct(() => {
      result.current.mutateAsync(CAMBIO).catch(() => {});
    });
    await waitFor(() => expect(itemDe(client, KEY_PENDIENTES, 'a1')?.titulo).toBe('Editada'));
    await waitFor(() => expect(actualizarMock).toHaveBeenCalledTimes(1));

    rechazar({ code: '23505', message: 'Esta actividad fue modificada por otra persona. Recarga los datos.' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(itemDe(client, KEY_PENDIENTES, 'a1')?.titulo).toBe('Actividad a1');
    expect(itemDe(client, KEY_TODAS, 'a1')?.titulo).toBe('Actividad a1');
  });
});

describe('precarga del formulario de edición', () => {
  it('deIsoMazatlan es la inversa de aIsoMazatlan (hora de pared de Mazatlán)', () => {
    const iso = '2026-12-10T09:30:00-07:00';
    const fecha = deIsoMazatlan(iso);
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours(), fecha.getMinutes()]).toEqual([
      2026, 11, 10, 9, 30,
    ]);
    expect(aIsoMazatlan(fecha)).toBe(iso);
  });

  it('actividadAFormValue carga los valores actuales (nulos como texto vacío) y los participantes', () => {
    const value = actividadAFormValue(
      act('a1', '2026-12-04T17:00:00Z', {
        titulo: 'Taller',
        nivelEducativo: null,
        numeroAsistentes: 0,
        asentamientoId: 5,
        asentamientoNombre: 'Centro',
        codigoPostal: '81200',
        municipio: 'Ahome',
        participantes: [{ empleadoId: 'e1', nombre: 'Laura', rol: 'psicologia' }],
      }),
    );
    expect(value).toMatchObject({
      titulo: 'Taller',
      tipoActividadId: 1,
      tipoInstitucion: 'escuela',
      nivelEducativo: '',
      direccion: '',
      referencias: '',
      asistentes: '0',
      participantes: ['e1'],
      colonia: { id: 5, nombre: 'Centro', codigoPostal: '81200', municipio: 'Ahome' },
    });
    expect(actividadAFormValue(act('a2', '2026-12-04T17:00:00Z')).colonia).toBeNull();
  });
});
