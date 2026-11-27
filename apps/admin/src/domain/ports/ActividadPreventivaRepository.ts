import type {
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
  ActividadPreventivaItem,
  ActividadRegistradaResult,
  EmpleadoParticipanteOpcion,
  TipoActividadItem,
} from '../models/ActividadPreventiva';
import type { ActividadEstadoCambioInput, ActividadEstadoCambioResult } from '../models/ActividadEstado';

export interface ActividadPreventivaRepository {
  /** Lista actividades preventivas activas por rango y estado, con asentamiento y participantes (`RF-16`). */
  list(filters?: ActividadPreventivaFilters): Promise<ActividadPreventivaItem[]>;
  /** Registra una actividad preventiva y sus empleados participantes en una transacción (`RF-16`). */
  registrar(input: ActividadPreventivaCreateInput): Promise<ActividadRegistradaResult>;
  /** Cambia el estado (`actualizar_estado_actividad`): realizar, cancelar o reabrir. Requiere `actividad.registrar`. */
  actualizarEstado(input: ActividadEstadoCambioInput): Promise<ActividadEstadoCambioResult>;
  /** Catálogo `cat_tipo_actividad` (conferencia, taller, capacitación…). */
  listTipos(): Promise<TipoActividadItem[]>;
  /** Empleados activos asignables como participantes (`empleado` visible para todo el personal activo). */
  listEmpleados(): Promise<EmpleadoParticipanteOpcion[]>;
}
