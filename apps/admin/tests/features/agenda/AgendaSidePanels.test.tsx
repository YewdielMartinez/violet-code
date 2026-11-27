import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgendaItem, ListaUrgenciasItem } from '@/domain/models/Cita';

const { useAgendaMock, useListaUrgenciasMock, useCambiarEstadoMock, mutateAsyncMock, toastMock } = vi.hoisted(
  () => ({
    useAgendaMock: vi.fn(),
    useListaUrgenciasMock: vi.fn(),
    useCambiarEstadoMock: vi.fn(),
    mutateAsyncMock: vi.fn(),
    toastMock: vi.fn(),
  }),
);

vi.mock('@/features/agenda/api', () => ({
  useAgenda: useAgendaMock,
  useListaUrgencias: useListaUrgenciasMock,
  useCambiarEstadoCita: useCambiarEstadoMock,
}));

vi.mock('@yewdiel21/motion-kit/react', () => ({ toast: toastMock }));

import {
  PorConfirmarList,
  UrgenciasList,
  usePorConfirmar,
  useUrgencias,
} from '@/features/agenda/AgendaSidePanels';

function tomorrowAt(hour: number): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, 0).toISOString();
}

function cita(id: string, hour: number, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    citaId: id,
    programadaEn: tomorrowAt(hour),
    estado: 'agendada',
    prioridad: null,
    areaId: 1,
    areaClave: 'psicologia',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: `p-${id}`,
    nombreCompleto: `Persona ${id}`,
    celular: '6671234567',
    ...extra,
  };
}

function urgencia(id: string, extra: Partial<ListaUrgenciasItem> = {}): ListaUrgenciasItem {
  return {
    personaId: `p-${id}`,
    fichaId: `f-${id}`,
    folio: `SM-${id}`,
    nombreCompleto: `Urgente ${id}`,
    celular: '6679876543',
    areaUltimaPrioridad: 'trabajo_social',
    fechaUltimaPrioridad: '2026-11-20',
    ...extra,
  };
}

function queryOk<T>(data: T) {
  return { data, isPending: false, isError: false, refetch: vi.fn() };
}

function PorConfirmarHarness({
  areaId,
  onOpenCita = vi.fn(),
}: {
  areaId?: number | null;
  onOpenCita?: (c: AgendaItem, a: HTMLElement | null) => void;
}) {
  const state = usePorConfirmar(areaId);
  return (
    <MemoryRouter>
      <output data-testid="count">{state.count === undefined ? 'cargando' : state.count}</output>
      <PorConfirmarList state={state} onOpenCita={onOpenCita} />
    </MemoryRouter>
  );
}

function UrgenciasHarness({ areaId }: { areaId?: number | null }) {
  const state = useUrgencias(areaId);
  return (
    <MemoryRouter>
      <output data-testid="count">{state.count === undefined ? 'cargando' : state.count}</output>
      <UrgenciasList state={state} />
    </MemoryRouter>
  );
}

function renderUi(ui: ReactNode) {
  return render(<>{ui}</>);
}

beforeEach(() => {
  mutateAsyncMock.mockReset().mockResolvedValue({ citaId: 'x', estado: 'confirmada', confirmadaEn: 'now' });
  useCambiarEstadoMock.mockReturnValue({ mutateAsync: mutateAsyncMock });
  toastMock.mockReset();
});
afterEach(cleanup);

