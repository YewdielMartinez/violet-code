import {
  hasFichaAgresorData,
  toAgresorInput,
  validarAgresor,
  type AgresorValidationField,
  type CatalogoOpcion,
  type FichaAgresorInput,
} from '@/domain/models/Agresor';
import { validateDomicilio, type DomicilioInput } from '@/domain/models/Domicilio';
import {
  validateEstudioSocioeconomico,
  type EstudioSocioeconomicoInput,
} from '@/domain/models/EstudioSocioeconomico';
import {
  validateFichaIdentidad,
  type FichaIdentidadInput,
} from '@/domain/models/FichaRegistro';
import { isValidCurp } from '@/domain/models/Persona';

export interface StepValidationFailure {
  error: string;
  field: string;
}

const CELULAR_REGEX = /^[0-9]{10}$/;
const CP_REGEX = /^[0-9]{5}$/;

export function validateStepIdentidad(input: FichaIdentidadInput): StepValidationFailure | null {
  const error = validateFichaIdentidad(input);
  if (!error) return null;

  if (!isValidCurp(input.curp)) return { error, field: 'curp' };
  if (!input.nombres.trim()) return { error, field: 'nombres' };
  if (!input.apellidoPaterno.trim()) return { error, field: 'apellidoPaterno' };
  if (input.celular.trim() && !CELULAR_REGEX.test(input.celular.trim())) {
    return { error, field: 'celular' };
  }
  if (input.servicioMedico === 'otro' && !input.servicioMedicoOtro.trim()) {
    return { error, field: 'servicioMedicoOtro' };
  }
  if (input.serviciosSolicitadosAreaIds.length === 0) {
    return { error, field: 'serviciosSolicitadosAreaIds' };
  }
  return { error, field: 'avisoPrivacidadAceptado' };
}

export function validateStepDomicilio(input: DomicilioInput): StepValidationFailure | null {
  const error = validateDomicilio(input);
  if (!error) return null;

  const cp = input.codigoPostalForaneo.trim();
  if (input.asentamientoId !== null && cp.length > 0) {
    return { error, field: 'asentamientoId' };
  }
  if (input.asentamientoId === null && !cp) {
    return { error, field: 'ubicacion' };
  }
  if (input.asentamientoId === null && !CP_REGEX.test(cp)) {
    return { error, field: 'codigoPostalForaneo' };
  }
  return { error, field: 'calle' };
}

export function validateStepEstudio(
  input: EstudioSocioeconomicoInput,
): StepValidationFailure | null {
  const error = validateEstudioSocioeconomico(input);
  if (!error) return null;

  if (input.ingresoMensualPropio.trim()) {
    const ingreso = Number(input.ingresoMensualPropio);
    if (!Number.isFinite(ingreso) || ingreso < 0 || ingreso > 9_999_999.99) {
      return { error, field: 'ingresoMensualPropio' };
    }
  }
  if (input.numeroDependientes.trim()) {
    const dep = Number(input.numeroDependientes);
    if (!Number.isInteger(dep) || dep < 0 || dep > 30) {
      return { error, field: 'numeroDependientes' };
    }
  }
  if (input.tieneApoyo && !input.especificacionApoyo.trim()) {
    return { error, field: 'especificacionApoyo' };
  }
  if (input.material === 'otro' && !input.materialOtro.trim()) {
    return { error, field: 'materialOtro' };
  }
  for (let i = 0; i < input.aportantes.length; i++) {
    const ap = input.aportantes[i];
    if (!ap.nombre.trim()) return { error, field: `aportante-${i}-nombre` };
    if (ap.monto.trim()) {
      const m = Number(ap.monto);
      if (!Number.isFinite(m) || m < 0 || m > 9_999_999.99) {
        return { error, field: `aportante-${i}-monto` };
      }
    }
  }
  return { error, field: 'ingresoMensualPropio' };
}

const AGRESOR_FIELD_ORDER: readonly AgresorValidationField[] = [
  'nombres',
  'apellidoPaterno',
  'apellidoMaterno',
  'parentescoOtro',
  'ocupacionOtra',
  'codigoPostal',
  'calle',
  'numeroExterior',
  'numeroInterior',
  'referencias',
  'drogas',
  'especificacionDroga',
  'especificacionArma',
  'observaciones',
];

export interface AgresorStepValidationResult {
  failure: StepValidationFailure;
  errors: Partial<Record<AgresorValidationField, string>>;
}

export function validateStepAgresor(
  input: FichaAgresorInput,
  parentescos: readonly CatalogoOpcion[] = [],
  ocupaciones: readonly CatalogoOpcion[] = [],
): AgresorStepValidationResult | null {
  if (!hasFichaAgresorData(input)) return null;

  const base = validarAgresor(toAgresorInput(input, '', parentescos, ocupaciones));
  const errors: Partial<Record<AgresorValidationField, string>> = { ...base.errores };

  if (!input.apellidoPaterno.trim()) {
    errors.apellidoPaterno = 'El apellido paterno de la persona agresora es obligatorio.';
  }

  const firstKey = AGRESOR_FIELD_ORDER.find((key) => Boolean(errors[key]));
  if (!firstKey) return null;

  return {
    failure: {
      error: errors[firstKey] ?? 'Revisa los datos de la persona agresora.',
      field: `agresor-${firstKey}`,
    },
    errors,
  };
}

const FOCUSABLE_SELECTOR = [
  '[data-mk-ms-input]',
  '[data-mk-select-trigger]',
  '[data-mk-glass-switch-input]',
  'input:not([type="hidden"]):not([hidden])',
  'textarea',
  'select:not([hidden])',
  'button:not([disabled])',
].join(', ');

/** Enfoca y desplaza hacia el primer campo inválido identificado por `data-ficha-field`. */
export function focusFichaField(root: HTMLElement | null, field: string | null): void {
  if (!root || !field) return;
  const keys = field === 'ubicacion' ? ['asentamientoId', 'codigoPostalForaneo'] : [field];

  for (const key of keys) {
    const container = root.querySelector<HTMLElement>(`[data-ficha-field="${key}"]`);
    if (!container) continue;
    const target = container.matches('input, select, textarea, button')
      ? container
      : container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!target) continue;

    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
    return;
  }
}
