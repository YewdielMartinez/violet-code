import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  AccionBitacora,
  AlertaItem,
  AlertsSummary,
  AuditEvent,
  CaseItem,
  CasesSummary,
  CitaItem,
  EstadoAlerta,
  EstadoCita,
  EstadoFicha,
  OrigenAlerta,
  PrioridadNivel,
  SchedulingSummary,
} from '@/domain/models/Dashboard';
import { supabaseDashboardRepository } from '@/infrastructure/supabase/adapters/SupabaseDashboardRepository';
import { isoDate } from './widgets/format';

export type {
  AccionBitacora,
  AlertaItem,
  AlertsSummary,
  AuditEvent,
  CaseItem,
  CasesSummary,
  CitaItem,
  EstadoAlerta,
  EstadoCita,
  EstadoFicha,
  OrigenAlerta,
  PrioridadNivel,
  SchedulingSummary,
};

const LIVE = 30_000;

/**
 * Los datos del tablero se consideran frescos por el mismo tiempo que tarda el sondeo: al volver al tablero
 * (navegación SPA) no se repiten las consultas que acaban de resolverse.
 */
const FRESH = { staleTime: LIVE } as const;

export const useRecentActivity = (enabled: boolean) =>
  useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => supabaseDashboardRepository.getRecentActivity(15),
    enabled,
    refetchInterval: LIVE,
    ...FRESH,
  });

export const useAlertsSummary = (enabled = true) =>
  useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: () => supabaseDashboardRepository.getAlertsSummary(),
    enabled,
    refetchInterval: LIVE,
    ...FRESH,
  });

export const useAlerts = (estado?: EstadoAlerta, enabled = true) =>
  useQuery({
    queryKey: ['alerts', 'list', estado ?? 'active'],
    queryFn: () => supabaseDashboardRepository.getAlerts(estado, 15),
    enabled,
    refetchInterval: LIVE,
    ...FRESH,
    placeholderData: keepPreviousData,
  });

export const useCasesSummary = (userId: string, enabled = true) =>
  useQuery({
    queryKey: ['cases', 'summary', userId],
    queryFn: () => supabaseDashboardRepository.getCasesSummary(userId),
    enabled: enabled && Boolean(userId),
    refetchInterval: LIVE,
    ...FRESH,
  });

export const useCasesToReview = (mine: boolean, userId: string, enabled = true) =>
  useQuery({
    queryKey: ['cases', 'review', mine, userId],
    queryFn: () => supabaseDashboardRepository.getCasesToReview(mine, userId, 15),
    enabled: enabled && Boolean(userId),
    placeholderData: keepPreviousData,
  });

/** Rango del mes en curso (yyyy-MM-dd) que consulta la agenda del tablero. */
export function getAgendaRange(now = new Date()) {
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    today: isoDate(now),
  };
}

/** Citas del mes: la usan el widget Agenda y (derivada) «Citas de hoy»; comparten clave, así que es UNA llamada. */
const appointmentsQuery = (from: string, to: string) => ({
  queryKey: ['scheduling', 'appointments', from, to] as const,
  queryFn: () => supabaseDashboardRepository.getAppointments(from, to),
});

export const useAppointments = (from: string, to: string, enabled = true) =>
  useQuery({ ...appointmentsQuery(from, to), ...FRESH, enabled });

const SUMMARY_ESTADOS: readonly EstadoCita[] = ['agendada', 'confirmada', 'asistio', 'no_asistio'];

/** Citas de hoy y la próxima, calculadas con las citas ya descargadas (sin otra llamada a `get_agenda`). */
export function summarizeScheduling(items: readonly CitaItem[], now = new Date()): SchedulingSummary {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const rows = items
    .filter((c) => SUMMARY_ESTADOS.includes(c.estado) && new Date(c.programadaEn).getTime() >= startOfToday)
    .sort((a, b) => a.programadaEn.localeCompare(b.programadaEn));
  const next = rows.find(
    (c) => new Date(c.programadaEn).getTime() >= now.getTime() && c.estado !== 'asistio' && c.estado !== 'no_asistio',
  );
  return {
    today: rows.filter((c) => new Date(c.programadaEn).getTime() <= endOfToday).length,
    nextAt: next?.programadaEn ?? null,
    nextArea: next?.areaNombre ?? null,
    nextUsuaria: next?.usuariaNombre ?? null,
  };
}

/**
 * «Citas de hoy»: se deriva de la misma consulta del mes que usa el widget Agenda (una sola llamada a
 * `get_agenda`). Si el mes ya no tiene citas por venir (p. ej. fin de mes) se consulta, solo entonces, la
 * ventana de 30 días para encontrar la próxima.
 */
export function useSchedulingSummary(enabled = true) {
  const [{ from, to }] = useState(() => getAgendaRange());
  const month = useQuery({
    ...appointmentsQuery(from, to),
    ...FRESH,
    enabled,
    refetchInterval: LIVE,
    select: (items) => summarizeScheduling(items),
  });
  const needsLookahead = month.isSuccess && month.data.nextAt === null;
  const lookahead = useQuery({
    queryKey: ['scheduling', 'summary'],
    queryFn: () => supabaseDashboardRepository.getSchedulingSummary(),
    ...FRESH,
    enabled: enabled && needsLookahead,
  });

  const data =
    month.data && needsLookahead && lookahead.data
      ? { ...month.data, nextAt: lookahead.data.nextAt, nextArea: lookahead.data.nextArea, nextUsuaria: lookahead.data.nextUsuaria }
      : month.data;

  return {
    data,
    isLoading: month.isLoading || (needsLookahead && lookahead.isLoading),
    isError: month.isError,
    refetch: month.refetch,
  };
}
