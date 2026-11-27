import type { StaffRole } from '@/domain/models/Auth';
import { REPORTE_TIPOS, type ReporteTipo } from '@/domain/models/Reporte';

/**
 * Roles con `informe.ver`: Dirección ve todas las áreas; Trabajo Social, Psicología y Jurídico solo las filas de su
 * área (el servidor ya las filtra). Recepción y UMECA no tienen el permiso (42501): la pantalla no se monta.
 */
const ROLES_INFORME: readonly StaffRole[] = ['titular', 'subdireccion', 'trabajo_social', 'psicologia', 'juridico'];
const ROLES_DIRECCION: readonly StaffRole[] = ['titular', 'subdireccion'];

export function puedeVerInformes(role: StaffRole | undefined | null): boolean {
  return role !== undefined && role !== null && ROLES_INFORME.includes(role);
}

/** Solo Dirección elige el área; los demás roles con informe quedan fijos en la suya. */
export function puedeElegirArea(role: StaffRole | undefined | null): boolean {
  return role !== undefined && role !== null && ROLES_DIRECCION.includes(role);
}

/**
 * Área que se consulta: la elegida (o todas, `null`) para Dirección; para un área de atención, SIEMPRE la suya, sin
 * importar lo elegido (el servidor aplica el mismo criterio con `auth_area_id()`).
 */
export function areaEfectiva(
  role: StaffRole | undefined | null,
  areaUsuario: number | null | undefined,
  seleccion: number | null,
): number | null {
  if (puedeElegirArea(role)) return seleccion;
  return areaUsuario ?? null;
}

/** Reportes disponibles: todos para quien tiene `informe.ver`; ninguno para Recepción y UMECA. */
export function reportesDisponibles(role: StaffRole | undefined | null): readonly ReporteTipo[] {
  return puedeVerInformes(role) ? REPORTE_TIPOS : [];
}
