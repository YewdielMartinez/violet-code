import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CitaItem } from '@/domain/models/Dashboard';
import {
  getAgendaRange,
  summarizeScheduling,
  useAppointments,
  useCasesSummary,
  useSchedulingSummary,
} from '@/features/dashboard/api';

const repo = vi.hoisted(() => ({
  getAppointments: vi.fn(),
  getSchedulingSummary: vi.fn(),
  getCasesSummary: vi.fn(),
}));
vi.mock('@/infrastructure/supabase/adapters/SupabaseDashboardRepository', () => ({
  supabaseDashboardRepository: repo,
}));

const cita = (id: string, programadaEn: Date, estado: CitaItem['estado'] = 'agendada'): CitaItem => ({
  id,
  programadaEn: programadaEn.toISOString(),
  estado,
  prioridad: null,
  areaClave: 'psicologia',
  areaNombre: 'Psicología',
  usuariaNombre: 'Usuaria',
});

const NOW = new Date(2026, 4, 14, 12, 0, 0);
const at = (h: number, min = 0, day = 14) => new Date(2026, 4, day, h, min);

describe('summarizeScheduling', () => {
  it('cuenta las citas de hoy y toma la próxima que aún no ocurre', () => {
    const items = [
      cita('past', at(9), 'asistio'),
      cita('later', at(17)),
      cita('soon', at(13)),
      cita('tomorrow', at(10, 0, 15)),
      cita('cancelled', at(15), 'cancelada'),
      cita('yesterday', at(10, 0, 13)),
    ];
    const summary = summarizeScheduling(items, NOW);
    expect(summary.today).toBe(3);
    expect(summary.nextAt).toBe(at(13).toISOString());
    expect(summary.nextArea).toBe('Psicología');
  });

  it('sin citas por venir, no hay próxima', () => {
    const summary = summarizeScheduling([cita('past', at(9), 'asistio')], NOW);
    expect(summary).toMatchObject({ today: 1, nextAt: null, nextArea: null });
  });
});

describe('getAgendaRange', () => {
  it('abarca el mes completo', () => {
    expect(getAgendaRange(new Date(2026, 1, 10))).toEqual({ from: '2026-02-01', to: '2026-02-28', today: '2026-02-10' });
  });
});

function Both() {
  const { from, to } = getAgendaRange();
  const agenda = useAppointments(from, to);
  const summary = useSchedulingSummary();
  return (
    <p>
      {agenda.data?.length ?? '-'}|{summary.data ? summary.data.today : '-'}
    </p>
  );
}

const withClient = (client: QueryClient, node: ReactNode) => (
  <QueryClientProvider client={client}>{node}</QueryClientProvider>
);

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(cleanup);

describe('consultas del tablero', () => {
  it('Agenda y «Citas de hoy» comparten una sola llamada a get_agenda', async () => {
    const upcoming = new Date(Date.now() + 60_000);
    repo.getAppointments.mockResolvedValue([cita('x', upcoming)]);
    render(withClient(client, <Both />));
    await waitFor(() => expect(screen.getByText(/^1\|/)).toBeTruthy());
    expect(repo.getAppointments).toHaveBeenCalledTimes(1);
    expect(repo.getSchedulingSummary).not.toHaveBeenCalled();
  });

  it('solo consulta la ventana de 30 días cuando el mes no trae próximas citas', async () => {
    repo.getAppointments.mockResolvedValue([]);
    repo.getSchedulingSummary.mockResolvedValue({
      today: 0,
      nextAt: '2099-01-01T10:00:00Z',
      nextArea: 'Jurídico',
      nextUsuaria: null,
    });
    function Summary() {
      const q = useSchedulingSummary();
      return <p>{q.data?.nextArea ?? '-'}</p>;
    }
    render(withClient(client, <Summary />));
    await waitFor(() => expect(screen.getByText('Jurídico')).toBeTruthy());
    expect(repo.getAppointments).toHaveBeenCalledTimes(1);
    expect(repo.getSchedulingSummary).toHaveBeenCalledTimes(1);
  });

  it('el resumen de expedientes (varios KPIs) es una sola consulta y no se repite al remontar mientras está fresco', async () => {
    repo.getCasesSummary.mockResolvedValue({ open: 1, inFollowUp: 2, urgencias: 0, mine: 1 });
    function Kpis() {
      const a = useCasesSummary('u1');
      const b = useCasesSummary('u1');
      return <p>{a.data && b.data ? 'ok' : '-'}</p>;
    }
    const first = render(withClient(client, <Kpis />));
    await waitFor(() => expect(screen.getByText('ok')).toBeTruthy());
    first.unmount();
    render(withClient(client, <Kpis />));
    await waitFor(() => expect(screen.getByText('ok')).toBeTruthy());
    expect(repo.getCasesSummary).toHaveBeenCalledTimes(1);
  });
});
