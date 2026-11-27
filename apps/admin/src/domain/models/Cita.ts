import type { Database } from '@/infrastructure/supabase/database.types';
import type { StaffRole } from './Auth';

export type EstadoCita = Database['public']['Enums']['estado_cita'];
export type OrigenCita = Database['public']['Enums']['origen_cita'];
export type PrioridadNivel = Database['public']['Enums']['prioridad_nivel'];

export type EstadoCitaGestionable = 'confirmada' | 'cancelada' | 'no_asistio';

export const ESTADO_CITA_LABELS: Record<EstadoCita, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
  asistio: 'Asistió',
  no_asistio: 'No asistió',
};

export const PRIORIDAD_CITA_LABELS: Record<PrioridadNivel, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const TODAS_LAS_AREAS: readonly string[] = ['trabajo_social', 'psicologia', 'juridico'];

/**
 * Regla única de alta de citas (decisión del producto): qué áreas puede agendar cada rol.
 * Recepción agenda en Trabajo Social, Psicología y Jurídico; Jurídico y Psicología, solo en la suya;
 * Dirección y Subdirección, en todas. Trabajo Social no agenda (la siguiente cita la agenda Recepción).
 * Reagendar y la próxima cita siguen la misma regla porque crean una cita nueva.
 */
const AREAS_CREABLES: Partial<Record<StaffRole, readonly string[]>> = {
  recepcion: TODAS_LAS_AREAS,
  juridico: ['juridico'],
  psicologia: ['psicologia'],
  titular: TODAS_LAS_AREAS,
  subdireccion: TODAS_LAS_AREAS,
};

const SIN_AREAS: readonly string[] = [];

/** Claves de las áreas donde el rol puede agendar (vacío si no puede agendar). */
export function areasCreablesPorRol(rol: StaffRole | undefined): readonly string[] {
  return (rol && AREAS_CREABLES[rol]) || SIN_AREAS;
}

/** Resultado de `buscar_personas_agenda`: persona localizable al agendar (CURP enmascarada, sin datos sensibles). */
export interface PersonaAgendaItem {
  personaId: string;
  fichaId: string;
  folio: string;
  nombreCompleto: string;
  curpEnmascarada: string | null;
  celular: string | null;
}

export interface AgendaItem {
  citaId: string;
  programadaEn: string;
  estado: EstadoCita;
  prioridad: PrioridadNivel | null;
  areaId: number;
  areaClave: string;
  recomendadaPor: string | null;
  reagendadaDe: string | null;
  origen: OrigenCita;
  personaId: string;
  nombreCompleto: string;
  celular: string | null;
}

export interface AgendaQuery {
  desde: string;
  hasta: string;
  areaId?: number | null;
  estados?: EstadoCita[] | null;
  limite?: number;
}

export interface CitaCreateInput {
  personaId: string;
  areaId: number;
  programadaEn: string;
  prioridad?: PrioridadNivel | null;
  recomendadaPor?: string | null;
  origen?: OrigenCita;
}

export interface CambiarEstadoCitaResult {
  citaId: string;
  estado: EstadoCita;
  confirmadaEn: string | null;
}

export interface ReagendarCitaInput {
  citaId: string;
  nuevaFecha: string;
  motivo?: string | null;
  prioridad?: PrioridadNivel | null;
}

export interface ReagendarCitaResult {
  citaAnteriorId: string;
  citaNuevaId: string;
  programadaEn: string;
  estado: EstadoCita;
}

export interface ListaUrgenciasItem {
  personaId: string;
  fichaId: string;
  folio: string;
  nombreCompleto: string;
  celular: string | null;
  areaUltimaPrioridad: string;
  fechaUltimaPrioridad: string;
}

const VALID_CITA_TRANSITIONS: Record<EstadoCita, readonly EstadoCitaGestionable[]> = {
  agendada: ['confirmada', 'cancelada', 'no_asistio'],
  confirmada: ['cancelada', 'no_asistio'],
  cancelada: [],
  reagendada: [],
  asistio: [],
  no_asistio: [],
};

/** Valida los campos obligatorios para agendar una cita (`RF-06`). */
export function validateCitaCreate(input: CitaCreateInput): string | null {
  if (!input.personaId) {
    return 'Selecciona la persona para agendar la cita.';
  }
  if (!Number.isInteger(input.areaId) || input.areaId <= 0) {
    return 'Selecciona el área de atención.';
  }
  if (!input.programadaEn.trim() || Number.isNaN(Date.parse(input.programadaEn))) {
    return 'Indica una fecha y hora válidas para la cita.';
  }
  if (input.recomendadaPor && input.recomendadaPor.trim().length > 150) {
    return 'El campo «Quién recomendó» no puede exceder 150 caracteres.';
  }
  return null;
}

/**
 * Valida transiciones permitidas para `cambiar_estado_cita`:
 * - `agendada` -> `confirmada` | `cancelada` | `no_asistio`
 * - `confirmada` -> `cancelada` | `no_asistio`
 */
export function validarTransicionCita(
  actual: EstadoCita,
  siguiente: EstadoCitaGestionable,
  motivo?: string | null,
): string | null {
  if (actual === siguiente) {
    return 'La cita ya se encuentra en ese estado.';
  }
  if (!VALID_CITA_TRANSITIONS[actual].includes(siguiente)) {
    return `Transición no permitida: ${ESTADO_CITA_LABELS[actual]} -> ${ESTADO_CITA_LABELS[siguiente]}.`;
  }
  if (siguiente === 'cancelada' && motivo && motivo.trim().length > 500) {
    return 'El motivo de cancelación no puede exceder 500 caracteres.';
  }
  return null;
}

/** Valida los campos obligatorios al reagendar una cita (`SF-07`). */
export function validateReagendarCita(input: ReagendarCitaInput): string | null {
  if (!input.citaId) {
    return 'Selecciona la cita a reagendar.';
  }
  const parsed = Date.parse(input.nuevaFecha);
  if (!input.nuevaFecha.trim() || Number.isNaN(parsed)) {
    return 'Indica una nueva fecha y hora válidas.';
  }
  if (parsed <= Date.now()) {
    return 'La nueva fecha de la cita debe estar en el futuro.';
  }
  if (input.motivo && input.motivo.trim().length > 500) {
    return 'El motivo no puede exceder 500 caracteres.';
  }
  return null;
}
