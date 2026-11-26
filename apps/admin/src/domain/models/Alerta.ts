import type { Database } from '@/infrastructure/supabase/database.types';
import type { StaffRole } from './Auth';

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

export const PRIORIDAD_ALERTA_LABELS: Record<PrioridadAlerta, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export const PRIORIDAD_ALERTA_ORDEN: Record<PrioridadAlerta, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

const LINEA_24_7_ROLES: readonly StaffRole[] = ['titular', 'subdireccion', 'juridico'];
const COLA_ALERTAS_ROLES: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'juridico',
  'trabajo_social',
  'psicologia',
];

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

export interface AlertaDetalleExtra {
  alertaId: string;
  atendidaEn: string | null;
  observaciones: string | null;
  actualizadoEn: string;
}

export interface AlertaEstadoResult {
  alertaId: string;
  estado: EstadoAlerta;
  tomadaEn: string | null;
  atendidaEn: string | null;
  atendidaPor: string;
}

export type AlertaCambioTipo = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AlertaCambioEvento {
  eventType: AlertaCambioTipo;
  alertaId: string;
  prioridad: PrioridadAlerta | null;
  estado: EstadoAlerta | null;
  origen: OrigenAlerta | null;
}

const VALID_ALERTA_TRANSITIONS: Record<EstadoAlerta, readonly EstadoAlerta[]> = {
  nueva: ['tomada'],
  tomada: ['atendida'],
  atendida: [],
};

/**
 * Permiso `alerta.ver_cola` (`07_rls.sql` / `15_permisos_rbac_abac.sql`):
 * Línea 24/7 + Trabajo Social + Psicología. `recepcion` y `umeca` no tienen acceso.
 */
export function puedeVerColaAlertas(rol: StaffRole | undefined | null): boolean {
  return rol !== undefined && rol !== null && COLA_ALERTAS_ROLES.includes(rol);
}

/**
 * Permiso `alerta.atender` (`RN-16`, `07_rls.sql`):
 * Únicamente roles de Línea 24/7 (`titular`, `subdireccion`, `juridico`).
 */
export function puedeAtenderAlertas(rol: StaffRole | undefined | null): boolean {
  return rol !== undefined && rol !== null && LINEA_24_7_ROLES.includes(rol);
}

/**
 * Ordena la cola de alertas por prioridad (`alta` → `media` → `baja`) y luego por
 * fecha de creación ascendente (más antigua primero dentro de la misma prioridad).
 */
export function ordenarColaAlertas(items: readonly ColaAlertaItem[]): ColaAlertaItem[] {
  return [...items].sort((a, b) => {
    const pDiff = PRIORIDAD_ALERTA_ORDEN[a.prioridad] - PRIORIDAD_ALERTA_ORDEN[b.prioridad];
    if (pDiff !== 0) return pDiff;

    const tA = Date.parse(a.creadoEn);
    const tB = Date.parse(b.creadoEn);
    if (!Number.isNaN(tA) && !Number.isNaN(tB) && tA !== tB) {
      return tA - tB;
    }

    const cmpFecha = a.creadoEn.localeCompare(b.creadoEn);
    if (cmpFecha !== 0) return cmpFecha;

    return a.alertaId.localeCompare(b.alertaId);
  });
}

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
