import type { Database } from '@/infrastructure/supabase/database.types';
import type { HojaSeguimientoCopia } from './HojaSeguimiento';

export type PrioridadNivel = Database['public']['Enums']['prioridad_nivel'];

/** Tipos que hoy devuelve `get_linea_tiempo` (migración 66). */
export const TIPOS_EVENTO_CONOCIDOS = [
  'registro',
  'archivo',
  'reapertura',
  'cita',
  'atencion',
  'derivacion',
  'canalizacion_evento',
  'orden_proteccion',
  'alerta',
] as const;

export type TipoEventoConocido = (typeof TIPOS_EVENTO_CONOCIDOS)[number];

/** `otro` agrupa tipos futuros que el RPC añada y esta versión aún no conoce: se pintan de forma genérica. */
export type TipoEventoLineaTiempo = TipoEventoConocido | 'otro';

const TIPOS_CONOCIDOS_SET: ReadonlySet<string> = new Set(TIPOS_EVENTO_CONOCIDOS);

/** Tipos que jamás deben llegar a la línea de tiempo (notas privadas, `RN-09`): se descartan siempre. */
const TIPO_PRIVADO_REGEX = /^nota/i;

/** `true` solo para los tipos conocidos del RPC. */
export function esTipoEventoConocido(raw: string): raw is TipoEventoConocido {
  return TIPOS_CONOCIDOS_SET.has(raw);
}

/**
 * Normaliza el `tipo` crudo del RPC: conocido → tal cual; notas privadas → `null` (se descarta,
 * defensa en profundidad); cualquier otro tipo futuro → `'otro'` (se renderiza genérico, sin perderlo).
 */
export function normalizarTipoEvento(raw: string): TipoEventoLineaTiempo | null {
  if (esTipoEventoConocido(raw)) return raw;
  if (raw === 'otro') return 'otro';
  if (TIPO_PRIVADO_REGEX.test(raw)) return null;
  return 'otro';
}

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
