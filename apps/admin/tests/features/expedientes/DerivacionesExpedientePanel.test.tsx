import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivacionItem, HistorialCanalizacionItem } from '@/domain/models/Derivacion';

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

const { listByFichaMock, historialMock, updateEstadoMock, toastMock } = vi.hoisted(() => ({
  listByFichaMock: vi.fn(),
  historialMock: vi.fn(),
  updateEstadoMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseDerivacionRepository', () => ({
  supabaseDerivacionRepository: {
    list: vi.fn(),
    listByFicha: listByFichaMock,
    historialCanalizaciones: historialMock,
    create: vi.fn(),
    updateEstado: updateEstadoMock,
  },
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return { ...actual, toast: toastMock };
});

import { DerivacionesExpedientePanel } from '@/features/expedientes/DerivacionesExpedientePanel';

const EN_PROCESO: DerivacionItem = {
  id: 'der-1',
  fichaId: 'ficha-1',
  folio: 'SEM-2026-0010',
  usuariaNombre: 'Laura Méndez',
  areaOrigenId: 1,
  areaOrigenNombre: 'Trabajo Social',
  areaDestinoId: 2,
  areaDestinoNombre: 'Psicología',
  institucionId: null,
  institucionNombre: null,
  institucionOtra: null,
  destino: 'psicologia',
  motivo: 'Contención emocional inicial por crisis reciente.',
  fechaDerivacion: '2026-11-26',
  estado: 'en_proceso',
  creadoEn: '2026-11-26T18:00:00Z',
};

const CONCLUIDA: DerivacionItem = {
  ...EN_PROCESO,
  id: 'der-2',
  destino: 'fiscalia',
  areaDestinoId: null,
  areaDestinoNombre: null,
  institucionId: 10,
  institucionNombre: 'Fiscalía General del Estado',
  motivo: 'Acompañamiento para presentar denuncia formal.',
  estado: 'concluida',
};

const HISTORIAL: HistorialCanalizacionItem[] = [
  {
    id: 'der-1',
    fichaId: 'ficha-1',
    areaOrigenId: 1,
    areaOrigenNombre: 'Trabajo Social',
    areaDestinoId: 2,
    areaDestinoNombre: 'Psicología',
    institucionId: null,
    institucionNombre: null,
    institucionOtra: null,
    destino: 'psicologia',
    motivo: EN_PROCESO.motivo,
    fechaDerivacion: '2026-11-26',
    estado: 'en_proceso',
    creadoEn: '2026-11-26T18:00:00Z',
    actualizadoEn: '2026-11-27T16:30:00Z',
    eventos: [
      {
        tipo: 'estado',
        fecha: '2026-11-27T16:30:00Z',
        estadoAnterior: 'pendiente',
        estadoNuevo: 'en_proceso',
        actorId: 'emp-1',
        actorNombre: 'Ana Ruiz',
        nota: null,
      },
      {
        tipo: 'estado',
        fecha: '2026-11-26T18:00:00Z',
        estadoAnterior: null,
        estadoNuevo: 'pendiente',
        actorId: 'emp-1',
        actorNombre: 'Ana Ruiz',
        nota: null,
      },
    ],
  },
];

function renderPanel(estado?: 'archivado') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DerivacionesExpedientePanel fichaId="ficha-1" folio="SEM-2026-0010" estado={estado} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listByFichaMock.mockReset().mockResolvedValue([EN_PROCESO, CONCLUIDA]);
  historialMock.mockReset().mockResolvedValue(HISTORIAL);
  updateEstadoMock.mockReset().mockResolvedValue(undefined);
  toastMock.mockReset();
});

afterEach(() => cleanup());

describe('DerivacionesExpedientePanel (pestaña Canalizaciones)', () => {
  it('muestra el resumen con conteos por estado', async () => {
    renderPanel();
    expect(await screen.findByText('2 canalizaciones')).toBeTruthy();
    const resumen = screen.getByRole('list', { name: /Resumen por estado/i });
    expect(within(resumen).getByText(/activas/).textContent).toContain('1');
    expect(within(resumen).getByText(/concluidas/).textContent).toContain('1');
    expect(within(resumen).getByText(/canceladas/).textContent).toContain('0');
  });

  it('presenta cada canalización con título, estado, fechas, motivo e historial de estados', async () => {
    renderPanel();
    expect(await screen.findByRole('heading', { level: 4, name: 'Psicología' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Fiscalía General del Estado' }),
    ).toBeTruthy();
    expect(screen.getByText('Contención emocional inicial por crisis reciente.')).toBeTruthy();
    expect(screen.getAllByText('Canalizada').length).toBe(2);
    expect(screen.getAllByText('Último cambio').length).toBe(2);

    // Historial: el evento de alta y el cambio de estado, con el actor.
    expect(await screen.findByText('De Pendiente a En proceso')).toBeTruthy();
    expect(screen.getAllByText('Canalización registrada').length).toBe(2);
    expect(screen.getAllByText(/Ana Ruiz/).length).toBe(2);
  });

  it('degrada a un evento de registro si el historial no se puede cargar', async () => {
    historialMock.mockReset().mockRejectedValue(new Error('rpc'));
    renderPanel();
    expect(await screen.findByText('Contención emocional inicial por crisis reciente.')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('Canalización registrada').length).toBe(2));
    expect(screen.getAllByText('Sin cambios').length).toBe(2);
  });

  it('el botón de avance es solo texto, sin íconos, con las variantes de los pies de formulario', async () => {
    renderPanel();
    const boton = await screen.findByRole('button', { name: 'Marcar concluida' });
    expect(boton.className).toContain('mk-button');
    expect(boton.className).toContain('mk-button--filled');
    expect(boton.className).toContain('min-h-11');
    expect(boton.querySelector('.mk-icon')).toBeNull();
    expect(boton.textContent).toBe('Marcar concluida');
  });

  it('avanza el estado y no ofrece acciones en canalizaciones concluidas', async () => {
    renderPanel();
    // Solo la canalización en proceso ofrece avanzar; la concluida es terminal.
    expect(
      (await screen.findAllByRole('button', { name: /Pasar a|Marcar/i })).length,
    ).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar concluida' }));
    await waitFor(() => expect(updateEstadoMock).toHaveBeenCalledWith('der-1', 'concluida'));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('Estado actualizado a Concluida.', { tone: 'success' }),
    );
  });

  it('muestra estado vacío y aviso de solo consulta en expedientes archivados', async () => {
    listByFichaMock.mockReset().mockResolvedValue([]);
    renderPanel('archivado');
    expect(await screen.findByText('Sin canalizaciones en este expediente')).toBeTruthy();
    expect(screen.getByText(/Expediente archivado: solo consulta/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Canalizar/i })).toBeNull();
  });
});
