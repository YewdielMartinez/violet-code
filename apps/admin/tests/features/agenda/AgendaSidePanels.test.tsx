import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

import { CitasPorConfirmarPanel, ListaUrgenciasPanel } from '@/features/agenda/AgendaSidePanels';

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

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function queryOk<T>(data: T) {
  return { data, isPending: false, isError: false, refetch: vi.fn() };
}

beforeEach(() => {
  mutateAsyncMock.mockReset().mockResolvedValue({ citaId: 'x', estado: 'confirmada', confirmadaEn: 'now' });
  useCambiarEstadoMock.mockReturnValue({ mutateAsync: mutateAsyncMock });
  toastMock.mockReset();
});
afterEach(cleanup);

describe('CitasPorConfirmarPanel', () => {
  it('lista las citas de mañana agendadas, con contador y teléfono', () => {
    useAgendaMock.mockReturnValue(
      queryOk([
        cita('b', 15),
        cita('a', 9),
        cita('conf', 10, { estado: 'confirmada' }),
        cita('hoy', 9, { programadaEn: new Date().toISOString() }),
      ]),
    );
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Persona a');
    expect(items[1].textContent).toContain('Persona b');
    expect(screen.getByLabelText('2 por confirmar')).toBeTruthy();
    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('tel:6671234567');
  });

  it('explica su propósito y muestra las acciones con texto, no solo íconos', () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9), cita('sin', 10, { celular: null })]));
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);

    expect(screen.getByText('Por confirmar · mañana')).toBeTruthy();
    expect(screen.getByText('Llama para confirmar asistencia')).toBeTruthy();
    expect(screen.getAllByText('Confirmar')).toHaveLength(2);
    expect(screen.getAllByText('Llamar')).toHaveLength(1);
    expect(screen.getByText('Sin celular')).toBeTruthy();
  });

  it('consulta solo agendadas de mañana para el área indicada', () => {
    useAgendaMock.mockReturnValue(queryOk([]));
    renderWithProviders(<CitasPorConfirmarPanel areaId={3} onOpenCita={vi.fn()} />);
    const query = useAgendaMock.mock.calls[0][0];
    expect(query.areaId).toBe(3);
    expect(query.estados).toEqual(['agendada']);
    expect(Date.parse(query.hasta) - Date.parse(query.desde)).toBeGreaterThanOrEqual(23 * 3600_000);
  });

  it('Confirmar llama a la mutación, muestra el check y avisa con toast', async () => {
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9)]));
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({ citaId: 'a', estado: 'confirmada' });
    expect(screen.getByRole('button', { name: /confirmada/i }).hasAttribute('disabled')).toBe(true);
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('confirmada'), { tone: 'success' }),
    );
  });

  it('revierte la UI y muestra error si la mutación falla', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('Sin permiso'));
    useAgendaMock.mockReturnValue(queryOk([cita('a', 9)]));
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Sin permiso', { tone: 'error' }));
    expect(screen.getByRole('button', { name: /Confirmar cita de Persona a/ }).hasAttribute('disabled')).toBe(false);
  });

  it('clic en la fila abre la cita con su elemento ancla', () => {
    const onOpenCita = vi.fn();
    const item = cita('a', 9);
    useAgendaMock.mockReturnValue(queryOk([item]));
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={onOpenCita} />);

    fireEvent.click(screen.getByRole('button', { name: /Abrir cita de Persona a/ }));
    expect(onOpenCita).toHaveBeenCalledWith(item, expect.any(HTMLElement));
  });

  it('muestra el estado vacío cuando todo está confirmado', () => {
    useAgendaMock.mockReturnValue(queryOk([]));
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);
    expect(screen.getByText('Todo confirmado para mañana')).toBeTruthy();
  });

  it('muestra carga y error', () => {
    useAgendaMock.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    const { unmount } = renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();
    unmount();

    useAgendaMock.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderWithProviders(<CitasPorConfirmarPanel onOpenCita={vi.fn()} />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
  });
});

describe('ListaUrgenciasPanel', () => {
  it('renderiza folio, nombre, área, enlace al expediente y teléfono', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1'), urgencia('2', { celular: null })]));
    renderWithProviders(<ListaUrgenciasPanel areaId={2} />);

    expect(useListaUrgenciasMock).toHaveBeenCalledWith(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('SM-1')).toBeTruthy();
    expect(screen.getAllByText('Trabajo social')).toHaveLength(2);
    const link = screen.getByRole('link', { name: /Abrir expediente SM-1/ });
    expect(link.getAttribute('href')).toBe('/expedientes/f-1');
    expect(screen.getByRole('link', { name: /Llamar a Urgente 1/ }).getAttribute('href')).toBe('tel:6679876543');
    expect(screen.getByLabelText('Sin celular registrado')).toBeTruthy();
    expect(screen.getByLabelText('2 personas en espera')).toBeTruthy();
  });

  it('explica su propósito y rotula la acción de llamar', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    renderWithProviders(<ListaUrgenciasPanel />);
    expect(screen.getByText('Lista de urgencias')).toBeTruthy();
    expect(
      screen.getByText('Personas con prioridad alta que pueden ocupar un espacio si alguien cancela'),
    ).toBeTruthy();
    expect(screen.getByText('Llamar')).toBeTruthy();
  });

  it('muestra estado vacío sin personas en espera', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([]));
    renderWithProviders(<ListaUrgenciasPanel />);
    expect(screen.getByText('Sin personas en espera')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('muestra carga y error con reintento', () => {
    useListaUrgenciasMock.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() });
    const { unmount } = renderWithProviders(<ListaUrgenciasPanel />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();
    unmount();

    useListaUrgenciasMock.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    renderWithProviders(<ListaUrgenciasPanel />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
  });

  it('se puede colapsar y expandir', () => {
    useListaUrgenciasMock.mockReturnValue(queryOk([urgencia('1')]));
    renderWithProviders(<ListaUrgenciasPanel />);
    const toggle = screen.getByRole('button', { name: /Lista de urgencias/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
