import type {
  AlertsSummary,
  AlertaItem,
  AuditEvent,
  CaseItem,
  CasesSummary,
  CitaItem,
  EstadoAlerta,
  SchedulingSummary,
} from '../models/Dashboard';

export interface DashboardRepository {
  getRecentActivity(limit?: number): Promise<AuditEvent[]>;
  getAlertsSummary(): Promise<AlertsSummary>;
  getAlerts(estado?: EstadoAlerta, limit?: number): Promise<AlertaItem[]>;
  getCasesSummary(userId: string): Promise<CasesSummary>;
  getCasesToReview(mine: boolean, userId: string, limit?: number): Promise<CaseItem[]>;
  getSchedulingSummary(): Promise<SchedulingSummary>;
  getAppointments(fromIsoDate: string, toIsoDate: string): Promise<CitaItem[]>;
}
