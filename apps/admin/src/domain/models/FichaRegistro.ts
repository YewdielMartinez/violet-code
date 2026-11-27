import type { Database } from '@/infrastructure/supabase/database.types';
import type { TipoDroga } from './Agresor';
import type { StaffRole } from './Auth';
import type { PrioridadNivel } from './Cita';
import type { DomicilioDetalle, DomicilioInput } from './Domicilio';
import type {
  EstudioSocioeconomicoDetalle,
  EstudioSocioeconomicoInput,
} from './EstudioSocioeconomico';
import { isValidCurp, normalizeCurp, type EstadoFicha, type PersonaResumen } from './Persona';
import type { PreRegistroMovil } from './PreRegistroMovil';

export type EstadoCivil = Database['public']['Enums']['estado_civil'];
export type EscolaridadNivel = Database['public']['Enums']['escolaridad_nivel'];
export type ServicioMedico = Database['public']['Enums']['servicio_medico'];
export type ConsumoAlcohol = Database['public']['Enums']['consumo_alcohol'];

export const ESTADO_CIVIL_LABELS: Record<EstadoCivil, string> = {
  soltero: 'Soltera(o)',
  casado: 'Casada(o)',
  union_libre: 'Unión libre',
  separado: 'Separada(o)',
  divorciado: 'Divorciada(o)',
  viudo: 'Viuda(o)',
};

export const ESCOLARIDAD_LABELS: Record<EscolaridadNivel, string> = {
  ninguna: 'Ninguna',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  preparatoria: 'Preparatoria',
  carrera: 'Carrera profesional',
  otros_estudios: 'Otros estudios',
};

export const SERVICIO_MEDICO_LABELS: Record<ServicioMedico, string> = {
  ninguno: 'Ninguno',
  imss: 'IMSS',
  issste: 'ISSSTE',
  imss_bienestar: 'IMSS Bienestar',
  particular: 'Particular',
  otro: 'Otro',
};

export const CONSUMO_ALCOHOL_LABELS: Record<ConsumoAlcohol, string> = {
  no_consume: 'No consume',
  ocasional: 'Ocasional',
  frecuente: 'Frecuente',
};

const EDIT_EXPEDIENTE_ROLES: readonly StaffRole[] = ['titular', 'subdireccion', 'trabajo_social'];
const PRIORIDAD_ROLES: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'trabajo_social',
  'psicologia',
  'juridico',
];
const HISTORIAL_CLINICO_ROLES: readonly StaffRole[] = ['psicologia'];

/** Solo Titular, Subdirección y Trabajo Social editan datos generales, ficha, domicilio y estudio (`expediente.escribir`). */
export function puedeEditarExpediente(role: StaffRole | undefined): boolean {
  return role !== undefined && EDIT_EXPEDIENTE_ROLES.includes(role);
}

/** Todos los roles con acceso al expediente (menos Recepción y UMECA) pueden cambiar su prioridad. */
export function puedeCambiarPrioridad(role: StaffRole | undefined): boolean {
  return role !== undefined && PRIORIDAD_ROLES.includes(role);
}

/** Solo Psicología accede al historial clínico (`historial_clinico.acceder`). */
export function puedeAccederHistorialClinico(role: StaffRole | undefined): boolean {
  return role !== undefined && HISTORIAL_CLINICO_ROLES.includes(role);
}

export interface CatalogoItem {
  id: number;
  clave: string;
  nombre: string;
}

export interface CatalogosFicha {
  areas: CatalogoItem[];
  ocupaciones: CatalogoItem[];
  parentescos: CatalogoItem[];
}

