import type { StaffRole } from '@/domain/models/Auth';
import { areasCreablesPorRol } from '@/domain/models/Cita';

/**
 * Regla única de alta de citas (definida en `domain/models/Cita`):
 * Recepción agenda en Trabajo Social, Psicología y Jurídico; Jurídico y Psicología, solo en la suya;
 * Dirección y Subdirección, en todas; Trabajo Social no agenda.
 * Reagendar y agendar la siguiente cita siguen la misma regla porque crean una cita nueva.
 */
export { areasCreablesPorRol };

/** `true` si el rol puede crear citas (y, por tanto, reagendar o agendar la siguiente). */
export function puedeCrearCita(rol: StaffRole | undefined): boolean {
  return areasCreablesPorRol(rol).length > 0;
}

/** `true` si el rol puede crear una cita en el área indicada por su clave. */
export function puedeCrearEnArea(rol: StaffRole | undefined, areaClave: string): boolean {
  return areasCreablesPorRol(rol).includes(areaClave);
}
