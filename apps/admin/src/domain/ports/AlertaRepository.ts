import type {
  AlertaCambioEvento,
  AlertaDetalleExtra,
  AlertaEstadoResult,
  ColaAlertaItem,
  EstadoAlerta,
} from '../models/Alerta';

export type AlertaRealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export interface AlertaRepository {
  listarCola(estados?: EstadoAlerta[] | null, limite?: number): Promise<ColaAlertaItem[]>;
  obtenerDetalle(alertaId: string): Promise<AlertaDetalleExtra | null>;
  tomar(alertaId: string): Promise<AlertaEstadoResult>;
  atender(alertaId: string, observaciones?: string | null): Promise<AlertaEstadoResult>;
  suscribirCambios(
    onChange: (evento?: AlertaCambioEvento) => void,
    onStatus?: (status: AlertaRealtimeStatus) => void,
  ): () => void;
}
