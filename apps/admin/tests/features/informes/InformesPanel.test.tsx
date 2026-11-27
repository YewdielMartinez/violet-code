import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useInformeMock } = vi.hoisted(() => ({
  useInformeMock: vi.fn(),
}));

vi.mock('@/features/informes/api', () => ({
  useInforme: useInformeMock,
}));

import {
  InformesPanel,
  buildInformeCsv,
  buildInformeFilename,
} from '@/features/informes/InformesPanel';

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InformesPanel />
    </QueryClientProvider>,
  );
}

describe('InformesPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useInformeMock.mockReset();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  it('muestra KPIs de total, primera vez y seguimiento, y habilita descarga CSV', async () => {
    useInformeMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          anio: 2026,
          mes: 11,
          areaId: 1,
          area: 'Trabajo Social',
          tipoAtencion: 'Entrevista inicial',
          primeraVezOSeguimiento: 'primera_vez',
          mujeres: 4,
          hombres: 0,
          totalPersonas: 4,
          totalAtenciones: 5,
        },
        {
          anio: 2026,
          mes: 11,
          areaId: 2,
          area: 'Psicología',
          tipoAtencion: 'Terapia individual',
          primeraVezOSeguimiento: 'seguimiento',
          mujeres: 3,
          hombres: 0,
          totalPersonas: 3,
          totalAtenciones: 3,
        },
      ],
    });

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPanel();

    expect(await screen.findByText('8')).toBeTruthy();
    expect(screen.getByText('Primera vez: 5 · Seguimiento: 3')).toBeTruthy();

    const csvBtn = screen.getByRole('button', { name: /Descargar CSV/i });
    expect((csvBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(csvBtn);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock');
  });

  it('cambia a Anual enviando mes = null y deshabilita CSV si no hay filas', async () => {
    useInformeMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    });

    renderPanel();

    const csvBtn = screen.getByRole('button', { name: /Descargar CSV/i });
    expect((csvBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Sin atenciones registradas')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Anual' }));

    await waitFor(() => {
      expect(useInformeMock).toHaveBeenLastCalledWith(expect.objectContaining({ mes: null }));
    });
    expect(screen.queryByLabelText('Mes')).toBeNull();
  });

  it('arma correctamente el CSV y el nombre del archivo', () => {
    const csv = buildInformeCsv([
      {
        anio: 2026,
        mes: 11,
        areaId: 1,
        area: 'Trabajo Social',
        tipoAtencion: 'Entrevista, inicial',
        primeraVezOSeguimiento: 'primera_vez',
        mujeres: 2,
        hombres: 1,
        totalPersonas: 3,
        totalAtenciones: 4,
      },
    ]);
    expect(csv).toContain('Área,Tipo de atención,Primera vez / Seguimiento,Mujeres,Hombres,Personas,Atenciones');
    expect(csv).toContain('Trabajo Social,"Entrevista, inicial",Primera vez,2,1,3,4');
    expect(buildInformeFilename(2026, 5)).toBe('informe-2026-05.csv');
    expect(buildInformeFilename(2026, null)).toBe('informe-2026.csv');
  });
});
