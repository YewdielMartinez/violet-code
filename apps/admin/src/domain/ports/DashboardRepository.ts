import type {
  AlertsSummary,
  AlertaItem,
  AuditEvent,
  CaseItem,
  CasesSummary,
  CitaItem,
  EstadoAlerta,
  MapaCalorAsentamientoItem,
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
  /** Consulta agregados por asentamiento vía `get_mapa_calor_asentamiento` (umbral mínimo por defecto 3). */
  mapaCalor(umbralMinimo?: number): Promise<MapaCalorAsentamientoItem[]>;
}
