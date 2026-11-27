import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgendaItem, AgendaQuery } from '@/domain/models/Cita';
import type { CitaDialogProps } from '@/features/agenda/CitaDialog';

const { dialogMock, useAgendaMock, useAuthMock } = vi.hoisted(() => ({
  dialogMock: vi.fn(),
  useAgendaMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/agenda/api', () => ({ useAgenda: useAgendaMock }));
vi.mock('@/features/agenda/CitaDialog', () => ({
  CitaDialog: (props: CitaDialogProps) => {
    dialogMock(props);
    return null;
  },
}));
vi.mock('@/features/agenda/AgendaAvisos', () => ({
  AgendaAvisos: () => <div data-testid="avisos" />,
}));
vi.mock('@/features/expedientes/api', () => ({
  catalogoQueryOptions: (name: string) => ({
    queryKey: ['catalogos', name],
    queryFn: async () => [
      { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
      { id: 2, clave: 'psicologia', nombre: 'Psicología' },
    ],
  }),
}));

import AgendaPage from '@/features/agenda/AgendaPage';

function cita(id: string, date: Date, extra: Partial<AgendaItem> = {}): AgendaItem {
  return {
    citaId: id,
    programadaEn: date.toISOString(),
    estado: 'agendada',
    prioridad: null,
    areaId: 2,
    areaClave: 'psicologia',
    recomendadaPor: null,
    reagendadaDe: null,
    origen: 'regular',
    personaId: `p-${id}`,
    nombreCompleto: `Persona ${id}`,
    celular: null,
    ...extra,
  };
}

const CITAS = [
  cita('a', new Date(2026, 10, 26, 9)),
  cita('b', new Date(2026, 10, 26, 11), { estado: 'confirmada' }),
  cita('c', new Date(2026, 10, 27, 10), { prioridad: 'alta' }),
];

function lastDialogProps(): CitaDialogProps {
  return dialogMock.mock.calls[dialogMock.mock.calls.length - 1][0] as CitaDialogProps;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AgendaPage />
    </QueryClientProvider>,
  );
}

describe('AgendaPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 26, 10) });
    useAuthMock.mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', role: 'recepcion', areaId: null, areaNombre: null },
    });
    // Imita el RPC: devuelve las citas del rango pedido; con la consulta deshabilitada no hay datos.
    useAgendaMock.mockImplementation((query: AgendaQuery, enabled = true) => {
      const data = enabled
        ? CITAS.filter((c) => c.programadaEn >= query.desde && c.programadaEn < query.hasta)
        : undefined;
      return { data, isPending: !data, isError: false, refetch: vi.fn() };
    });
  });

  afterEach(() => {
    cleanup();
    dialogMock.mockClear();
    vi.useRealTimers();
  });

  it('muestra el mes en curso, 42 recuadros y pide la cuadrícula en dos tramos', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Noviembre de 2026' })).toBeTruthy();
    expect(document.querySelectorAll('.ag-tile')).toHaveLength(42);
    const monthCalls = useAgendaMock.mock.calls.filter(([, enabled]) => enabled !== false);
    expect(monthCalls.length).toBeGreaterThanOrEqual(2);
    // Los avisos van en una barra compacta, no en una columna lateral permanente.
    expect(screen.getByTestId('avisos')).toBeTruthy();
    expect(document.querySelector('.ag-side')).toBeNull();
    // Hoy resaltado y citas con hora + nombre.
    expect(document.querySelector('.ag-tile[data-today]')?.getAttribute('data-day')).toBe('2026-11-26');
    expect(screen.getByRole('button', { name: /09:00, Persona a/ })).toBeTruthy();
  });

  it('no hay botón «Nueva cita» en el encabezado y el cambio de vista es solo de íconos', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Nueva cita' })).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Mes', 'Semana']);
    expect(tabs.every((tab) => !tab.textContent?.match(/Mes|Semana/))).toBe(true);
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeTruthy();
  });

  it('un recuadro con citas abre el diálogo en modo «dia» con las citas del día y el recuadro como ancla', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /26 de noviembre, 2 citas/ }));
    const props = lastDialogProps();
    expect(props.state?.kind).toBe('dia');
    if (props.state?.kind !== 'dia') throw new Error('estado inesperado');
    expect(props.state.citas.map((c) => c.citaId)).toEqual(['a', 'b']);
    expect(props.anchor).toBeInstanceOf(HTMLElement);
    expect((props.anchor as HTMLElement).dataset.day).toBe('2026-11-26');
  });

  it('un recuadro vacío abre el diálogo en modo «crear» con esa fecha', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /10 de noviembre, sin citas/ }));
    const props = lastDialogProps();
    expect(props.state?.kind).toBe('crear');
    if (props.state?.kind !== 'crear') throw new Error('estado inesperado');
    expect(props.state.fecha.getDate()).toBe(10);
    expect(props.state.fecha.getMonth()).toBe(10);
  });

  it('clic directo en una cita abre «detalle» sin abrir el día', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /11:00, Persona b/ }));
    const props = lastDialogProps();
    expect(props.state?.kind).toBe('detalle');
    if (props.state?.kind !== 'detalle') throw new Error('estado inesperado');
    expect(props.state.cita.citaId).toBe('b');
    expect(dialogMock.mock.calls.every(([p]) => (p as CitaDialogProps).state?.kind !== 'dia')).toBe(true);
  });

  it('navega al mes siguiente y vuelve con «Hoy»', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Diciembre de 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Noviembre de 2026' })).toBeTruthy();
  });

  it('en la vista semanal un hueco vacío abre «crear» con esa hora', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Semana' }));
    const week = screen.getByRole('group', { name: 'Semana por horas' });
    fireEvent.click(within(week).getByRole('button', { name: /Nueva cita, .*28 de noviembre, 14:00/ }));
    const props = lastDialogProps();
    expect(props.state?.kind).toBe('crear');
    if (props.state?.kind !== 'crear') throw new Error('estado inesperado');
    expect(props.state.fecha.getDate()).toBe(28);
    expect(props.state.fecha.getHours()).toBe(14);
  });

  it('marca con «UMECA» las citas de origen UMECA en el mes y en la semana', () => {
    useAgendaMock.mockImplementation((query: AgendaQuery, enabled = true) => {
      const data = enabled
        ? [cita('u', new Date(2026, 10, 26, 12), { origen: 'umeca' }), ...CITAS].filter(
            (c) => c.programadaEn >= query.desde && c.programadaEn < query.hasta,
          )
        : undefined;
      return { data, isPending: !data, isError: false, refetch: vi.fn() };
    });
    renderPage();
    const chip = screen.getByRole('button', { name: /12:00, Persona u.*UMECA · asistencia obligatoria/ });
    expect(chip.querySelector('.ag-chip__umeca')?.textContent).toBe('UMECA');
    expect(screen.getByRole('button', { name: /09:00, Persona a/ }).querySelector('.ag-chip__umeca')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Semana' }));
    const week = screen.getByRole('group', { name: 'Semana por horas' });
    expect(within(week).getByRole('button', { name: /12:00, Persona u.*UMECA/ }).querySelector('.ag-chip__umeca')).not.toBeNull();
  });

  describe.each(['titular', 'subdireccion', 'psicologia', 'juridico'] as const)('rol %s (con alta de citas)', (role) => {
    beforeEach(() => {
      useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'u1', role, areaId: 2, areaNombre: null } });
    });

    it('un recuadro vacío abre el formulario de alta y en la semana los huecos son botones «Nueva cita»', () => {
      renderPage();
      fireEvent.click(screen.getByRole('tab', { name: 'Semana' }));
      const week = screen.getByRole('group', { name: 'Semana por horas' });
      fireEvent.click(within(week).getByRole('button', { name: /Nueva cita, .*28 de noviembre, 14:00/ }));
      expect(lastDialogProps().state?.kind).toBe('crear');
    });
  });

  describe.each(['trabajo_social'] as const)('rol %s (sin alta de citas)', (role) => {
    beforeEach(() => {
      useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'u1', role, areaId: 2, areaNombre: null } });
    });

    it('un recuadro vacío abre la vista «dia» vacía, nunca el formulario de alta', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /10 de noviembre, sin citas/ }));
      const props = lastDialogProps();
      expect(props.state?.kind).toBe('dia');
      if (props.state?.kind !== 'dia') throw new Error('estado inesperado');
      expect(props.state.citas).toEqual([]);
    });

    it('en la semana los huecos vacíos no son botones ni abren «crear»', () => {
      renderPage();
      fireEvent.click(screen.getByRole('tab', { name: 'Semana' }));
      const week = screen.getByRole('group', { name: 'Semana por horas' });
      expect(within(week).queryAllByRole('button', { name: /Nueva cita/ })).toHaveLength(0);
      expect(week.querySelectorAll('.ag-slot--static').length).toBeGreaterThan(0);
      expect(dialogMock.mock.calls.every(([p]) => (p as CitaDialogProps).state?.kind !== 'crear')).toBe(true);
    });
  });
});
