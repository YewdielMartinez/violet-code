import type { StaffRole } from './Auth';
import {
  formatFullName,
  normalizeCurp,
  type ExpedienteResumen,
  type PersonaResumen,
  type SexoBiologico,
} from './Persona';

export interface PreRegistroMovil {
  preRegistroId: string;
  curp: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  nombreCompleto: string;
  sexo: SexoBiologico;
  fechaNacimiento: string;
  entidadNacimiento: string;
  celular: string | null;
  personaId: string | null;
}

export interface PreRegistroRpcRow {
  pre_registro_id: string;
  curp: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  sexo: string;
  fecha_nacimiento: string;
  entidad_nacimiento: string;
  celular: string | null;
  persona_id: string | null;
}

export type VerificacionCurpResult =
  | { kind: 'expediente_existente'; expediente: ExpedienteResumen }
  | { kind: 'persona_sin_ficha'; persona: PersonaResumen }
  | { kind: 'pre_registro_movil'; preRegistro: PreRegistroMovil }
  | { kind: 'nuevo'; curp: string };

/** Roles autorizados por `buscar_pre_registro_por_curp()` en `06_reglas_negocio.sql`. */
export function canLookupPreRegistro(role: StaffRole): boolean {
  return role === 'titular' || role === 'subdireccion' || role === 'trabajo_social';
}

export function mapPreRegistroRow(row: PreRegistroRpcRow): PreRegistroMovil {
  const apellidoMaterno = row.apellido_materno?.trim() ? row.apellido_materno.trim() : null;
  const celular = row.celular?.trim() ? row.celular.trim() : null;

  return {
    preRegistroId: row.pre_registro_id,
    curp: normalizeCurp(row.curp),
    nombres: row.nombres.trim(),
    apellidoPaterno: row.apellido_paterno.trim(),
    apellidoMaterno,
    nombreCompleto: formatFullName(row.nombres, row.apellido_paterno, apellidoMaterno),
    sexo: row.sexo === 'H' ? 'H' : 'M',
    fechaNacimiento: row.fecha_nacimiento,
    entidadNacimiento: row.entidad_nacimiento,
    celular,
    personaId: row.persona_id || null,
  };
}
