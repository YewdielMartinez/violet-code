import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LineaTiempoEvento } from '@/domain/models/Seguimiento';

const { getLineaTiempoMock } = vi.hoisted(() => ({ getLineaTiempoMock: vi.fn() }));

vi.mock('@/infrastructure/supabase/adapters/SupabaseSeguimientoRepository', () => ({
  supabaseSeguimientoRepository: { getLineaTiempo: getLineaTiempoMock },
}));

import { ExpedienteTimeline } from '@/features/intervenciones/ExpedienteTimeline';

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

afterEach(() => {
  cleanup();
  getLineaTiempoMock.mockReset();
});

function ev(partial: Partial<LineaTiempoEvento> & Pick<LineaTiempoEvento, 'tipo' | 'titulo' | 'referenciaId'>) {
  return { fecha: '2026-11-20T16:00:00Z', area: null, detalle: null, ...partial } satisfies LineaTiempoEvento;
}

const EVENTOS: LineaTiempoEvento[] = [
  ev({ tipo: 'registro', titulo: 'Registro de ficha SEM-2026-0001 · abierto', referenciaId: 'r1', fecha: '2026-10-01T10:00:00Z' }),
  ev({ tipo: 'cita', titulo: 'Cita Psicología · asistio', referenciaId: 'c1', area: 'Psicología', fecha: '2026-11-01T10:00:00Z' }),
  ev({ tipo: 'atencion', titulo: 'Atención Psicología · Sesión de seguimiento', referenciaId: 'a1', fecha: '2026-11-02T10:00:00Z' }),
  ev({ tipo: 'derivacion', titulo: 'Derivación a Refugio · pendiente', referenciaId: 'd1', fecha: '2026-11-03T10:00:00Z' }),
  ev({ tipo: 'canalizacion_evento', titulo: 'Canalización a Refugio: pendiente → en_proceso', referenciaId: 'ce1', fecha: '2026-11-04T10:00:00Z' }),
  ev({ tipo: 'orden_proteccion', titulo: 'Orden de protección · vigente', referenciaId: 'o1', fecha: '2026-11-05T10:00:00Z' }),
  ev({ tipo: 'alerta', titulo: 'Alerta app_movil · alta (nueva)', referenciaId: 'al1', fecha: '2026-11-06T10:00:00Z' }),
  ev({ tipo: 'archivo', titulo: 'Archivo de expediente SEM-2026-0001', referenciaId: 'f1', fecha: '2026-11-07T10:00:00Z', detalle: 'Caso concluido' }),
  ev({ tipo: 'reapertura', titulo: 'Reapertura de expediente SEM-2026-0001', referenciaId: 'f2', fecha: '2026-11-08T10:00:00Z', detalle: 'Nueva agresión' }),
  { ...ev({ tipo: 'otro', titulo: 'Evento futuro genérico', referenciaId: 'x1', fecha: '2026-11-09T10:00:00Z' }) },
];

function renderTimeline() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExpedienteTimeline fichaId="ficha-1" />
    </QueryClientProvider>,
  );
}

describe('ExpedienteTimeline', () => {
  it('muestra todos los tipos de evento que devuelve get_linea_tiempo', async () => {
    getLineaTiempoMock.mockResolvedValue(EVENTOS);
    renderTimeline();

    await waitFor(() => expect(screen.getByText('Todos (10)')).toBeTruthy());

    for (const texto of [
      /Registro de ficha SEM-2026-0001/,
      /Cita Psicología · Asistió/,
      /Atención Psicología · Sesión de seguimiento/,
      /Derivación a Refugio · Pendiente/,
      /Canalización a Refugio: Pendiente → En proceso/,
      /Orden de protección · Vigente/,
      /Alerta App móvil/,
      /Archivo de expediente SEM-2026-0001/,
      /Reapertura de expediente SEM-2026-0001/,
      /Evento futuro genérico/,
    ]) {
      expect(screen.getByText(texto), String(texto)).toBeTruthy();
    }
    expect(screen.getByText('Caso concluido')).toBeTruthy();
    expect(screen.getByText('Nueva agresión')).toBeTruthy();

    for (const chip of [
      'Canalizaciones (1)',
      'Archivo (1)',
      'Reaperturas (1)',
      'Otros eventos (1)',
    ]) {
      expect(screen.getByRole('button', { name: chip })).toBeTruthy();
    }
  });

  it('filtra por canalización y muestra solo esos eventos', async () => {
    getLineaTiempoMock.mockResolvedValue(EVENTOS);
    renderTimeline();
    await waitFor(() => expect(screen.getByText('Todos (10)')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Canalizaciones (1)' }));

    expect(screen.getByText(/Canalización a Refugio/)).toBeTruthy();
    expect(screen.queryByText(/Archivo de expediente/)).toBeNull();
  });
});
