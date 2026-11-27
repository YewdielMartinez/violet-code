import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DESTINO_LABELS,
  type DerivacionItem,
  type DestinoDerivacion,
  type EstadoDerivacion,
} from '@/domain/models/Derivacion';

const { useDerivacionesMock, downloadMock, toastMock } = vi.hoisted(() => ({
  useDerivacionesMock: vi.fn(),
  downloadMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/features/canalizaciones/api', () => ({
  useDerivaciones: useDerivacionesMock,
}));
vi.mock('@/shared/export/download', () => ({ downloadBlob: downloadMock }));
vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return { ...real, toast: toastMock };
});

import {
  CanalizacionesStats,
  rangoMesActual,
  resumirCanalizacionesPorRango,
} from '@/features/informes/CanalizacionesStats';

function item(
  id: string,
  fichaId: string,
  destino: DestinoDerivacion,
  fechaDerivacion: string,
  estado: EstadoDerivacion = 'pendiente',
): DerivacionItem {
  return {
    id,
    fichaId,
    folio: `SEM-2026-${id}`,
    usuariaNombre: `Usuaria Reservada ${id}`,
    areaOrigenId: 1,
    areaOrigenNombre: 'Trabajo Social',
    areaDestinoId: null,
    areaDestinoNombre: null,
    institucionId: null,
    institucionNombre: null,
    institucionOtra: null,
    destino,
    motivo: 'Motivo de prueba',
    fechaDerivacion,
    estado,
    creadoEn: `${fechaDerivacion}T10:00:00Z`,
  };
}

const NOW = new Date(2026, 2, 15); // marzo de 2026

const SAMPLE: readonly DerivacionItem[] = [
  item('1', 'ficha-1', 'trabajo_social', '2026-03-01', 'pendiente'),
  item('2', 'ficha-1', 'trabajo_social', '2026-03-10', 'en_proceso'), // misma persona en mismo destino
  item('3', 'ficha-1', 'psicologia', '2026-03-12', 'concluida'), // misma persona en otro destino
  item('4', 'ficha-2', 'juridico', '2026-03-15', 'pendiente'),
  item('5', 'ficha-3', 'fiscalia', '2026-03-20', 'pendiente'),
  item('6', 'ficha-4', 'refugio', '2026-03-22', 'concluida'),
  item('7', 'ficha-5', 'capacitacion', '2026-03-25', 'en_proceso'),
  item('8', 'ficha-6', 'otra_institucion', '2026-03-31', 'pendiente'),
  item('9', 'ficha-7', 'fiscalia', '2026-03-29', 'cancelada'), // cancelada excluida
  item('10', 'ficha-8', 'psicologia', '2026-02-18', 'concluida'), // otro mes del mismo año
  item('11', 'ficha-9', 'juridico', '2025-03-10', 'concluida'), // otro año
];

beforeEach(() => {
  useDerivacionesMock.mockReturnValue({
    data: SAMPLE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('resumirCanalizacionesPorRango', () => {
  it('cuenta personas distintas en un rango cerrado, excluye canceladas y lista los 7 destinos', () => {
    const res = resumirCanalizacionesPorRango(SAMPLE, '2026-03-01', '2026-03-31');
    expect(res.totalPersonas).toBe(6);
    expect(res.porDestino).toEqual([
      { destino: 'trabajo_social', label: DESTINO_LABELS.trabajo_social, count: 1 },
      { destino: 'psicologia', label: DESTINO_LABELS.psicologia, count: 1 },
      { destino: 'juridico', label: DESTINO_LABELS.juridico, count: 1 },
      { destino: 'fiscalia', label: DESTINO_LABELS.fiscalia, count: 1 },
      { destino: 'refugio', label: DESTINO_LABELS.refugio, count: 1 },
      { destino: 'capacitacion', label: DESTINO_LABELS.capacitacion, count: 1 },
      { destino: 'otra_institucion', label: DESTINO_LABELS.otra_institucion, count: 1 },
    ]);
  });

  it('admite rango abierto solo desde, solo hasta o sin fechas', () => {
    expect(resumirCanalizacionesPorRango(SAMPLE, '2026-02-01', '').totalPersonas).toBe(7);
    expect(resumirCanalizacionesPorRango(SAMPLE, '', '2026-02-28').totalPersonas).toBe(2);
    expect(resumirCanalizacionesPorRango(SAMPLE, '', '').totalPersonas).toBe(8);
  });

  it('calcula rangoMesActual con inicio y fin del mes', () => {
    expect(rangoMesActual(NOW)).toEqual({ desde: '2026-03-01', hasta: '2026-03-31' });
  });
});

describe('CanalizacionesStats', () => {
  it('no tiene enlaces a /canalizaciones, muestra selector de rango y desglose sin PII', () => {
    render(<CanalizacionesStats now={NOW} />);

    const card = screen.getByRole('region', { name: 'Canalizaciones' });
    expect(within(card).queryByRole('link')).toBeNull();
    expect((within(card).getByLabelText('Desde') as HTMLInputElement).value).toBe('2026-03-01');
    expect((within(card).getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-03-31');
    expect(within(card).getByText('6')).toBeTruthy();
    expect(within(card).getByText('personas canalizadas')).toBeTruthy();

    for (const label of Object.values(DESTINO_LABELS)) {
      expect(within(card).getByText(label)).toBeTruthy();
    }

    expect(card.textContent).not.toContain('Usuaria Reservada');
    expect(card.textContent).not.toContain('SEM-2026');

    fireEvent.change(within(card).getByLabelText('Desde'), { target: { value: '2026-02-01' } });
    expect(within(card).getByText('7')).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'Limpiar fechas' }));
    expect(within(card).getByText('Todas las fechas')).toBeTruthy();
    expect(within(card).getByText('8')).toBeTruthy();
  });

  it('exporta a Excel sin datos personales y deshabilita la descarga sin datos', () => {
    render(<CanalizacionesStats now={NOW} />);

    expect(screen.queryByRole('button', { name: 'Descargar CSV' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    expect(downloadMock).toHaveBeenCalledOnce();
    const [xlsxBlob, xlsxName] = downloadMock.mock.calls[0] as [Blob, string];
    expect(xlsxName).toBe('canalizaciones-2026-03-01_a_2026-03-31.xlsx');
    expect(xlsxBlob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(toastMock).toHaveBeenCalledWith('Se descargó canalizaciones-2026-03-01_a_2026-03-31.xlsx.', {
      tone: 'success',
    });

    cleanup();
    useDerivacionesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<CanalizacionesStats now={NOW} />);
    expect((screen.getByRole('button', { name: 'Descargar Excel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('muestra estado de carga y error con reintento', () => {
    useDerivacionesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    const { rerender } = render(<CanalizacionesStats now={NOW} />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();

    const refetch = vi.fn();
    useDerivacionesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    rerender(<CanalizacionesStats now={NOW} />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
