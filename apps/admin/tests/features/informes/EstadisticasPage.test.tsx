import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StaffRole } from '@/domain/models/Auth';
import type { ReporteRow, ReporteTipo } from '@/domain/models/Reporte';

const { useReporteMock, useAreasMock, useAuthMock, downloadMock, toastMock } = vi.hoisted(() => ({
  useReporteMock: vi.fn(),
  useAreasMock: vi.fn(),
  useAuthMock: vi.fn(),
  downloadMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/features/informes/api', () => ({ useReporte: useReporteMock, useAreas: useAreasMock }));
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
    Chart: ({ label, labels, series }: { label: string; labels: string[]; series: { name: string; values: number[] }[] }) => (
      <div role="img" aria-label={label} data-labels={labels.join('|')} data-series={series.map((s) => s.name).join('|')} />
    ),
    Select: ({
      label,
      options,
      value,
      onChange,
      disabled,
    }: {
      label: string;
      options: { value: string; label: string }[];
      value: string;
      onChange: (v: string) => void;
      disabled?: boolean;
    }) => (
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
    DataTable: ({ rows, columns, caption }: { rows: Row[]; columns: Col[]; caption: string }) => (
      <table aria-label={caption} data-testid="reporte-table">
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

import EstadisticasPage from '@/features/informes/EstadisticasPage';

const NOW = new Date(2026, 2, 15); // marzo de 2026

function row(tipo: ReporteTipo, over: Partial<ReporteRow>): ReporteRow {
  return {
    tipo,
    mes: null,
    areaId: 2,
    area: 'Psicología',
    categoria: null,
    estado: null,
    total: 1,
    personas: null,
    mujeres: null,
    hombres: null,
    metrica: null,
    ...over,
  };
}

const SERIE: ReporteRow[] = [
  row('atenciones', { mes: '2026-02-01', categoria: 'Terapia', estado: 'primera_vez', total: 6, personas: 5, mujeres: 5 }),
  row('atenciones', { mes: '2026-03-01', categoria: 'Terapia', estado: 'primera_vez', total: 5, personas: 4, mujeres: 4 }),
  row('atenciones', { mes: '2026-03-01', categoria: 'Terapia', estado: 'seguimiento', total: 9, personas: 4, mujeres: 3, hombres: 1 }),
  row('atenciones', { mes: '2026-03-01', areaId: 3, area: 'Jurídico', categoria: 'Asesoría', estado: 'primera_vez', total: 2, personas: 2, mujeres: 2 }),
];
const TOTAL = row('atenciones', { areaId: null, area: null, total: 16, personas: 8, mujeres: 7, hombres: 1, metrica: 7 });
const PREVIO = row('atenciones', { areaId: null, area: null, total: 10, personas: 8, mujeres: 6, hombres: 2, metrica: 6 });

const REPORTE_ROWS: Record<Exclude<ReporteTipo, 'atenciones'>, ReporteRow[]> = {
  citas: [row('citas', { estado: 'asistio', total: 3 }), row('citas', { estado: 'no_asistio', total: 1 })],
  canalizaciones: [row('canalizaciones', { areaId: 1, area: 'Trabajo Social', categoria: 'juridico', estado: 'concluida', total: 2, metrica: 4 })],
  ordenes_proteccion: [row('ordenes_proteccion', { areaId: 3, area: 'Jurídico', estado: 'vigente', total: 4 })],
  actividades: [row('actividades', { areaId: null, area: null, categoria: 'comunidad', estado: 'realizada', total: 2, metrica: 70 })],
  alertas: [row('alertas', { areaId: null, area: null, categoria: 'telefono', estado: 'atendida', total: 2, metrica: 20 })],
};

const AREAS = [
  { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
  { id: 2, clave: 'psicologia', nombre: 'Psicología' },
  { id: 3, clave: 'juridico', nombre: 'Jurídico' },
];

interface Filters {
  tipo: ReporteTipo;
  desde: string;
  hasta: string;
  areaId?: number | null;
  agrupar?: string;
}

function datos(filters: Filters): ReporteRow[] {
  if (filters.tipo === 'atenciones') {
    if (filters.agrupar === 'mes') return SERIE;
    if (filters.agrupar === 'total') return [filters.hasta < '2026-03-01' ? PREVIO : TOTAL];
    return SERIE.filter((r) => r.mes === '2026-03-01');
  }
  return REPORTE_ROWS[filters.tipo];
}

const refetch = vi.fn();

function asRole(role: StaffRole | null, area: { areaId: number | null; areaNombre: string | null } = { areaId: null, areaNombre: null }) {
  useAuthMock.mockReturnValue({
    status: role ? 'authenticated' : 'anonymous',
    user: role ? { role, ...area } : null,
  });
}

function lastCall(predicate: (filters: Filters) => boolean) {
  const calls = useReporteMock.mock.calls.filter(([filters]) => predicate(filters as Filters));
  return calls[calls.length - 1] as [Filters, boolean] | undefined;
}

async function leerBlob(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await blob.arrayBuffer());
}

beforeEach(() => {
  useReporteMock.mockImplementation((filters: Filters, enabled = true) => ({
    data: enabled ? datos(filters) : undefined,
    isPending: false,
    isError: false,
    refetch,
  }));
  useAreasMock.mockReturnValue({ data: AREAS });
  asRole('titular');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Estadísticas por rol', () => {
  it.each(['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'] as const)('se monta para %s', (role) => {
    asRole(role, { areaId: 2, areaNombre: 'Psicología' });
    render(<EstadisticasPage now={NOW} />);
    expect(screen.getByRole('region', { name: 'Estadísticas' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Estadísticas' })).toBeTruthy();
  });

  it.each(['recepcion', 'umeca'] as const)('no se monta ni consulta para %s', (role) => {
    asRole(role);
    const { container } = render(<EstadisticasPage now={NOW} />);
    expect(container.textContent).toBe('');
    expect(useReporteMock).not.toHaveBeenCalled();
    expect(useAreasMock).toHaveBeenLastCalledWith(false);
  });

  it('sin sesión no se monta', () => {
    asRole(null);
    const { container } = render(<EstadisticasPage now={NOW} />);
    expect(container.textContent).toBe('');
  });
});

describe('Estadísticas: filtro de área por rol', () => {
  it('Dirección elige entre «Todas las áreas» y cada área, y consulta con la elegida', () => {
    render(<EstadisticasPage now={NOW} />);
    const select = screen.getByLabelText('Área') as HTMLSelectElement;
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todas las áreas',
      'Trabajo Social',
      'Psicología',
      'Jurídico',
    ]);
    expect(select.disabled).toBe(false);
    expect(lastCall((f) => f.agrupar === 'total')?.[0].areaId).toBeNull();

    fireEvent.change(select, { target: { value: '3' } });
    expect(lastCall((f) => f.agrupar === 'total')?.[0].areaId).toBe(3);
    expect(screen.getByText(/Marzo 2026 · Jurídico/)).toBeTruthy();
  });

  it.each([
    ['trabajo_social', 1, 'Trabajo Social'],
    ['psicologia', 2, 'Psicología'],
    ['juridico', 3, 'Jurídico'],
  ] as const)('%s queda fija en su área, sin selector', (role, areaId, nombre) => {
    asRole(role, { areaId, areaNombre: nombre });
    render(<EstadisticasPage now={NOW} />);
    expect(screen.queryByLabelText('Área')).toBeNull();
    expect(screen.getByLabelText(`Área: ${nombre}`)).toBeTruthy();
    for (const agrupar of ['mes', 'total']) {
      expect(lastCall((f) => f.agrupar === agrupar)?.[0].areaId).toBe(areaId);
    }
    expect(useAreasMock).toHaveBeenLastCalledWith(false);
  });

  it('las áreas de atención no ven la gráfica por área; Dirección sin área sí', () => {
    const { unmount } = render(<EstadisticasPage now={NOW} />);
    expect(screen.getByRole('region', { name: 'Atenciones por área' })).toBeTruthy();
    unmount();

    asRole('psicologia', { areaId: 2, areaNombre: 'Psicología' });
    render(<EstadisticasPage now={NOW} />);
    expect(screen.queryByRole('region', { name: 'Atenciones por área' })).toBeNull();
  });
});

describe('Estadísticas: resumen', () => {
  it('muestra los KPI con variación contra el periodo anterior', () => {
    render(<EstadisticasPage now={NOW} />);
    expect(screen.getByRole('group', { name: 'Atenciones: 16, 60 % más que el periodo anterior (10)' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Personas atendidas: 8, igual que el periodo anterior' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Primera vez: 7, 17 % más que el periodo anterior (6)' })).toBeTruthy();
    expect(screen.getByText('+60 % vs. periodo anterior')).toBeTruthy();
  });

  it('consulta tendencia mensual (12 meses), total del periodo y total del periodo anterior', () => {
    render(<EstadisticasPage now={NOW} />);
    expect(lastCall((f) => f.agrupar === 'mes')?.[0]).toMatchObject({ tipo: 'atenciones', desde: '2025-04-01', hasta: '2026-03-31' });
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2026-03-01')?.[0]).toMatchObject({ hasta: '2026-03-31' });
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2026-02-01')?.[0]).toMatchObject({ hasta: '2026-02-28' });
  });

  it('dibuja las gráficas en español, con la paleta y los nombres accesibles', () => {
    render(<EstadisticasPage now={NOW} />);
    const tendencia = screen.getByRole('img', { name: 'Atenciones por mes' });
    expect(tendencia.getAttribute('data-labels')!.split('|')).toHaveLength(12);
    expect(screen.getByRole('img', { name: 'Primera vez y seguimiento por mes' }).getAttribute('data-series')).toBe('Primera vez|Seguimiento');
    expect(screen.getByRole('img', { name: 'Personas atendidas por sexo' }).getAttribute('data-labels')).toBe('Mujeres|Hombres');
    expect(screen.getByRole('list', { name: 'Atenciones por tipo de atención' })).toBeTruthy();
  });

  it('cada gráfica ofrece «Ver datos» con la misma información en tabla', () => {
    render(<EstadisticasPage now={NOW} />);
    const panel = screen.getByRole('region', { name: 'Mujeres y hombres atendidos' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Ver datos' }));
    const table = within(panel).getByRole('table');
    expect(within(table).getByText('Mujeres')).toBeTruthy();
    expect(within(table).getByText('Hombres')).toBeTruthy();
    expect(within(panel).queryByRole('img')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Ver gráfica' }));
    expect(within(panel).getByRole('img')).toBeTruthy();
  });

  it('describe cada gráfica con un resumen para lectores de pantalla', () => {
    render(<EstadisticasPage now={NOW} />);
    const panel = screen.getByRole('region', { name: 'Atenciones por mes' });
    expect(panel.textContent).toContain('Atenciones por mes: 22 en total');
  });

  it('muestra esqueleto mientras carga', () => {
    useReporteMock.mockImplementation(() => ({ data: undefined, isPending: true, isError: false, refetch }));
    render(<EstadisticasPage now={NOW} />);
    expect(screen.getByRole('status', { name: 'Cargando estadísticas' })).toBeTruthy();
  });

  it('muestra el error con reintento', () => {
    useReporteMock.mockImplementation(() => ({ data: undefined, isPending: false, isError: true, refetch }));
    render(<EstadisticasPage now={NOW} />);
    expect(screen.getByText('No se pudieron cargar las estadísticas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('muestra el estado vacío sin atenciones', () => {
    useReporteMock.mockImplementation((filters: Filters) => ({
      data: filters.agrupar === 'total' ? [row('atenciones', { total: 0, personas: 0, metrica: 0, areaId: null, area: null })] : [],
      isPending: false,
      isError: false,
      refetch,
    }));
    render(<EstadisticasPage now={NOW} />);
    expect(screen.getByText('Sin atenciones en este periodo')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Estadísticas: periodo', () => {
  it('Anual consulta el año completo y oculta el selector de mes', () => {
    render(<EstadisticasPage now={NOW} />);
    expect(screen.getByLabelText('Mes')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Anual' }));
    expect(screen.queryByLabelText('Mes')).toBeNull();
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2026-01-01')?.[0]).toMatchObject({ hasta: '2026-12-31' });
    expect(screen.getByText(/Año 2026/)).toBeTruthy();
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2025-01-01')?.[0]).toMatchObject({ hasta: '2025-12-31' });
  });

  it('Mensual permite cambiar año y mes', () => {
    render(<EstadisticasPage now={NOW} />);
    const years = within(screen.getByLabelText('Año')).getAllByRole('option');
    expect(years.map((o) => o.textContent)).toEqual(['2026', '2025', '2024']);
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '1' } });
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2026-01-01')?.[0]).toMatchObject({ hasta: '2026-01-31' });
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2025-12-01')?.[0]).toMatchObject({ hasta: '2025-12-31' });
  });

  it('Rango muestra las fechas, consulta ese rango y avisa si es inválido', () => {
    render(<EstadisticasPage now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rango' }));
    expect(screen.queryByLabelText('Año')).toBeNull();
    const desde = screen.getByLabelText('Desde') as HTMLInputElement;
    const hasta = screen.getByLabelText('Hasta') as HTMLInputElement;
    expect(desde.value).toBe('2026-03-01');
    expect(hasta.value).toBe('2026-03-15');
    expect(lastCall((f) => f.agrupar === 'total' && f.desde === '2026-03-01')?.[0]).toMatchObject({ hasta: '2026-03-15' });

    fireEvent.change(desde, { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toContain('Elige las dos fechas');
    expect(lastCall(() => true)?.[1]).toBe(false);
  });
});

describe('Reportes por área', () => {
  function irAReportes() {
    render(<EstadisticasPage now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
  }

  it('ofrece los 6 tipos de reporte', () => {
    irAReportes();
    const options = within(screen.getByLabelText('Tipo de reporte')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Atenciones',
      'Citas',
      'Canalizaciones',
      'Órdenes de protección',
      'Actividades preventivas',
      'Alertas',
    ]);
  });

  it('Atenciones: tabla con las columnas del informe y consulta del periodo agrupada', () => {
    irAReportes();
    const table = screen.getByTestId('reporte-table');
    for (const header of ['Área', 'Tipo de atención', 'Primera vez / Seguimiento', 'Mujeres', 'Hombres', 'Personas', 'Atenciones']) {
      expect(within(table).getByText(header)).toBeTruthy();
    }
    expect(lastCall((f) => f.agrupar === 'periodo')?.[0]).toMatchObject({
      tipo: 'atenciones',
      desde: '2026-03-01',
      hasta: '2026-03-31',
      areaId: null,
    });
  });

  it.each([
    ['citas', 'Citas', 'Tasa de asistencia (%)'],
    ['canalizaciones', 'Canalizaciones', 'Días promedio a conclusión'],
    ['ordenes_proteccion', 'Órdenes de protección', 'Vigentes'],
    ['actividades', 'Actividades preventivas', 'Asistentes (realizadas)'],
    ['alertas', 'Alertas', 'Minutos promedio de atención'],
  ] as const)('%s: cambia de reporte, muestra su tabla y su gráfica', (tipo, label, columna) => {
    irAReportes();
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: tipo } });
    expect(lastCall((f) => f.tipo === tipo)?.[0]).toMatchObject({ agrupar: 'periodo' });
    expect(within(screen.getByTestId('reporte-table')).getByText(columna)).toBeTruthy();
    expect(screen.getByTestId('reporte-table').getAttribute('aria-label')).toBe(`${label}, Marzo 2026`);
    expect(screen.getAllByRole('button', { name: 'Ver datos' }).length).toBeGreaterThan(0);
  });

  it('actividades y alertas no se dividen por área: el selector queda deshabilitado y no se envía el área', () => {
    irAReportes();
    const select = screen.getByLabelText('Área') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2' } });
    expect(lastCall((f) => f.tipo === 'atenciones' && f.agrupar === 'periodo')?.[0].areaId).toBe(2);

    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'actividades' } });
    expect((screen.getByLabelText('Área') as HTMLSelectElement).disabled).toBe(true);
    expect(lastCall((f) => f.tipo === 'actividades')?.[0].areaId).toBeNull();
    expect(screen.getByText(/Abarca todo el programa/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'citas' } });
    expect((screen.getByLabelText('Área') as HTMLSelectElement).disabled).toBe(false);
    expect(lastCall((f) => f.tipo === 'citas')?.[0].areaId).toBe(2);
  });

  it('un área de atención consulta cada reporte con su propia área', () => {
    asRole('juridico', { areaId: 3, areaNombre: 'Jurídico' });
    render(<EstadisticasPage now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'ordenes_proteccion' } });
    expect(lastCall((f) => f.tipo === 'ordenes_proteccion')?.[0].areaId).toBe(3);
    expect(screen.queryByLabelText('Área')).toBeNull();
  });

  it('muestra esqueleto, error con reintento y vacío', () => {
    useReporteMock.mockImplementation(() => ({ data: undefined, isPending: true, isError: false, refetch }));
    irAReportes();
    expect(screen.getByRole('status', { name: 'Cargando reporte' })).toBeTruthy();
    cleanup();

    useReporteMock.mockImplementation(() => ({ data: undefined, isPending: false, isError: true, refetch }));
    irAReportes();
    expect(screen.getByText('No se pudo cargar el reporte')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
    cleanup();

    useReporteMock.mockImplementation(() => ({ data: [], isPending: false, isError: false, refetch }));
    irAReportes();
    expect(screen.getByText('Sin datos en este periodo')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Descargar CSV' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Descargar Excel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ['atenciones', 'reporte-atenciones-2026-03-todas', 'Área,Tipo de atención,Primera vez / Seguimiento'],
    ['citas', 'reporte-citas-2026-03-todas', 'Área,Agendadas,Confirmadas,Reagendadas,Asistió,No asistió,Canceladas,Total,Tasa de asistencia (%)'],
    ['canalizaciones', 'reporte-canalizaciones-2026-03-todas', 'Área de origen,Destino,Pendientes'],
    ['ordenes_proteccion', 'reporte-ordenes-proteccion-2026-03-todas', 'Área que registró,En trámite,Vigentes'],
    ['actividades', 'reporte-actividades-2026-03-todas', 'Tipo de institución,Pendientes,Realizadas'],
    ['alertas', 'reporte-alertas-2026-03-todas', 'Origen,Nuevas,Tomadas,Atendidas'],
  ] as const)('%s: descarga CSV y Excel con el nombre del reporte', async (tipo, base, encabezado) => {
    irAReportes();
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: tipo } });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));
    expect(downloadMock).toHaveBeenCalledTimes(1);
    const [csv, csvName] = downloadMock.mock.calls[0] as [Blob, string];
    expect(csvName).toBe(`${base}.csv`);
    expect(await leerBlob(csv)).toContain(encabezado);
    expect(toastMock).toHaveBeenLastCalledWith(`Se descargó ${base}.csv.`, { tone: 'success' });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    const [xlsx, xlsxName] = downloadMock.mock.calls[1] as [Blob, string];
    expect(xlsxName).toBe(`${base}.xlsx`);
    const bytes = new Uint8Array(await xlsx.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
  });

  it('el nombre del archivo incluye el área elegida', () => {
    irAReportes();
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));
    expect(downloadMock.mock.calls[0][1]).toBe('reporte-atenciones-2026-03-psicologia.csv');
  });

  it('neutraliza fórmulas en el CSV descargado', async () => {
    useReporteMock.mockImplementation((filters: Filters) => ({
      data: filters.tipo === 'atenciones' ? [row('atenciones', { area: '=CMD()', categoria: '@x', estado: 'primera_vez' })] : [],
      isPending: false,
      isError: false,
      refetch,
    }));
    irAReportes();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));
    const text = await leerBlob(downloadMock.mock.calls[0][0] as Blob);
    expect(text).toContain("'=CMD()");
    expect(text).toContain("'@x");
  });

  it('avisa si no se pudo generar el archivo', () => {
    downloadMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    irAReportes();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));
    expect(toastMock).toHaveBeenLastCalledWith('No se pudo generar el archivo del reporte.', { tone: 'error' });
  });
});

