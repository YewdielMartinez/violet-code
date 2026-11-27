import type { StaffRole } from '@/domain/models/Auth';

/**
 * Roles con `informe.ver`: Dirección ve todas las áreas; Trabajo Social, Psicología y Jurídico solo las filas de su
 * área (el servidor ya las filtra). Recepción y UMECA no tienen el permiso (42501): el panel no se monta.
 */
const ROLES_INFORME: readonly StaffRole[] = ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'];

export function puedeVerInformes(role: StaffRole | undefined | null): boolean {
  return role !== undefined && role !== null && ROLES_INFORME.includes(role);
}
