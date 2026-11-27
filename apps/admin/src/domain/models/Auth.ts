/** Roles reales del panel web en SEMUJERES (6 internos de `empleado` + `umeca` externo). */
export type StaffRole =
  | 'titular'
  | 'subdireccion'
  | 'trabajo_social'
  | 'psicologia'
  | 'juridico'
  | 'recepcion'
  | 'umeca';

export interface StaffUser {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  areaId: number | null;
  areaClave: string | null;
  areaNombre: string | null;
  dependencia: string | null;
  activo: boolean;
  permisos: string[];
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: StaffUser;
}

export interface UmecaCita {
  citaId: string;
  programadaEn: string;
  estado: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  /** Área que atiende la cita (`area_clave` / `area_nombre` de `get_umeca_citas`); `null` si el RPC aún no la devuelve. */
  areaClave: string | null;
  areaNombre: string | null;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  titular: 'Titular / Dirección',
  subdireccion: 'Subdirección',
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
  recepcion: 'Recepción',
  umeca: 'UMECA (Externo)',
};

const SUPERVISORS: readonly StaffRole[] = ['titular', 'subdireccion'];
const ATTENTION_ROLES: readonly StaffRole[] = ['trabajo_social', 'psicologia', 'juridico'];

export const isSupervisor = (role: StaffRole | undefined): boolean =>
  role !== undefined && SUPERVISORS.includes(role);

export const isAttentionRole = (role: StaffRole | undefined): boolean =>
  role !== undefined && ATTENTION_ROLES.includes(role);
