import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ActividadPreventivaFilters } from '@/domain/models/ActividadPreventiva';
import type { ActividadDialogProps } from '@/features/actividades/ActividadDialog';
import { act } from './fixtures';

const { dialogMock, useActividadesMock, useAuthMock } = vi.hoisted(() => ({
  dialogMock: vi.fn(),
  useActividadesMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/actividades/api', () => ({ useActividadesPreventivas: useActividadesMock }));
vi.mock('@/features/actividades/ActividadDialog', () => ({
  ActividadDialog: (props: ActividadDialogProps) => {
    dialogMock(props);
    return null;
  },
}));

import ActividadesPage from '@/features/actividades/ActividadesPage';

// Jueves 3 dic 2026, 10:00 en Mazatlán.
const AHORA = new Date('2026-12-03T17:00:00Z');

const DATA = [
  act('prim', '2026-12-04T17:00:00Z', {
    titulo: 'Violencia en el noviazgo',
    sede: 'Secundaria Técnica 12',
    asentamientoNombre: 'Centro',
    municipio: 'Ahome',
  }),
  act('emp', '2026-12-10T17:00:00Z', {
    titulo: 'Taller de prevención',
    sede: 'Ingenio Central',
    tipoInstitucion: 'empresa_privada',
  }),
  act('pas', '2026-11-20T17:00:00Z', { titulo: 'Conferencia', sede: 'Preparatoria 5', numeroAsistentes: 120 }),
];

function login(role: string | null) {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: role ? { id: 'u1', role, areaId: null, areaNombre: null } : null,
  });
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  useActividadesMock.mockReturnValue({
    data: DATA,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

function lastFilters(): ActividadPreventivaFilters | undefined {
  const calls = useActividadesMock.mock.calls;
  return calls[calls.length - 1][0] as ActividadPreventivaFilters | undefined;
}

function lastDialogProps(): ActividadDialogProps {
  return dialogMock.mock.calls[dialogMock.mock.calls.length - 1][0] as ActividadDialogProps;
}

describe('ActividadesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: AHORA });
    login('trabajo_social');
    mockQuery();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useActividadesMock.mockReset();
    dialogMock.mockReset();
  });

  it('muestra el encabezado, las pendientes agrupadas por día y oculta las ya realizadas', () => {
    render(<ActividadesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Actividades' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mañana' })).toBeTruthy();
    const cards = screen.getAllByRole('button', { name: /Secundaria Técnica 12|Ingenio Central/ });
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Violencia en el noviazgo')).toBeTruthy();
    expect(within(cards[0]).getByText('Centro, Ahome')).toBeTruthy();
    expect(within(cards[0]).getByText('Pendiente')).toBeTruthy();
    expect(screen.queryByText('Conferencia')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('2 actividades');
  });

  it('pide al servidor solo desde ahora en «Pendientes» y hasta ahora en «Realizadas»', () => {
    render(<ActividadesPage />);
    expect(lastFilters()).toMatchObject({ desde: AHORA.toISOString(), hasta: null });

    fireEvent.click(screen.getByRole('tab', { name: 'Realizadas' }));
    expect(lastFilters()).toMatchObject({ desde: null, hasta: AHORA.toISOString() });
    expect(screen.getByText('Conferencia')).toBeTruthy();
    expect(screen.getByText('Realizada')).toBeTruthy();
    expect(screen.queryByText('Taller de prevención')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Todas' }));
    expect(lastFilters()).toMatchObject({ desde: null, hasta: null });
    expect(screen.getAllByRole('button', { name: /Secundaria|Ingenio|Preparatoria/ })).toHaveLength(3);
  });

  it('filtra por institución o lugar y por tipo de institución, y limpia los filtros', () => {
    render(<ActividadesPage />);

    fireEvent.change(screen.getByLabelText('Buscar por institución o lugar'), { target: { value: 'ingenio' } });
    expect(screen.getAllByRole('button', { name: /Ingenio Central/ })).toHaveLength(1);
    expect(screen.queryByText('Violencia en el noviazgo')).toBeNull();

    fireEvent.change(screen.getByLabelText('Buscar por institución o lugar'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Escuela', pressed: false }));
    expect(screen.getByText('Violencia en el noviazgo')).toBeTruthy();
    expect(screen.queryByText('Taller de prevención')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Limpiar/ }));
    expect(screen.getByText('Taller de prevención')).toBeTruthy();
  });

  it('con filtros sin resultados ofrece limpiarlos', () => {
    render(<ActividadesPage />);
    fireEvent.change(screen.getByLabelText('Buscar por institución o lugar'), { target: { value: 'zzz' } });
    expect(screen.getByText('Sin actividades con estos filtros')).toBeTruthy();
  });

  it('un rango de fechas imposible no consulta el servidor y muestra el estado vacío', () => {
    render(<ActividadesPage />);
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-01' } });

    expect(useActividadesMock.mock.calls[useActividadesMock.mock.calls.length - 1][1]).toBe(false);
    expect(screen.getByText('Sin actividades con estos filtros')).toBeTruthy();
  });

  it('muestra un esqueleto mientras carga', () => {
    mockQuery({ data: undefined, isPending: true });
    render(<ActividadesPage />);

    expect(screen.getByRole('status', { name: 'Cargando actividades' })).toBeTruthy();
    expect(screen.queryByText('Violencia en el noviazgo')).toBeNull();
  });

  it('muestra el error y reintenta', () => {
    const refetch = vi.fn();
    mockQuery({ data: undefined, isError: true, refetch });
    render(<ActividadesPage />);

    expect(screen.getByText('No se pudieron cargar las actividades')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('muestra el estado vacío con la acción de crear cuando se tiene permiso', () => {
    mockQuery({ data: [] });
    render(<ActividadesPage />);

    expect(screen.getByText('No hay actividades pendientes')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Nueva actividad' })[0]);
    expect(lastDialogProps().state).toEqual({ kind: 'crear' });
  });

  it('abre el detalle al hacer clic en una tarjeta', () => {
    render(<ActividadesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ingenio Central/ }));

    expect(lastDialogProps().state).toMatchObject({ kind: 'detalle', actividad: { id: 'emp' } });
    expect(lastDialogProps().anchor).toBeInstanceOf(HTMLElement);
  });

  it.each(['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'])(
    '%s ve «Nueva actividad»',
    (role) => {
      login(role);
      render(<ActividadesPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }));
      expect(lastDialogProps().state).toEqual({ kind: 'crear' });
    },
  );

  it('recepción ve la lista pero no «Nueva actividad» (ni en el estado vacío)', () => {
    login('recepcion');
    render(<ActividadesPage />);
    expect(screen.queryByRole('button', { name: 'Nueva actividad' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Secundaria Técnica 12/ })).toHaveLength(1);

    cleanup();
    mockQuery({ data: [] });
    render(<ActividadesPage />);
    expect(screen.getByText('No hay actividades pendientes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nueva actividad' })).toBeNull();
  });
});
