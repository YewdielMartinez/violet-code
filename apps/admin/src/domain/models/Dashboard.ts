export type EstadoAlerta = 'nueva' | 'tomada' | 'atendida';
export type PrioridadNivel = 'alta' | 'media' | 'baja';
export type OrigenAlerta = 'app_movil' | 'telefono' | 'presencial';
export type EstadoCita = 'agendada' | 'confirmada' | 'cancelada' | 'reagendada' | 'asistio' | 'no_asistio';
export type EstadoFicha = 'abierto' | 'en_seguimiento' | 'cerrado' | 'archivado';
export type AccionBitacora = 'ver' | 'crear' | 'actualizar' | 'desactivar';

export interface AuditEvent {
  id: string;
  creadoEn: string;
  accion: AccionBitacora;
  tablaAfectada: string;
  actorNombre: string | null;
  registroId: string | null;
}

export interface AlertaItem {
  id: string;
  creadoEn: string;
  estado: EstadoAlerta;
  prioridad: PrioridadNivel;
  origen: OrigenAlerta;
  usuariaNombre: string | null;
  asentamiento: string | null;
  atendidaPorNombre: string | null;
}

export interface AlertsSummary {
  active: number;
  newToday: number;
  inProgress: number;
  closedThisWeek: number;
  byDay: { date: string; count: number }[];
}

export interface CaseItem {
  id: string;
  folio: string;
  usuariaNombre: string;
  estado: EstadoFicha;
  actualizadoEn: string;
  enListaUrgencias: boolean;
}

export interface CasesSummary {
  open: number;
  inFollowUp: number;
  urgencias: number;
  mine: number;
}

export interface CitaItem {
  id: string;
  programadaEn: string;
  estado: EstadoCita;
  prioridad: PrioridadNivel | null;
  areaClave: string | null;
  areaNombre: string;
  usuariaNombre: string;
}

export interface SchedulingSummary {
  today: number;
  nextAt: string | null;
  nextArea: string | null;
  nextUsuaria: string | null;
}
