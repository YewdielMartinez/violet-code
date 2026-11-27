import type { StaffRole } from '@/domain/models/Auth';

/**
 * Regla única de alta de citas (decisión del producto): solo Recepción y Jurídico agendan.
 * Recepción lo hace en Trabajo Social, Psicología y Jurídico; Jurídico, solo en Jurídico.
 * El resto de los roles (Dirección, Subdirección, Trabajo Social, Psicología, UMECA) no ve ninguna interfaz de alta.
 * Reagendar sigue la misma regla porque crea una cita nueva.
 */
const AREAS_CREABLES: Partial<Record<StaffRole, readonly string[]>> = {
  recepcion: ['trabajo_social', 'psicologia', 'juridico'],
  juridico: ['juridico'],
};

const SIN_AREAS: readonly string[] = [];

/** Claves de las áreas donde el rol puede agendar (vacío si no puede agendar). */
export function areasCreablesPorRol(rol: StaffRole | undefined): readonly string[] {
  return (rol && AREAS_CREABLES[rol]) || SIN_AREAS;
}

/** `true` si el rol puede crear citas (y, por tanto, reagendar o agendar la siguiente). */
export function puedeCrearCita(rol: StaffRole | undefined): boolean {
  return areasCreablesPorRol(rol).length > 0;
}

/** `true` si el rol puede crear una cita en el área indicada por su clave. */
export function puedeCrearEnArea(rol: StaffRole | undefined, areaClave: string): boolean {
  return areasCreablesPorRol(rol).includes(areaClave);
}
