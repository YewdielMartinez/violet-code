import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ActividadPreventivaFilters } from '@/domain/models/ActividadPreventiva';
import type { ActividadDialogProps } from '@/features/actividades/ActividadDialog';
import { act } from './fixtures';

const { dialogMock, navigateMock, useActividadesMock, useAuthMock } = vi.hoisted(() => ({
  dialogMock: vi.fn(),
  navigateMock: vi.fn(),
  useActividadesMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));
vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/actividades/api', () => ({ useActividadesPreventivas: useActividadesMock }));
vi.mock('@/features/actividades/ActividadDialog', () => ({
  ActividadDialog: (props: ActividadDialogProps) => {
    dialogMock(props);
    return null;
  },
}));

// El `DataTable` real del kit necesita layout (ResizeObserver, GSAP): se sustituye por una tabla mínima que respeta el
// contrato que usa la pantalla (`rows`, `columns`, `onRender`, `onClick`, `onKeyDown`, vacío).
vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  const { useEffect, useRef } = await import('react');
  type Col = { key: string; label: string; format?: (value: unknown, row: Record<string, unknown>) => string };
  type Row = Record<string, unknown>;
  return {
    ...real,
    Skeleton: ({ loading, label, children }: { loading: boolean; label: string; children: React.ReactNode }) =>
      loading ? <div role="status" aria-label={label} /> : <>{children}</>,
    DataTable: (props: {
      rows: Row[];
      columns: Col[];
      emptyTitle: string;
      emptyDescription: string;
      onRender?: (tbody: HTMLTableSectionElement) => void;
      onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
      onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    }) => {
      const tbody = useRef<HTMLTableSectionElement>(null);
      useEffect(() => {
        if (tbody.current) props.onRender?.(tbody.current);
      });
      return (
        <div onClick={props.onClick} onKeyDown={props.onKeyDown}>
          <table>
            <thead>
              <tr>
                {props.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody ref={tbody}>
              {props.rows.map((row) => (
                <tr key={String(row.id)} data-id={String(row.id)}>
                  {props.columns.map((c) => (
                    <td key={c.key} data-key={c.key}>
                      {c.format ? c.format(row[c.key], row) : String(row[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {props.rows.length === 0 ? (
            <div>
              <p>{props.emptyTitle}</p>
              <p>{props.emptyDescription}</p>
            </div>
          ) : null}
        </div>
      );
    },
  };
});

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
  act('venc', '2026-11-30T17:00:00Z', { titulo: 'Plática pendiente', sede: 'Casa de la Cultura' }),
  act('pas', '2026-11-20T17:00:00Z', {
    titulo: 'Conferencia',
    sede: 'Preparatoria 5',
    numeroAsistentes: 120,
    estado: 'realizada',
    realizadaEn: '2026-11-20T19:00:00Z',
  }),
  act('can', '2026-11-25T17:00:00Z', {
    titulo: 'Jornada comunitaria',
    sede: 'Parque Sinaloa',
    estado: 'cancelada',
    canceladaMotivo: 'Lluvia',
  }),
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

function renderPage() {
  return render(
    <MemoryRouter>
      <ActividadesPage />
    </MemoryRouter>,
  );
}

function fila(texto: RegExp | string): HTMLTableRowElement {
  const tr = screen.getAllByText(texto)[0].closest('tr');
  if (!tr) throw new Error('La coincidencia no está dentro de una fila');
  return tr;
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
    navigateMock.mockReset();
  });

  it('muestra el encabezado, la tabla y solo las pendientes (las vencidas primero)', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Actividades' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Estado/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Institución/ })).toBeTruthy();
    const ids = Array.from(document.querySelectorAll('tbody tr[data-id]')).map((tr) => tr.getAttribute('data-id'));
    expect(ids).toEqual(['venc', 'prim', 'emp']);
    expect(screen.queryByText('Conferencia')).toBeNull();
    expect(screen.queryByText('Jornada comunitaria')).toBeNull();
  });

  it('marca «Vencida» solo a la pendiente cuya fecha ya pasó, con las cápsulas de la tabla', () => {
    renderPage();

    const vencida = fila('Plática pendiente');
    expect(within(vencida).getByText('Vencida').closest('.vc-dt-pill--warning')).not.toBeNull();
    expect(within(vencida).getByText('Pendiente').closest('.vc-dt-pill--info')).not.toBeNull();

    const proxima = fila('Violencia en el noviazgo');
    expect(within(proxima).queryByText('Vencida')).toBeNull();
    expect(within(proxima).getByText('Escuela').closest('.vc-dt-pill')).not.toBeNull();
    expect(within(proxima).getByText('Centro, Ahome')).toBeTruthy();
  });

  it('el filtro de estado pide su estado al servidor y muestra solo ese estado', () => {
    renderPage();
    expect(lastFilters()).toMatchObject({ estado: 'pendiente', desde: null, hasta: null });

    fireEvent.click(screen.getByRole('menuitem', { name: /Realizadas/, hidden: true }));
    expect(lastFilters()).toMatchObject({ estado: 'realizada' });
    expect(within(fila('Conferencia')).getByText('Realizada').closest('.vc-dt-pill--success')).not.toBeNull();
    expect(within(fila('Conferencia')).getByText('120')).toBeTruthy();
    expect(screen.queryByText('Taller de prevención')).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: /Canceladas/, hidden: true }));
    expect(lastFilters()).toMatchObject({ estado: 'cancelada' });
    expect(within(fila('Jornada comunitaria')).getByText('Cancelada').closest('.vc-dt-pill--danger')).not.toBeNull();
    expect(screen.queryByText('Conferencia')).toBeNull();

    fireEvent.click(screen.getAllByRole('menuitem', { name: /^Todas/, hidden: true })[0]);
    expect(lastFilters()?.estado).toBeNull();
    expect(document.querySelectorAll('tbody tr[data-id]')).toHaveLength(5);
  });

  it('filtra por tipo de institución y limpia los filtros', () => {
    renderPage();

    fireEvent.click(screen.getByRole('menuitem', { name: /Empresa/, hidden: true }));
    expect(screen.getByText('Taller de prevención')).toBeTruthy();
    expect(screen.queryByText('Violencia en el noviazgo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Violencia en el noviazgo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
  });

  it('el rango de fechas se envía al servidor en hora de Mazatlán', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Desde', { selector: 'input' }), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Hasta', { selector: 'input' }), { target: { value: '2026-12-31' } });

    expect(lastFilters()).toMatchObject({
      estado: 'pendiente',
      desde: '2026-12-01T07:00:00.000Z',
      hasta: '2027-01-01T06:59:59.999Z',
    });
  });

  it('muestra un esqueleto mientras carga', () => {
    mockQuery({ data: undefined, isPending: true });
    renderPage();

    expect(screen.getByRole('status', { name: 'Cargando actividades' })).toBeTruthy();
    expect(screen.queryByText('Violencia en el noviazgo')).toBeNull();
  });

  it('muestra el error y reintenta', () => {
    const refetch = vi.fn();
    mockQuery({ data: undefined, isError: true, refetch });
    renderPage();

    expect(screen.getByText('No se pudieron cargar las actividades')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('sin actividades muestra el vacío de la tabla y «Nueva actividad» lleva al formulario', () => {
    mockQuery({ data: [] });
    renderPage();

    expect(screen.getByText('No hay actividades pendientes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }));
    expect(navigateMock).toHaveBeenCalledWith('/actividades/nuevo');
  });

  it('abre el detalle al hacer clic en una fila', () => {
    renderPage();
    fireEvent.click(within(fila('Taller de prevención')).getByText('Taller de prevención'));

    expect(lastDialogProps().state).toMatchObject({ kind: 'detalle', actividad: { id: 'emp' } });
    expect(lastDialogProps().anchor).toBeInstanceOf(HTMLElement);
  });

  it('abre el detalle con Enter sobre la fila', () => {
    renderPage();
    fireEvent.keyDown(fila('Plática pendiente'), { key: 'Enter' });

    expect(lastDialogProps().state).toMatchObject({ kind: 'detalle', actividad: { id: 'venc' } });
  });

  it.each(['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'])('%s ve «Nueva actividad»', (role) => {
    login(role);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }));
    expect(navigateMock).toHaveBeenCalledWith('/actividades/nuevo');
  });

  it('recepción ve la lista pero no «Nueva actividad» (ni en el estado vacío)', () => {
    login('recepcion');
    renderPage();
    expect(screen.queryByRole('button', { name: 'Nueva actividad' })).toBeNull();
    expect(screen.getByText('Violencia en el noviazgo')).toBeTruthy();

    cleanup();
    mockQuery({ data: [] });
    renderPage();
    expect(screen.getByText('No hay actividades pendientes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nueva actividad' })).toBeNull();
  });
});