export interface FichaIdentidadInput {
  /** Si viene de `persona_sin_ficha`, evita insertar de nuevo en `persona`. */
  existingPersonaId: string | null;
  curp: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular: string;
  escolaridad: EscolaridadNivel | '';
  discapacidad: string;
  grupoEtnico: string;
  religion: string;
  estadoCivil: EstadoCivil | '';
  ocupacionId: number | null;
  ocupacionOtra: string;
  tieneTrabajo: boolean;
  numeroHijas: string;
  numeroHijosHombres: string;
  servicioMedico: ServicioMedico | '';
  servicioMedicoOtro: string;
  tieneEmbarazo: boolean;
  tieneDenuncia: boolean;
  esVictimaDelito: boolean;
  serviciosSolicitadosAreaIds: number[];
  /** Servicio fuera del catálogo de áreas (texto libre, no genera canalización). */
  serviciosSolicitadosOtro: string;
  avisoPrivacidadAceptado: boolean;
}

export interface FichaCreateInput {
  identidad: FichaIdentidadInput;
  domicilio: DomicilioInput;
  estudio: EstudioSocioeconomicoInput;
}

export interface FichaCompletaDetalle {
  id: string;
  folio: string;
  estado: EstadoFicha;
  prioridad: PrioridadNivel | null;
  prioridadActualizadaEn: string | null;
  registradaEn: string;
  actualizadoEn: string | null;
  avisoPrivacidadAceptadoEn: string;
  estadoCivil: EstadoCivil | null;
  ocupacionId: number | null;
  ocupacionNombre: string | null;
  ocupacionOtra: string | null;
  servicioMedico: ServicioMedico | null;
  servicioMedicoOtro: string | null;
  tieneTrabajo: boolean | null;
  numeroHijas: number | null;
  numeroHijosHombres: number | null;
  tieneEmbarazo: boolean | null;
  tieneDenuncia: boolean | null;
  esVictimaDelito: boolean | null;
  drogas: TipoDroga[];
  especificacionDroga: string | null;
  consumoAlcohol: ConsumoAlcohol | null;
  serviciosSolicitados: string[];
  serviciosSolicitadosAreaIds: number[];
  serviciosSolicitadosOtro: string | null;
  persona: PersonaResumen & {
    escolaridad: EscolaridadNivel | null;
    discapacidad: string | null;
    grupoEtnico: string | null;
    religion: string | null;
    actualizadoEn: string | null;
  };
  domicilio: DomicilioDetalle | null;
  estudio: EstudioSocioeconomicoDetalle | null;
}

export type CampoSinDatoFicha =
  | 'estado_civil'
  | 'ocupacion_id'
  | 'tiene_trabajo'
  | 'numero_hijas'
  | 'numero_hijos_hombres'
  | 'servicio_medico'
  | 'tiene_embarazo'
  | 'tiene_denuncia'
  | 'es_victima_delito'
  | 'drogas'
  | 'consumo_alcohol';

export interface FichaUpdateInput {
  fichaId: string;
  actualizadoEn: string;
  estadoCivil?: EstadoCivil | null;
  ocupacionId?: number | null;
  ocupacionOtra?: string | null;
  tieneTrabajo?: boolean | null;
  numeroHijas?: number | null;
  numeroHijosHombres?: number | null;
  servicioMedico?: ServicioMedico | null;
  servicioMedicoOtro?: string | null;
  tieneEmbarazo?: boolean | null;
  tieneDenuncia?: boolean | null;
  esVictimaDelito?: boolean | null;
  drogas?: TipoDroga[] | null;
  especificacionDroga?: string | null;
  consumoAlcohol?: ConsumoAlcohol | null;
  serviciosSolicitadosAreaIds?: number[] | null;
  serviciosSolicitadosOtro?: string | null;
  camposSinDato?: CampoSinDatoFicha[] | null;
}

export interface FichaActualizada {
  id: string;
  folio: string;
  personaId: string;
  estado: EstadoFicha;
  estadoCivil: EstadoCivil | null;
  ocupacionId: number | null;
  ocupacionOtra: string | null;
  tieneTrabajo: boolean | null;
  numeroHijas: number | null;
  numeroHijosHombres: number | null;
  servicioMedico: ServicioMedico | null;
  servicioMedicoOtro: string | null;
  tieneEmbarazo: boolean | null;
  tieneDenuncia: boolean | null;
  esVictimaDelito: boolean | null;
  drogas: TipoDroga[] | null;
  especificacionDroga: string | null;
  consumoAlcohol: ConsumoAlcohol | null;
  serviciosSolicitadosAreaIds: number[];
  serviciosSolicitadosOtro: string | null;
  actualizadoEn: string;
}