describe('Imprimir / PDF', () => {
  let print: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    print = vi.spyOn(window, 'print').mockImplementation(() => {});
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  });
  afterEach(() => {
    document.getElementById('vc-print-root')?.remove();
    vi.useRealTimers();
    print.mockRestore();
  });

  async function imprimir() {
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir / PDF' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  }

  it('Reportes: junto a CSV y Excel, imprime las mismas columnas con filtros, indicadores y nota', async () => {
    render(<EstadisticasPage now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(
      expect.arrayContaining(['Descargar CSV', 'Descargar Excel', 'Imprimir / PDF']),
    );
    await imprimir();
    expect(print).toHaveBeenCalledTimes(1);
    const root = document.getElementById('vc-print-root')!;
    expect(root.querySelector('h1')?.textContent).toBe('Atenciones');
    expect(root.textContent).toContain('Periodo:');
    expect(root.textContent).toContain('Marzo 2026');
    expect(root.textContent).toContain('Titular / Dirección');
    expect(root.textContent).toContain('Documento sin datos personales');
    const encabezados = [...root.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(encabezados.slice(0, 3)).toEqual(['Área', 'Tipo de atención', 'Primera vez / Seguimiento']);
    expect(root.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    expect(root.querySelector('.vcp-chart')).not.toBeNull();
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Guardar como PDF'), { tone: 'success' });
  });

  it('Reportes: queda deshabilitado sin datos y no imprime', async () => {
    useReporteMock.mockImplementation(() => ({ data: [], isPending: false, isError: false, refetch }));
    render(<EstadisticasPage now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
    const boton = screen.getByRole('button', { name: 'Imprimir / PDF' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.click(boton);
    await vi.advanceTimersByTimeAsync(300);
    expect(print).not.toHaveBeenCalled();
  });

  it('Resumen: imprime indicadores, gráficas y la tendencia mensual', async () => {
    render(<EstadisticasPage now={NOW} />);
    await imprimir();
    expect(print).toHaveBeenCalledTimes(1);
    const root = document.getElementById('vc-print-root')!;
    expect(root.querySelector('h1')?.textContent).toBe('Resumen de atenciones');
    expect([...root.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      'Mes',
      'Atenciones',
      'Primera vez',
      'Seguimiento',
    ]);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(root.querySelectorAll('.vcp-kpi').length).toBeGreaterThan(0);
    expect([...root.querySelectorAll('.vcp-chart figcaption')].map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['Atenciones por mes', 'Mujeres y hombres atendidos', 'Atenciones por tipo de atención']),
    );
    expect(root.querySelector('.vcp-kpi p')?.textContent).toContain('vs. periodo anterior');
  });

  it('Ctrl/Cmd+P en Reportes monta el mismo documento (beforeprint) y lo retira (afterprint)', () => {
    render(<EstadisticasPage now={NOW} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.querySelector('#vc-print-root h1')?.textContent).toBe('Atenciones');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.getElementById('vc-print-root')).toBeNull();
    expect(print).not.toHaveBeenCalled();
  });
});
