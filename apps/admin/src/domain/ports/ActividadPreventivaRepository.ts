import type {
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
  ActividadPreventivaItem,
  ActividadRegistradaResult,
} from '../models/ActividadPreventiva';

export interface ActividadPreventivaRepository {
  /** Lista actividades preventivas activas por rango con asentamiento y participantes (`RF-16`). */
  list(filters?: ActividadPreventivaFilters): Promise<ActividadPreventivaItem[]>;
  /** Registra una actividad preventiva y sus empleados participantes en una transacción (`RF-16`). */
  registrar(input: ActividadPreventivaCreateInput): Promise<ActividadRegistradaResult>;
}
