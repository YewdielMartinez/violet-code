import type { Database } from '@/infrastructure/supabase/database.types';

export type EstadoAlerta = Database['public']['Enums']['estado_alerta'];
export type OrigenAlerta = Database['public']['Enums']['origen_alerta'];
export type PrioridadAlerta = Database['public']['Enums']['prioridad_nivel'];

export const ESTADO_ALERTA_LABELS: Record<EstadoAlerta, string> = {
  nueva: 'Nueva',
  tomada: 'En atención',
  atendida: 'Atendida',
};

export const ORIGEN_ALERTA_LABELS: Record<OrigenAlerta, string> = {
  app_movil: 'App móvil',
  telefono: 'Teléfono 24/7',
  presencial: 'Presencial',
};

export interface ColaAlertaItem {
  alertaId: string;
  origen: OrigenAlerta;
  prioridad: PrioridadAlerta;
  estado: EstadoAlerta;
  creadoEn: string;
  tomadaEn: string | null;
  atendidaPorNombre: string | null;
  personaId: string | null;
  fichaId: string | null;
  folio: string | null;
  nombreCompleto: string | null;
  celular: string | null;
  tieneOrdenVigente: boolean;
  asentamientoNombre: string | null;
}

export interface AlertaEstadoResult {
  alertaId: string;
  estado: EstadoAlerta;
  tomadaEn: string | null;
  atendidaEn: string | null;
  atendidaPor: string;
}

const VALID_ALERTA_TRANSITIONS: Record<EstadoAlerta, readonly EstadoAlerta[]> = {
  nueva: ['tomada'],
  tomada: ['atendida'],
  atendida: [],
};

/** Valida transiciones de estado permitidas en la cola de alertas (`SF-12`). */
export function validarTransicionAlerta(
  actual: EstadoAlerta,
  siguiente: EstadoAlerta,
): string | null {
  if (actual === siguiente) {
    return 'La alerta ya se encuentra en ese estado.';
  }
  if (!VALID_ALERTA_TRANSITIONS[actual].includes(siguiente)) {
    return `Transición de alerta no permitida: ${ESTADO_ALERTA_LABELS[actual]} -> ${ESTADO_ALERTA_LABELS[siguiente]}.`;
  }
  return null;
}

/** Valida la longitud máxima de observaciones al concluir una alerta. */
export function validateObservacionesAlerta(observaciones?: string | null): string | null {
  if (observaciones && observaciones.trim().length > 2000) {
    return 'Las observaciones de atención no pueden exceder 2000 caracteres.';
  }
  return null;
}
