import type { Database } from '@/infrastructure/supabase/database.types';
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
  registradaEn: string;
  avisoPrivacidadAceptadoEn: string;
  estadoCivil: EstadoCivil | null;
  ocupacionNombre: string | null;
  servicioMedico: ServicioMedico | null;
  servicioMedicoOtro: string | null;
  tieneTrabajo: boolean | null;
  numeroHijas: number | null;
  numeroHijosHombres: number | null;
  tieneEmbarazo: boolean | null;
  tieneDenuncia: boolean | null;
  esVictimaDelito: boolean | null;
  serviciosSolicitados: string[];
  persona: PersonaResumen;
  domicilio: DomicilioDetalle | null;
  estudio: EstudioSocioeconomicoDetalle | null;
}

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
  avisoPrivacidadAceptado: false,
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
  if (input.servicioMedico === 'otro' && !input.servicioMedicoOtro.trim()) {
    return 'Especifica el servicio médico cuando selecciones «Otro».';
  }
  if (input.serviciosSolicitadosAreaIds.length === 0) {
    return 'Selecciona al menos un área o servicio solicitado.';
  }
  if (!input.avisoPrivacidadAceptado) {
    return 'Es obligatorio registrar la aceptación del Aviso de Privacidad (RNF-04).';
  }
  return null;
}
