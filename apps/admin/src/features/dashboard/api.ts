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

export const useRecentActivity = (enabled: boolean) =>
  useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => supabaseDashboardRepository.getRecentActivity(8),
    enabled,
    refetchInterval: LIVE,
  });

export const useAlertsSummary = (enabled = true) =>
  useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: () => supabaseDashboardRepository.getAlertsSummary(),
    enabled,
    refetchInterval: LIVE,
  });

export const useAlerts = (estado?: EstadoAlerta, enabled = true) =>
  useQuery({
    queryKey: ['alerts', 'list', estado ?? 'active'],
    queryFn: () => supabaseDashboardRepository.getAlerts(estado, 8),
    enabled,
    refetchInterval: LIVE,
    placeholderData: keepPreviousData,
  });

export const useCasesSummary = (userId: string, enabled = true) =>
  useQuery({
    queryKey: ['cases', 'summary', userId],
    queryFn: () => supabaseDashboardRepository.getCasesSummary(userId),
    enabled: enabled && Boolean(userId),
    refetchInterval: LIVE,
  });

export const useCasesToReview = (mine: boolean, userId: string, enabled = true) =>
  useQuery({
    queryKey: ['cases', 'review', mine, userId],
    queryFn: () => supabaseDashboardRepository.getCasesToReview(mine, userId, 6),
    enabled: enabled && Boolean(userId),
    placeholderData: keepPreviousData,
  });

export const useSchedulingSummary = (enabled = true) =>
  useQuery({
    queryKey: ['scheduling', 'summary'],
    queryFn: () => supabaseDashboardRepository.getSchedulingSummary(),
    enabled,
    refetchInterval: LIVE,
  });

export const useAppointments = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ['scheduling', 'appointments', from, to],
    queryFn: () => supabaseDashboardRepository.getAppointments(from, to),
    enabled,
  });
