import {
  ESTADO_ACTIVIDAD_LABELS,
  type ActividadPreventivaItem,
  type EstadoActividad,
} from './ActividadPreventiva';

/** Reglas de negocio del estado de una actividad preventiva (espejo de `actualizar_estado_actividad`). */

export const ASISTENTES_MAX = 10000;
/** Límites del backend (`observaciones_cierre` 1000, `cancelada_motivo` 500). */
export const OBSERVACIONES_CIERRE_MAX = 1000;
export const MOTIVO_CANCELACION_MAX = 500;

export interface ActividadEstadoCambioInput {
  actividadId: string;
  estado: EstadoActividad;
  /** Solo al marcar como realizada (0–10000). */
  numeroAsistentes?: number | null;
  /** Observaciones de cierre: solo al marcar como realizada. */
  observaciones?: string | null;
  /** Solo al cancelar. */
  motivoCancelacion?: string | null;
}

export interface ActividadEstadoCambioResult {
  actividadId: string;
  estado: EstadoActividad;
  realizadaEn: string | null;
}

/** Una pendiente cuya fecha ya pasó: sigue abierta y hay que cerrarla (realizada o cancelada). */
export function esVencida(item: Pick<ActividadPreventivaItem, 'estado' | 'programadaEn'>, ahora: Date): boolean {
  return item.estado === 'pendiente' && new Date(item.programadaEn).getTime() < ahora.getTime();
}

/** Acciones válidas desde un estado (solo con `actividad.registrar`). */
export interface AccionesActividad {
  realizar: boolean;
  cancelar: boolean;
  reabrir: boolean;
}

export function accionesActividad(estado: EstadoActividad, puedeRegistrar: boolean): AccionesActividad {
  return {
    realizar: puedeRegistrar && estado === 'pendiente',
    cancelar: puedeRegistrar && estado === 'pendiente',
    reabrir: puedeRegistrar && estado !== 'pendiente',
  };
}

/** Valida la transición `actual → destino`: mensaje de error o `null` (el RPC rechaza el mismo estado con 22023). */
export function validarTransicionActividad(actual: EstadoActividad, destino: EstadoActividad): string | null {
  if (actual === destino) return `La actividad ya está ${ESTADO_ACTIVIDAD_LABELS[destino].toLowerCase()}.`;
  if (actual !== 'pendiente' && destino !== 'pendiente') return 'Reabre la actividad antes de cambiar su estado.';
  return null;
}

/** Valida el cambio completo: transición, asistentes (0–10000, solo al realizar) y textos opcionales. Primer error o `null`. */
export function validateCambioEstadoActividad(actual: EstadoActividad, input: ActividadEstadoCambioInput): string | null {
  const transicion = validarTransicionActividad(actual, input.estado);
  if (transicion) return transicion;
  const asistentes = input.numeroAsistentes;
  if (asistentes !== undefined && asistentes !== null) {
    if (input.estado !== 'realizada') return 'El número de asistentes solo se registra al marcarla como realizada.';
    if (!Number.isInteger(asistentes) || asistentes < 0 || asistentes > ASISTENTES_MAX) {
      return `El número de asistentes debe ser un entero entre 0 y ${ASISTENTES_MAX}.`;
    }
  }
  if ((input.observaciones?.trim().length ?? 0) > OBSERVACIONES_CIERRE_MAX) {
    return `Las observaciones no pueden exceder ${OBSERVACIONES_CIERRE_MAX} caracteres.`;
  }
  if ((input.motivoCancelacion?.trim().length ?? 0) > MOTIVO_CANCELACION_MAX) {
    return `El motivo no puede exceder ${MOTIVO_CANCELACION_MAX} caracteres.`;
  }
  return null;
}

/** Proyección optimista del cambio de estado sobre la actividad (lo que devolverá el servidor al refrescar). */
export function aplicarCambioEstado(
  item: ActividadPreventivaItem,
  input: ActividadEstadoCambioInput,
  ahoraIso: string,
): ActividadPreventivaItem {
  switch (input.estado) {
    case 'realizada':
      return {
        ...item,
        estado: 'realizada',
        realizadaEn: ahoraIso,
        canceladaMotivo: null,
        numeroAsistentes: input.numeroAsistentes ?? item.numeroAsistentes,
        observacionesCierre: input.observaciones?.trim() || null,
      };
    case 'cancelada':
      return {
        ...item,
        estado: 'cancelada',
        realizadaEn: null,
        canceladaMotivo: input.motivoCancelacion?.trim() || null,
        observacionesCierre: null,
      };
    case 'pendiente':
      // Reabrir limpia los datos de cierre y de cancelación (los asistentes se conservan).
      return { ...item, estado: 'pendiente', realizadaEn: null, canceladaMotivo: null, observacionesCierre: null };
  }
}
