import { isSupervisor, type StaffRole } from './Auth';

/** Longitud máxima de `nota_area.contenido` (`CHECK char_length between 1 and 5000`). */
export const NOTA_PRIVADA_MAX_LENGTH = 5000;

/**
 * Nota privada de un área sobre un expediente (`RF-10`, `RN-09`, `RN-18.1`).
 * Trabajo Social y Jurídico leen y editan las suyas; Titular y Subdirección leen las de TS y Jurídico en solo lectura.
 * Las notas de Psicología son exclusivas del rol Psicología y se muestran dentro del Historial clínico (migración 71).
 */
export interface NotaPrivada {
  id: string;
  fichaId: string;
  areaId: number;
  areaNombre: string | null;
  contenido: string;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string | null;
}

export interface NotaPrivadaCreateInput {
  fichaId: string;
  areaId: number;
  contenido: string;
}

export interface NotaPrivadaUpdateInput {
  id: string;
  contenido: string;
}

/**
 * Pestaña «Notas privadas» del expediente: Trabajo Social y Jurídico ven las suyas; Titular y Subdirección ven las de TS y
 * Jurídico en solo lectura. Psicología no la usa: sus notas viven en el Historial clínico.
 */
export function puedeVerNotasPrivadas(role: StaffRole | undefined): boolean {
  return role === 'trabajo_social' || role === 'juridico' || isSupervisor(role);
}

/** Solo Trabajo Social y Jurídico gestionan notas en la pestaña «Notas privadas» (permiso `seguimiento.registrar`). */
export function puedeGestionarNotasPrivadas(role: StaffRole | undefined): boolean {
  return role === 'trabajo_social' || role === 'juridico';
}

/** Las notas privadas de Psicología solo las ve y escribe el rol Psicología (`nota_psicologia.acceder`, RLS de `nota_area`). */
export function puedeVerNotasPsicologia(role: StaffRole | undefined): boolean {
  return role === 'psicologia';
}

/** Valida el contenido de una nota antes de enviarla (`nota_area.contenido`). */
export function validateNotaPrivada(contenido: string): string | null {
  const limpio = contenido.trim();
  if (!limpio) {
    return 'Escribe el contenido de la nota.';
  }
  if (limpio.length > NOTA_PRIVADA_MAX_LENGTH) {
    return `La nota no puede exceder ${NOTA_PRIVADA_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/** Ordena las notas de la más reciente a la más antigua (por última edición). */
export function ordenarNotasRecientes(notas: readonly NotaPrivada[]): NotaPrivada[] {
  return [...notas].sort(
    (a, b) => Date.parse(b.actualizadoEn || b.creadoEn) - Date.parse(a.actualizadoEn || a.creadoEn),
  );
}
