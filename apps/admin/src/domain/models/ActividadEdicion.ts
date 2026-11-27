import {
  validateActividadCampos,
  type ActividadParticipante,
  type ActividadPreventivaCreateInput,
  type ActividadPreventivaItem,
} from './ActividadPreventiva';

/** Edición de una actividad pendiente (espejo de `actualizar_actividad_preventiva`, `RF-16`). */

export interface ActividadPreventivaUpdateInput extends ActividadPreventivaCreateInput {
  actividadId: string;
  /** `actualizado_en` con el que se cargó la actividad (bloqueo optimista; si cambió, el servidor responde `23505`). */
  actualizadoEn: string;
}

export interface ActividadActualizadaResult {
  actividadId: string;
  totalParticipantes: number;
  actualizadoEn: string;
}

/** Datos de presentación que el formulario ya conoce (nombres de catálogos) para reflejar la edición sin esperar al refetch. */
export type ActividadEdicionVista = Pick<
  ActividadPreventivaItem,
  'tipoActividadClave' | 'tipoActividadNombre' | 'asentamientoNombre' | 'codigoPostal' | 'municipio' | 'participantes'
>;

export interface ActividadEdicionCambio {
  input: ActividadPreventivaUpdateInput;
  vista: ActividadEdicionVista;
}

/** Valida la edición: identificador, token de bloqueo y los mismos campos que el alta. Primer error o `null`. */
export function validateActividadActualizar(input: ActividadPreventivaUpdateInput): string | null {
  if (!input.actividadId) return 'No se identificó la actividad a editar.';
  if (!input.actualizadoEn) return 'Falta la versión de la actividad; vuelve a abrirla para editarla.';
  return Object.values(validateActividadCampos(input))[0] ?? null;
}

/** Proyección de la edición sobre la actividad (lo que devolverá el servidor al refrescar). No toca el estado. */
export function aplicarEdicionActividad(
  item: ActividadPreventivaItem,
  input: ActividadPreventivaCreateInput,
  vista: ActividadEdicionVista,
  actualizadoEn: string | null = item.actualizadoEn,
): ActividadPreventivaItem {
  const participantes: ActividadParticipante[] = vista.participantes;
  return {
    ...item,
    titulo: input.titulo.trim(),
    tipoActividadId: input.tipoActividadId,
    tipoActividadClave: vista.tipoActividadClave,
    tipoActividadNombre: vista.tipoActividadNombre,
    tipoInstitucion: input.tipoInstitucion,
    nivelEducativo: input.tipoInstitucion === 'escuela' ? (input.nivelEducativo ?? null) : null,
    sede: input.sede.trim(),
    direccion: input.direccion?.trim() || null,
    referencias: input.referencias?.trim() || null,
    asentamientoId: input.asentamientoId ?? null,
    asentamientoNombre: vista.asentamientoNombre,
    codigoPostal: vista.codigoPostal,
    municipio: vista.municipio,
    programadaEn: input.programadaEn,
    numeroAsistentes: input.numeroAsistentes ?? null,
    participantes: input.participantesIds === undefined ? item.participantes : participantes,
    actualizadoEn,
  };
}

/** Campos que cambia una edición (más `actualizadoEn`): lo que se superpone localmente a la actividad tras guardar. */
export function camposEditados(item: ActividadPreventivaItem): Partial<ActividadPreventivaItem> {
  return {
    titulo: item.titulo,
    tipoActividadId: item.tipoActividadId,
    tipoActividadClave: item.tipoActividadClave,
    tipoActividadNombre: item.tipoActividadNombre,
    tipoInstitucion: item.tipoInstitucion,
    nivelEducativo: item.nivelEducativo,
    sede: item.sede,
    direccion: item.direccion,
    referencias: item.referencias,
    asentamientoId: item.asentamientoId,
    asentamientoNombre: item.asentamientoNombre,
    codigoPostal: item.codigoPostal,
    municipio: item.municipio,
    programadaEn: item.programadaEn,
    numeroAsistentes: item.numeroAsistentes,
    participantes: item.participantes,
    actualizadoEn: item.actualizadoEn,
  };
}
