import type { Database } from '@/infrastructure/supabase/database.types';
import type { HojaSeguimientoCopia } from './HojaSeguimiento';

export type PrioridadNivel = Database['public']['Enums']['prioridad_nivel'];

export type TipoEventoLineaTiempo =
  | 'registro'
  | 'cita'
  | 'atencion'
  | 'derivacion'
  | 'orden_proteccion'
  | 'alerta';

export interface SeguimientoCreateInput {
  fichaId: string;
  citaId: string;
  tipoAtencionId: number;
  accionesRealizadas?: string | null;
  proximaAccion?: string | null;
  prioridad?: PrioridadNivel | null;
  observaciones?: string | null;
  proximaCitaEn?: string | null;
  /** Copia histórica de datos generales del día; si se omite, el servidor copia los de la ficha. */
  copia?: HojaSeguimientoCopia | null;
}

export interface SeguimientoResult {
  atencionId: string;
  folioSeguimiento: string;
  citaProximaId: string | null;
  esPrimeraVezArea: boolean;
  tieneHistorialClinico: boolean;
  /** Solo presente si se envió `copia`: `false` si la hoja quedó registrada pero la copia del día no. */
  copiaGuardada?: boolean;
}

export interface LineaTiempoEvento {
  fecha: string;
  tipo: TipoEventoLineaTiempo;
  area: string | null;
  titulo: string;
  detalle: string | null;
  referenciaId: string;
}

/** Valida los campos requeridos antes de invocar `registrar_seguimiento` (`RF-09`). */
export function validateSeguimientoInput(input: SeguimientoCreateInput): string | null {
  if (!input.fichaId) {
    return 'El identificador del expediente es obligatorio.';
  }
  if (!input.citaId) {
    return 'La cita del día es obligatoria para registrar el seguimiento.';
  }
  if (!Number.isInteger(input.tipoAtencionId) || input.tipoAtencionId <= 0) {
    return 'Selecciona el tipo de atención.';
  }
  if (input.accionesRealizadas && input.accionesRealizadas.trim().length > 5000) {
    return 'Las acciones realizadas no pueden exceder 5000 caracteres.';
  }
  if (input.proximaAccion && input.proximaAccion.trim().length > 2000) {
    return 'La próxima acción no puede exceder 2000 caracteres.';
  }
  if (input.observaciones && input.observaciones.trim().length > 5000) {
    return 'Las observaciones no pueden exceder 5000 caracteres.';
  }
  if (input.proximaCitaEn) {
    const parsed = Date.parse(input.proximaCitaEn);
    if (Number.isNaN(parsed) || parsed <= Date.now()) {
      return 'La próxima cita debe programarse en una fecha futura.';
    }
  }
  return null;
}
