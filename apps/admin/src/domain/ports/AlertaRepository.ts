import type { AlertaEstadoResult, ColaAlertaItem, EstadoAlerta } from '../models/Alerta';

export interface AlertaRepository {
  listarCola(estados?: EstadoAlerta[] | null, limite?: number): Promise<ColaAlertaItem[]>;
  tomar(alertaId: string): Promise<AlertaEstadoResult>;
  atender(alertaId: string, observaciones?: string | null): Promise<AlertaEstadoResult>;
}