export interface CambiarPrioridadExpedienteResult {
  fichaId: string;
  prioridad: PrioridadNivel;
  prioridadActualizadaEn: string;
}

/** Valor de la opción «Otro (especifica)» en el selector de servicios solicitados. */
export const SERVICIO_SOLICITADO_OTRO = 'otro';
export const SERVICIO_SOLICITADO_OTRO_LABEL = 'Otro (especifica)';

export const INITIAL_FICHA_IDENTIDAD: FichaIdentidadInput = {
  existingPersonaId: null,
  curp: '',
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  celular: '',
  escolaridad: '',
  discapacidad: '',
  grupoEtnico: '',
  religion: '',
  estadoCivil: '',
  ocupacionId: null,
  ocupacionOtra: '',
  tieneTrabajo: false,
  numeroHijas: '0',
  numeroHijosHombres: '0',
  servicioMedico: 'ninguno',
  servicioMedicoOtro: '',
  tieneEmbarazo: false,
  tieneDenuncia: false,
  esVictimaDelito: false,
  serviciosSolicitadosAreaIds: [],
  serviciosSolicitadosOtro: '',
  avisoPrivacidadAceptado: true,
};

export function createIdentidadFromPreRegistro(
  pre?: PreRegistroMovil | null,
  initialCurp?: string,
): FichaIdentidadInput {
  if (!pre) {
    return {
      ...INITIAL_FICHA_IDENTIDAD,
      curp: initialCurp ? normalizeCurp(initialCurp) : '',
    };
  }
  return {
    ...INITIAL_FICHA_IDENTIDAD,
    esVictimaDelito: false,
    serviciosSolicitadosAreaIds: [],
    avisoPrivacidadAceptado: true,
    existingPersonaId: pre.personaId,
    curp: pre.curp,
    nombres: pre.nombres,
    apellidoPaterno: pre.apellidoPaterno,
    apellidoMaterno: pre.apellidoMaterno ?? '',
    celular: pre.celular ?? '',
  };
}

const CELULAR_REGEX = /^[0-9]{10}$/;

/** Valida los campos obligatorios de Identidad + Aviso de Privacidad (`RNF-04`, `RF-01`). */
export function validateFichaIdentidad(input: FichaIdentidadInput): string | null {
  if (!isValidCurp(input.curp)) {
    return 'La CURP debe tener los 18 caracteres del formato oficial.';
  }
  if (!input.nombres.trim() || !input.apellidoPaterno.trim()) {
    return 'Nombre(s) y apellido paterno son obligatorios.';
  }
  if (input.celular.trim() && !CELULAR_REGEX.test(input.celular.trim())) {
    return 'El teléfono celular debe tener exactamente 10 dígitos.';
  }
  if (!input.estadoCivil) {
    return 'Selecciona el estado civil.';
  }
  if (input.ocupacionId === null) {
    return 'Selecciona la ocupación.';
  }
  if (!input.escolaridad) {
    return 'Selecciona la escolaridad.';
  }
  if (input.servicioMedico === 'otro' && !input.servicioMedicoOtro.trim()) {
    return 'Especifica el servicio médico cuando selecciones «Otro».';
  }
  if (input.serviciosSolicitadosAreaIds.length === 0 && !input.serviciosSolicitadosOtro.trim()) {
    return 'Selecciona al menos un área o especifica otro servicio solicitado.';
  }
  if (!input.avisoPrivacidadAceptado) {
    return 'Es obligatorio registrar la aceptación del Aviso de Privacidad (RNF-04).';
  }
  return null;
}
