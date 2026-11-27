import { isAttentionRole, isSupervisor, type StaffRole } from './Auth';

/** Longitud máxima de `nota_area.contenido` (`CHECK char_length between 1 and 5000`). */
export const NOTA_PRIVADA_MAX_LENGTH = 5000;

/**
 * Nota privada de un área sobre un expediente (`RF-10`, `RN-09`, `RN-18.1`).
 * Cada área de atención lee y edita solo las suyas; Titular y Subdirección leen las de todas las áreas en solo lectura.
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

/** Trabajo Social, Psicología y Jurídico ven las suyas; Titular y Subdirección ven todas en solo lectura. */
export function puedeVerNotasPrivadas(role: StaffRole | undefined): boolean {
  return isAttentionRole(role) || isSupervisor(role);
}

/** Solo Trabajo Social, Psicología y Jurídico gestionan notas de área (permiso `seguimiento.registrar`). */
export function puedeGestionarNotasPrivadas(role: StaffRole | undefined): boolean {
  return isAttentionRole(role);
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
