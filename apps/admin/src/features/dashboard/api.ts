import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

// ── Contratos (espejo de los DTO de Core: módulos Audit, Alerts, Cases, Scheduling) ──

export interface AuditEvent {
  id: string;
  occurredAt: string;
  action: string;
  resource: string;
  actorName: string | null;
  details: string | null;
}

export type AlertStatus = 'New' | 'InProgress' | 'Closed';
export type Priority = 'High' | 'Medium' | 'Low';

export interface Alert {
  id: string;
  folio: string;
  createdAt: string;
  status: AlertStatus;
  priority: Priority;
  channel: 'App' | 'Phone' | 'WalkIn';
  colonia: string;
  assignedToName: string | null;
}

export interface AlertsSummary {
  active: number;
  newToday: number;
  inProgress: number;
  closedThisWeek: number;
  byDay: { date: string; count: number }[];
}

export interface CaseFile {
  id: string;
  folio: string;
  alias: string;
  status: 'Open' | 'InAttention' | 'Referred' | 'Closed';
  area: 'Psicologia' | 'Juridico' | 'TrabajoSocial' | 'Coordinacion';
  riskLevel: Priority;
  assignedToName: string | null;
  updatedAt: string;
  needsReview: boolean;
}

export interface CasesSummary {
  open: number;
  needsReview: number;
  highRisk: number;
  mine: number;
}

export interface Appointment {
  id: string;
  caseFolio: string;
  startsAt: string;
  durationMinutes: number;
  kind: 'Psicologica' | 'Juridica' | 'Seguimiento' | 'Visita';
  professionalName: string;
  status: 'Scheduled' | 'Done' | 'Cancelled';
}

export interface SchedulingSummary {
  today: number;
  nextAt: string | null;
  nextCaseFolio: string | null;
  byDate: { date: string; count: number }[];
}

// ── Consultas. Refresco periódico: el dashboard es la "bandeja" del equipo. ──

const LIVE = 30_000;

export const useRecentActivity = (enabled: boolean) =>
  useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => api<AuditEvent[]>('/api/audit/events?take=8'),
    enabled,
    refetchInterval: LIVE,
  });

export const useAlertsSummary = () =>
  useQuery({ queryKey: ['alerts', 'summary'], queryFn: () => api<AlertsSummary>('/api/alerts/summary'), refetchInterval: LIVE });

export const useAlerts = (status?: AlertStatus) =>
  useQuery({
    queryKey: ['alerts', 'list', status ?? 'active'],
    queryFn: () => api<Alert[]>(`/api/alerts?take=8${status ? `&status=${status}` : ''}`),
    refetchInterval: LIVE,
    // Al cambiar de filtro se queda la lista anterior hasta que llega la nueva (sin parpadeo) y se reacomoda.
    placeholderData: keepPreviousData,
  });

export const useCasesSummary = () =>
  useQuery({ queryKey: ['cases', 'summary'], queryFn: () => api<CasesSummary>('/api/cases/summary'), refetchInterval: LIVE });

export const useCasesToReview = (mine: boolean) =>
  useQuery({
    queryKey: ['cases', 'review', mine],
    queryFn: () => api<CaseFile[]>(`/api/cases?needsReview=true&take=6${mine ? '&mine=true' : ''}`),
    placeholderData: keepPreviousData,
  });

export const useSchedulingSummary = () =>
  useQuery({ queryKey: ['scheduling', 'summary'], queryFn: () => api<SchedulingSummary>('/api/scheduling/summary') });

export const useAppointments = (from: string, to: string, mine: boolean) =>
  useQuery({
    queryKey: ['scheduling', 'appointments', from, to, mine],
    queryFn: () => api<Appointment[]>(`/api/scheduling/appointments?from=${from}&to=${to}${mine ? '&mine=true' : ''}`),
  });
