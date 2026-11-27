import type { PrioridadNivel } from '@/domain/models/Cita';
import type { DomicilioInput } from '@/domain/models/Domicilio';
import type { EstadoCivil } from '@/domain/models/FichaRegistro';
import {
  type AsistenciaCita,
  type ContextoHojaSeguimiento,
  domicilioInputDesdeDetalle,
  domicilioModificado,
  validateHojaCopia,
} from '@/domain/models/HojaSeguimiento';
import { type SeguimientoCreateInput, validateSeguimientoInput } from '@/domain/models/Seguimiento';

/** Estado editable de la Hoja de seguimiento (cadenas tal como las captura la usuaria). */
export interface SeguimientoFormState {
  asistencia: AsistenciaCita;
  tipoAtencionId: number | null;
  accionesRealizadas: string;
  proximaAccion: string;
  prioridad: PrioridadNivel | '';
  observaciones: string;
  /** `YYYY-MM-DDTHH:mm` (hora de Mazatlán); solo Jurídico agenda directo (`RN-04`). */
  proximaCitaLocal: string;
  estadoCivil: EstadoCivil | '';
  ocupacionId: number | null;
  ocupacionOtra: string;
  celular: string;
  domicilio: DomicilioInput;
}

export function initialSeguimientoForm(ctx: ContextoHojaSeguimiento): SeguimientoFormState {
  return {
    asistencia: 'asistio',
    tipoAtencionId: null,
    accionesRealizadas: '',
    proximaAccion: '',
    prioridad: '',
    observaciones: '',
    proximaCitaLocal: '',
    estadoCivil: ctx.estadoCivil ?? '',
    ocupacionId: ctx.ocupacionId,
    ocupacionOtra: ctx.ocupacionOtra ?? '',
    celular: ctx.celular ?? '',
    domicilio: domicilioInputDesdeDetalle(ctx.domicilio),
  };
}

/** Convierte `datetime-local` a ISO con el desfase fijo de Mazatlán (UTC-7, sin horario de verano). */
export function localMazatlanToIso(value: string): string | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  return `${v}:00-07:00`;
}

interface BuildOptions {
  ctx: ContextoHojaSeguimiento;
  citaId: string;
  permiteAgendar: boolean;
}

type BuildResult = { input: SeguimientoCreateInput; error: null } | { input: null; error: string };

/** Arma y valida la entrada de `registrar_seguimiento` a partir del formulario (`RF-09`, `RN-13`). */
export function buildSeguimientoInput(state: SeguimientoFormState, opts: BuildOptions): BuildResult {
  if (!state.accionesRealizadas.trim()) {
    return { input: null, error: 'Describe las acciones realizadas en la sesión.' };
  }

  let proximaCitaEn: string | null = null;
  if (opts.permiteAgendar && state.proximaCitaLocal.trim()) {
    proximaCitaEn = localMazatlanToIso(state.proximaCitaLocal);
    if (!proximaCitaEn) return { input: null, error: 'Indica una fecha y hora válidas para la próxima cita.' };
  }

  const original = domicilioInputDesdeDetalle(opts.ctx.domicilio);
  const copia = {
    personaId: opts.ctx.personaId,
    estadoCivil: state.estadoCivil || null,
    ocupacionId: state.ocupacionId,
    ocupacionOtra: state.ocupacionOtra.trim() || null,
    celular: state.celular.trim() || null,
    domicilio: domicilioModificado(original, state.domicilio) ? state.domicilio : null,
  };

  const input: SeguimientoCreateInput = {
    fichaId: opts.ctx.fichaId,
    citaId: opts.citaId,
    tipoAtencionId: state.tipoAtencionId ?? 0,
    accionesRealizadas: state.accionesRealizadas,
    proximaAccion: state.proximaAccion,
    prioridad: state.prioridad || null,
    observaciones: state.observaciones,
    proximaCitaEn,
    copia,
  };

  const error = validateSeguimientoInput(input) ?? validateHojaCopia(copia);
  return error ? { input: null, error } : { input, error: null };
}
