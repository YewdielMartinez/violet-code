import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StaffRole } from '@/domain/models/Auth';
import { ROWS } from './fixtures';

const { useInformeMock, useDerivacionesMock, useAuthMock, downloadMock, toastMock } = vi.hoisted(() => ({
  useInformeMock: vi.fn(),
  useDerivacionesMock: vi.fn(),
  useAuthMock: vi.fn(),
  downloadMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/features/informes/api', () => ({ useInforme: useInformeMock }));
vi.mock('@/features/canalizaciones/api', () => ({ useDerivaciones: useDerivacionesMock }));
vi.mock('@/shared/auth/useAuth', () => ({ useAuth: useAuthMock }));
vi.mock('@/shared/export/download', () => ({ downloadBlob: downloadMock }));

// El kit necesita layout real (GSAP, ResizeObserver): se sustituyen las piezas visuales por equivalentes mínimos.
vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  type Col = { key: string; label: string };
  type Row = Record<string, unknown>;
  return {
    ...real,
    toast: toastMock,
    AnimatedNumber: ({ value, format }: { value: number; format?: (n: number) => string }) => (
      <span>{format ? format(value) : value}</span>
    ),
    Select: ({
      label,
      options,
      value,
      onChange,
    }: {
      label: string;
      options: { value: string; label: string }[];
      value: string;
      onChange: (v: string) => void;
    }) => (
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
    DataTable: ({ rows, columns, caption }: { rows: Row[]; columns: Col[]; caption: string }) => (
      <table aria-label={caption}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              {columns.map((c) => (
                <td key={c.key}>{String(r[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
});

import { InformesPanel } from '@/features/informes/InformesPanel';
import EstadisticasPage from '@/features/informes/EstadisticasPage';

const NOW = new Date(2026, 2, 15); // marzo de 2026

function asRole(role: StaffRole | null) {
  useAuthMock.mockReturnValue({ status: role ? 'authenticated' : 'anonymous', user: role ? { role } : null });
}

function result(overrides: Record<string, unknown> = {}) {
  return { data: ROWS, isPending: false, isError: false, refetch: vi.fn(), ...overrides };
}

beforeEach(() => {
  useInformeMock.mockReturnValue(result());
  useDerivacionesMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
  asRole('titular');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('InformesPanel por rol', () => {
  it.each(['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'] as const)(
    'se monta para %s',
    (role) => {
      asRole(role);
      render(<InformesPanel now={NOW} />);
      expect(screen.getByRole('region', { name: 'Informes' })).toBeTruthy();
      expect(useInformeMock).toHaveBeenLastCalledWith({ anio: 2026, mes: 3 }, true);
    },
  );

  it.each(['recepcion', 'umeca'] as const)('no se monta ni consulta para %s', (role) => {
    asRole(role);
    const { container } = render(<InformesPanel now={NOW} />);
    expect(container.textContent).toBe('');
    expect(useInformeMock).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  it('sin sesión no se monta', () => {
    asRole(null);
    const { container } = render(<InformesPanel now={NOW} />);
    expect(container.textContent).toBe('');
  });

  it('la página muestra el panel y canalizaciones a Dirección y un aviso a Recepción', () => {
    render(<EstadisticasPage />);
    expect(screen.getByRole('region', { name: 'Informes' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Canalizaciones' })).toBeTruthy();
    cleanup();
    asRole('recepcion');
    render(<EstadisticasPage />);
    expect(screen.queryByRole('region', { name: 'Informes' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Canalizaciones' })).toBeNull();
    expect(screen.getByText('Sin acceso a los informes')).toBeTruthy();
  });
});

describe('InformesPanel contenido', () => {
  it('muestra los KPI y la tabla con las columnas del informe', () => {
    render(<InformesPanel now={NOW} />);
    expect(screen.getByRole('group', { name: 'Atenciones: 16' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Primera vez: 7' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Seguimiento: 9' })).toBeTruthy();
    const table = screen.getByRole('table');
    for (const header of ['Área', 'Tipo de atención', 'Primera vez / Seguimiento', 'Mujeres', 'Hombres', 'Personas', 'Atenciones']) {
      expect(within(table).getByText(header)).toBeTruthy();
    }
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Marzo 2026')).toBeTruthy();
  });

  it('ofrece el año actual y los dos anteriores', () => {
    render(<InformesPanel now={NOW} />);
    const years = within(screen.getByLabelText('Año')).getAllByRole('option');
    expect(years.map((o) => o.textContent)).toEqual(['2026', '2025', '2024']);
  });

  it('muestra esqueleto mientras carga', () => {
    useInformeMock.mockReturnValue(result({ data: undefined, isPending: true }));
    render(<InformesPanel now={NOW} />);
    expect(screen.getByRole('status', { name: 'Cargando informe' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('muestra el error con reintento', () => {
    const refetch = vi.fn();
    useInformeMock.mockReturnValue(result({ data: undefined, isError: true, refetch }));
    render(<InformesPanel now={NOW} />);
    expect(screen.getByText('No se pudo cargar el informe')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('muestra el estado vacío y deshabilita la descarga sin filas', () => {
    useInformeMock.mockReturnValue(result({ data: [] }));
    render(<InformesPanel now={NOW} />);
    expect(screen.getByText('Sin atenciones en este periodo')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Descargar Excel' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('InformesPanel periodo', () => {
  it('Anual consulta con mes null y oculta el selector de mes; Mensual lo restablece', () => {
    render(<InformesPanel now={NOW} />);
    expect(screen.getByLabelText('Mes')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Anual' }));
    expect(useInformeMock).toHaveBeenLastCalledWith({ anio: 2026, mes: null }, true);
    expect(screen.queryByLabelText('Mes')).toBeNull();
    expect(screen.getByText('Año 2026')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Mensual' }));
    expect(useInformeMock).toHaveBeenLastCalledWith({ anio: 2026, mes: 3 }, true);
  });

  it('cambiar año y mes se refleja en la consulta', () => {
    render(<InformesPanel now={NOW} />);
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '11' } });
    expect(useInformeMock).toHaveBeenLastCalledWith({ anio: 2025, mes: 11 }, true);
    expect(screen.getByText('Noviembre 2025')).toBeTruthy();
  });
});

describe('InformesPanel descargas', () => {
  it('Excel mensual: no muestra CSV, genera nombre mensual, tipo xlsx y toast de éxito', () => {
    render(<InformesPanel now={NOW} />);
    expect(screen.queryByRole('button', { name: 'Descargar CSV' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    expect(downloadMock).toHaveBeenCalledOnce();
    const [blob, name] = downloadMock.mock.calls[0] as [Blob, string];
    expect(name).toBe('informe-2026-03.xlsx');
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(toastMock).toHaveBeenCalledWith('Se descargó informe-2026-03.xlsx.', { tone: 'success' });
  });

  it('Excel anual: nombre sin mes y tipo xlsx', () => {
    render(<InformesPanel now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Anual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    const [blob, name] = downloadMock.mock.calls[0] as [Blob, string];
    expect(name).toBe('informe-2026.xlsx');
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(toastMock).toHaveBeenCalledWith('Se descargó informe-2026.xlsx.', { tone: 'success' });
  });
});