describe('usePorConfirmar + PorConfirmarList', () => {
  it('lista las citas de mañana agendadas por hora, con contador y teléfono', () => {
    useAgendaMock.mockReturnValue(
      queryOk([
        cita('b', 15),
        cita('a', 9),
        cita('conf', 10, { estado: 'confirmada' }),
        cita('hoy', 9, { programadaEn: new Date().toISOString() }),
      ]),
    );
    renderUi(<PorConfirmarHarness />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Persona a');
    expect(items[1].textContent).toContain('Persona b');
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('tel:6671234567');
  });

  it('muestra las acciones con texto, no solo íconos, y marca la UMECA', () => {
    useAgendaMock.mockReturnValue(
      queryOk([cita('a', 9), cita('sin', 10, { celular: null }), cita('u', 11, { origen: 'umeca' })]),
    );
    renderUi(<PorConfirmarHarness />);

    expect(screen.getAllByText('Confirmar')).toHaveLength(3);
    expect(screen.getAllByText('Llamar')).toHaveLength(2);
    expect(screen.getByText('Sin celular')).toBeTruthy();
    expect(screen.getByText(/UMECA · obligatoria/)).toBeTruthy();
  });

  it('consulta solo agendadas de mañana para el área indicada', () => {
    useAgendaMock.mockReturnValue(queryOk([]));
    renderUi(<PorConfirmarHarness areaId={3} />);
    const query = useAgendaMock.mock.calls[0][0];
    expect(query.areaId).toBe(3);
    expect(query.estados).toEqual(['agendada']);
    expect(Date.parse(query.hasta) - Date.parse(query.desde)).toBeGreaterThanOrEqual(23 * 3600_000);
  });

  it('Confirmar llama a la mutación, muestra el check, baja el contador y avisa con toast', async () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9), cita('b', 10)]));
    renderUi(<PorConfirmarHarness />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({ citaId: 'a', estado: 'confirmada' });
    expect(screen.getByRole('button', { name: /confirmada/i }).hasAttribute('disabled')).toBe(true);
    // Optimista: el contador ya no cuenta la cita recién confirmada.
    expect(screen.getByTestId('count').textContent).toBe('1');
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('confirmada'), { tone: 'success' }),
    );
  });

  it('revierte la UI y el contador, y muestra error, si la mutación falla', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('Sin permiso'));
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9)]));
    renderUi(<PorConfirmarHarness />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Sin permiso', { tone: 'error' }));
    expect(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('clic en la fila abre la cita con su elemento ancla', () => {
    const onOpenCita = vi.fn();
    const item = cita('a', 9);
    useAgendaMock.mockReturnValue(queryOk([item]));
    renderUi(<PorConfirmarHarness onOpenCita={onOpenCita} />);

    fireEvent.click(screen.getByRole('button', { name: /Abrir cita de Persona a/ }));
    expect(onOpenCita).toHaveBeenCalledWith(item, expect.any(HTMLElement));
  });

  it('las filas llevan su índice para la entrada escalonada', () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9), cita('b', 10)]));
    renderUi(<PorConfirmarHarness />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].style.getPropertyValue('--sp-i')).toBe('0');
    expect(items[1].style.getPropertyValue('--sp-i')).toBe('1');
  });

  it('muestra el estado vacío cuando todo está confirmado', () => {
    useAgendaMock.mockReturnValue(queryOk([]));
    renderUi(<PorConfirmarHarness />);
    expect(screen.getByText('Todo confirmado para mañana')).toBeTruthy();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('muestra carga (sin contador) y error con reintento', () => {
    useAgendaMock.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    const { unmount } = renderUi(<PorConfirmarHarness />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();
    expect(screen.getByTestId('count').textContent).toBe('cargando');
    unmount();

    const refetch = vi.fn();
    useAgendaMock.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    renderUi(<PorConfirmarHarness />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('useUrgencias + UrgenciasList', () => {
  it('renderiza folio, nombre, área, enlace al expediente y teléfono', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1'), urgencia('2', { celular: null })]));
    renderUi(<UrgenciasHarness areaId={2} />);

    expect(useListaUrgenciasMock).toHaveBeenCalledWith(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('SM-1')).toBeTruthy();
    expect(screen.getAllByText('Trabajo social')).toHaveLength(2);
    const link = screen.getByRole('link', { name: /Abrir expediente SM-1/ });
    expect(link.getAttribute('href')).toBe('/expedientes/f-1');
    expect(screen.getByRole('link', { name: /Llamar a Urgente 1/ }).getAttribute('href')).toBe('tel:6679876543');
    expect(screen.getByLabelText('Sin celular registrado')).toBeTruthy();
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('rotula la acción de llamar y la antigüedad de la prioridad', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    renderUi(<UrgenciasHarness />);
    expect(screen.getByText('Llamar')).toBeTruthy();
    expect(screen.getByText(/Desde/)).toBeTruthy();
  });

  it('muestra estado vacío sin personas en espera', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([]));
    renderUi(<UrgenciasHarness />);
    expect(screen.getByText('Sin personas en espera')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('muestra carga y error con reintento', () => {
    useListaUrgenciasMock.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    const { unmount } = renderUi(<UrgenciasHarness />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();
    unmount();

    useListaUrgenciasMock.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderUi(<UrgenciasHarness />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
  });
});
