import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BitacoraEvento, BitacoraFiltros } from '@/domain/models/Bitacora';

const { useBitacoraMock, useOpcionesMock, useAuthMock, exportarMock, descargarMock, toastMock } = vi.hoisted(() => ({
  useBitacoraMock: vi.fn(),
  useOpcionesMock: vi.fn(),
  useAuthMock: vi.fn(),
  exportarMock: vi.fn(),
  descargarMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/features/bitacora/api', () => ({
  useBitacora: useBitacoraMock,
  useBitacoraOpciones: useOpcionesMock,
  obtenerBitacoraParaExportar: exportarMock,
}));
vi.mock('@/features/bitacora/bitacoraExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/bitacora/bitacoraExport')>()),
  descargarBitacora: descargarMock,
}));
// Se evita el kit real (layout, GSAP): tabla, paginación y estados mínimos que respetan el contrato usado.
vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  const { useEffect, useRef } = await import('react');
  type Col = { key: string; label: string };
  type Row = Record<string, unknown>;
  return {
    ...real,
    toast: toastMock,
    Skeleton: ({ loading, label, children }: { loading: boolean; label: string; children: React.ReactNode }) =>
      loading ? <div role="status" aria-label={label} /> : <>{children}</>,
    EmptyState: ({
      title,
      actions,
      onAction,
    }: {
      title: string;
      actions?: { id: string; label: string }[];
      onAction?: (id: string) => void;
    }) => (
      <div>
        <p>{title}</p>
        {actions?.map((a) => (
          <button key={a.id} onClick={() => onAction?.(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
    ),
    Pagination: ({ totalPages, page, onChange }: { totalPages: number; page: number; onChange: (p: number) => void }) => (
      <div>
        <span>{`pág ${page}/${totalPages}`}</span>
        <button onClick={() => onChange(page + 1)}>siguiente</button>
      </div>
    ),
    DataTable: (props: { rows: Row[]; columns: Col[]; onRender?: (t: HTMLTableSectionElement) => void }) => {
      const tbody = useRef<HTMLTableSectionElement>(null);
      useEffect(() => {
        if (tbody.current) props.onRender?.(tbody.current);
      });
      return (
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
                    {String(row[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    },
  };
});

import BitacoraPage from '@/features/bitacora/BitacoraPage';

function evento(id: string, patch: Partial<BitacoraEvento> = {}): BitacoraEvento {
  return {
    id,
    creadoEn: '2026-11-27T20:32:05Z',
    actorTipo: 'empleado',
    actorNombre: 'Ana Titular',
    actorRol: 'titular',
    tabla: 'ficha_registro',
    accion: 'ver',
    registroId: 'abc-123',
    ...patch,
  };
}

function login(role: string | null) {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: role ? { id: 'u1', role, areaId: null, areaNombre: null } : null,
  });
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  useBitacoraMock.mockReturnValue({
    data: {
      eventos: [
        evento('e1'),
        evento('e2', { accion: 'crear', tabla: 'cita', actorNombre: 'Luis TS', actorRol: 'trabajo_social' }),
      ],
      total: 2,
    },
    isPending: false,
    isError: false,
    isSuccess: true,
    isPlaceholderData: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

function lastFilters(): BitacoraFiltros | null {
  const calls = useBitacoraMock.mock.calls;
  return calls[calls.length - 1][0] as BitacoraFiltros | null;
}

function lastPage(): number {
  const calls = useBitacoraMock.mock.calls;
  return calls[calls.length - 1][1] as number;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/bitacora']}>
      <BitacoraPage />
    </MemoryRouter>,
  );
}

const SIN_FILTROS = { tabla: null, accion: null, desde: null, hasta: null };

describe('BitacoraPage', () => {
  beforeEach(() => {
    login('titular');
    mockQuery();
    useOpcionesMock.mockReturnValue({
      data: { tablas: ['cita', 'ficha_registro'], acciones: ['ver', 'crear', 'actualizar', 'desactivar'] },
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('muestra los eventos, el total y la acción como cápsula (solo lectura, sin filas interactivas)', () => {
    const { container } = renderPage();
    expect(screen.getByRole('heading', { name: 'Bitácora' })).toBeTruthy();
    expect(screen.getByText('2 eventos')).toBeTruthy();
    expect(screen.getByText('Ana Titular')).toBeTruthy();
    expect(screen.getByText('Luis TS')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Fichas de registro')).toBeTruthy();
    expect(container.querySelectorAll('.vc-dt-pill')).toHaveLength(2);
    expect(container.querySelector('tbody tr[tabindex]')).toBeNull();
  });

  it('consulta sin filtros la primera página', () => {
    renderPage();
    expect(lastFilters()).toEqual(SIN_FILTROS);
    expect(lastPage()).toBe(1);
  });

  it('el filtro de fechas llega al servidor como rango del día completo y se limpia con «Limpiar filtros»', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Fechas' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    expect(lastFilters()?.desde).toBe(new Date('2026-11-01T00:00:00.000').toISOString());
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(lastFilters()).toEqual(SIN_FILTROS);
  });

  it('con un rango inválido no consulta y avisa', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Fechas' }));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-12-01' } });
    expect(lastFilters()).toBeNull();
    expect(screen.getByText('Rango de fechas no válido')).toBeTruthy();
  });

  it('con varias páginas muestra el paginador y pide la siguiente', () => {
    mockQuery({ data: { eventos: [evento('e1')], total: 60 } });
    renderPage();
    expect(screen.getByText('pág 1/3')).toBeTruthy();
    expect(screen.getByText(/página 1 de 3/)).toBeTruthy();
    fireEvent.click(screen.getByText('siguiente'));
    expect(lastPage()).toBe(2);
  });

  it('muestra el esqueleto mientras carga', () => {
    mockQuery({ data: undefined, isPending: true, isSuccess: false });
    renderPage();
    expect(screen.getByRole('status', { name: 'Cargando bitácora' })).toBeTruthy();
  });

  it('muestra el estado vacío sin eventos', () => {
    mockQuery({ data: { eventos: [], total: 0 } });
    renderPage();
    expect(screen.getByText('Aún no hay eventos en la bitácora')).toBeTruthy();
  });

  it('muestra el error con «Reintentar»', () => {
    const refetch = vi.fn();
    mockQuery({ data: undefined, isError: true, isSuccess: false, refetch });
    renderPage();
    expect(screen.getByText('No se pudo cargar la bitácora')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('redirige a roles sin bitacora.ver y no consulta', () => {
    login('trabajo_social');
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Bitácora' })).toBeNull();
    expect(useBitacoraMock.mock.calls[0][2]).toBe(false);
  });

  it('permite el acceso a subdirección', () => {
    login('subdireccion');
    renderPage();
    expect(screen.getByRole('heading', { name: 'Bitácora' })).toBeTruthy();
  });

  it('«Imprimir / PDF» junto a «Descargar» abre la impresión con los eventos y filtros', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    exportarMock.mockResolvedValue({ eventos: [evento('e1'), evento('e2')], total: 2, truncado: false });
    renderPage();
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir / PDF' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const root = document.getElementById('vc-print-root')!;
    expect(root.querySelector('h1')?.textContent).toBe('Bitácora de accesos y cambios');
    expect([...root.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      'Fecha y hora',
      'Quién',
      'Rol',
      'Tabla',
      'Acción',
      'Registro',
    ]);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.textContent).toContain('Todas las tablas');
    root.remove();
    print.mockRestore();
  });

  it('«Imprimir / PDF» se deshabilita sin eventos', () => {
    mockQuery({ data: { eventos: [], total: 0 } });
    renderPage();
    expect((screen.getByRole('button', { name: 'Imprimir / PDF' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
