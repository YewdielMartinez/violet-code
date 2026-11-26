import type {
  LineaTiempoEvento,
  SeguimientoCreateInput,
  SeguimientoResult,
} from '../models/Seguimiento';

export interface SeguimientoRepository {
  /** Registra asistencia, hoja de seguimiento y próxima cita opcional en una transacción (`RF-09`). */
  registrar(input: SeguimientoCreateInput): Promise<SeguimientoResult>;
  /** Consulta la línea de tiempo cronológica del expediente filtrada por rol (`RF-25`, `RN-18`). */
  getLineaTiempo(fichaId: string): Promise<LineaTiempoEvento[]>;
}
