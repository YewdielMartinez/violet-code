import type { Database } from '@/infrastructure/supabase/database.types';
import { isAttentionRole, isSupervisor, type StaffRole } from './Auth';

export type TipoDroga = Database['public']['Enums']['tipo_droga'];

export const TIPOS_DROGA: readonly TipoDroga[] = [
  'marihuana',
  'cristal',
  'cocaina',
  'inhalantes',
  'medicamento_controlado',
  'otra',
];

export const DROGA_LABELS: Record<TipoDroga, string> = {
  marihuana: 'Marihuana',
  cristal: 'Cristal',
  cocaina: 'Cocaína',
  inhalantes: 'Inhalantes',
  medicamento_controlado: 'Medicamento controlado',
  otra: 'Otra',
};

export interface CatalogoOpcion {
  id: number;
  clave: string;
  nombre: string;
}

export interface AsentamientoOpcion {
  id: number;
  nombre: string;
  tipoAsentamiento: string;
  codigoPostal: string;
  localidad: string | null;
}

export interface Agresor {
  id: string;
  fichaId: string;
  nombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  parentescoId: number | null;
  parentescoOtro: string | null;
  asentamientoId: number | null;
  codigoPostal: string | null;
  calle: string | null;
  numeroExterior: string | null;
  numeroInterior: string | null;
  referencias: string | null;
  ocupacionId: number | null;
  ocupacionOtra: string | null;
  tieneConsumoDroga: boolean | null;
  drogas: TipoDroga[] | null;
  especificacionDroga: string | null;
  especificacionArma: string | null;
  observaciones: string | null;
  activo: boolean;
  actualizadoEn: string;
}

export interface AgresorInput {
  fichaId: string;
  nombres: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  parentescoId?: number | null;
  parentescoOtro?: string | null;
  asentamientoId?: number | null;
  codigoPostal?: string | null;
  calle?: string | null;
  numeroExterior?: string | null;
  numeroInterior?: string | null;
  referencias?: string | null;
  ocupacionId?: number | null;
  ocupacionOtra?: string | null;
  tieneConsumoDroga?: boolean | null;
  drogas?: TipoDroga[] | null;
  especificacionDroga?: string | null;
  especificacionArma?: string | null;
  observaciones?: string | null;
  /** Marca temporal leída al abrir el registro para bloqueo optimista en actualizaciones. */
  actualizadoEnEsperado?: string;
}

export type AgresorValidationField =
  | 'nombres'
  | 'apellidoPaterno'
  | 'apellidoMaterno'
  | 'parentescoOtro'
  | 'asentamientoId'
  | 'codigoPostal'
  | 'calle'
  | 'numeroExterior'
  | 'numeroInterior'
  | 'referencias'
  | 'ocupacionOtra'
  | 'drogas'
  | 'especificacionDroga'
  | 'especificacionArma'
  | 'observaciones';

export interface ValidacionAgresorResult {
  valido: boolean;
  errores: Partial<Record<AgresorValidationField, string>>;
}

const CP_REGEX = /^[0-9]{5}$/;
const DROGA_SET = new Set<string>(TIPOS_DROGA);

/**
 * Permiso `agresor.acceder` definido en `07_rls.sql`:
 * Dirección (`titular`, `subdireccion`) y áreas de atención (`trabajo_social`, `psicologia`, `juridico`).
 * `recepcion` y `umeca` NO tienen acceso.
 */
export function puedeAccederAgresor(rol: StaffRole | undefined): boolean {
  return isSupervisor(rol) || isAttentionRole(rol);
}

export function isTipoDroga(value: string): value is TipoDroga {
  return DROGA_SET.has(value);
}

export function formatAgresorNombre(agresor: Pick<Agresor, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'>): string {
  return [agresor.nombres, agresor.apellidoPaterno, agresor.apellidoMaterno]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

function trimmedText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/** Validaciones puras espejadas contra las restricciones CHECK de `public.agresor`. */
export function validarAgresor(input: AgresorInput): ValidacionAgresorResult {
  const errores: Partial<Record<AgresorValidationField, string>> = {};

  const nombres = trimmedText(input.nombres);
  if (nombres.length < 1) {
    errores.nombres = 'El nombre es obligatorio.';
  } else if (nombres.length > 100) {
    errores.nombres = 'El nombre no puede exceder 100 caracteres.';
  }

  if ((input.apellidoPaterno?.length ?? 0) > 100) {
    errores.apellidoPaterno = 'El apellido paterno no puede exceder 100 caracteres.';
  }
  if ((input.apellidoMaterno?.length ?? 0) > 100) {
    errores.apellidoMaterno = 'El apellido materno no puede exceder 100 caracteres.';
  }
  if ((input.parentescoOtro?.length ?? 0) > 120) {
    errores.parentescoOtro = 'La especificación de parentesco no puede exceder 120 caracteres.';
  }

  const cp = trimmedText(input.codigoPostal);
  const tieneAsentamiento = input.asentamientoId !== null && input.asentamientoId !== undefined;
  const tieneCp = cp.length > 0;

  if (tieneCp && !CP_REGEX.test(cp)) {
    errores.codigoPostal = 'El código postal debe tener exactamente 5 dígitos.';
  }
  if (tieneAsentamiento && tieneCp) {
    errores.codigoPostal =
      'Selecciona una colonia del catálogo o captura un código postal manual, no ambos.';
  }

  if ((input.calle?.length ?? 0) > 150) {
    errores.calle = 'La calle no puede exceder 150 caracteres.';
  }
  if ((input.numeroExterior?.length ?? 0) > 30) {
    errores.numeroExterior = 'El número exterior no puede exceder 30 caracteres.';
  }
  if ((input.numeroInterior?.length ?? 0) > 30) {
    errores.numeroInterior = 'El número interior no puede exceder 30 caracteres.';
  }
  if ((input.referencias?.length ?? 0) > 250) {
    errores.referencias = 'Las referencias no pueden exceder 250 caracteres.';
  }
  if ((input.ocupacionOtra?.length ?? 0) > 150) {
    errores.ocupacionOtra = 'La especificación de ocupación no puede exceder 150 caracteres.';
  }

  const drogas = input.drogas ?? [];
  const especificacionDroga = trimmedText(input.especificacionDroga);
  const consumoActivo = input.tieneConsumoDroga === true;

  if (!consumoActivo && (drogas.length > 0 || especificacionDroga.length > 0)) {
    errores.drogas = 'Solo puedes indicar drogas o especificación si existe consumo de drogas.';
  } else if (drogas.some((d) => !DROGA_SET.has(d))) {
    errores.drogas = 'Una o más opciones de droga no son válidas.';
  }
  if ((input.especificacionDroga?.length ?? 0) > 250) {
    errores.especificacionDroga = 'La especificación de droga no puede exceder 250 caracteres.';
  }

  if ((input.especificacionArma?.length ?? 0) > 250) {
    errores.especificacionArma = 'La especificación de arma no puede exceder 250 caracteres.';
  }

  if ((input.observaciones?.length ?? 0) > 5000) {
    errores.observaciones = 'Las observaciones no pueden exceder 5000 caracteres.';
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
  };
}
