import type { Database, Json } from '../database.types';
import {
  esEstadoActividad,
  type ActividadParticipante,
  type ActividadPreventivaCreateInput,
  type ActividadPreventivaItem,
  type EstadoActividad,
  type RolEmpleado,
} from '@/domain/models/ActividadPreventiva';
import type { ActividadEstadoCambioInput } from '@/domain/models/ActividadEstado';
import type { ActividadPreventivaUpdateInput } from '@/domain/models/ActividadEdicion';

type ActividadRowBase = Database['public']['Functions']['get_actividades_preventivas']['Returns'][number];

/**
 * Columnas de estado que agrega `get_actividades_preventivas` (enum `estado_actividad`). TODO: quitar esta
 * extensión (y el cast del adaptador) cuando `database.types.ts` se regenere con la migración.
 */
export interface ActividadEstadoColumns {
  estado?: EstadoActividad | null;
  realizada_en?: string | null;
  cancelada_motivo?: string | null;
  observaciones_cierre?: string | null;
  actualizado_en?: string | null;
}

export type ActividadRow = ActividadRowBase & ActividadEstadoColumns;

/** Argumentos de `actualizar_estado_actividad` (`snake_case`). */
export interface ActualizarEstadoArgs {
  p_actividad_id: string;
  p_estado: EstadoActividad;
  p_numero_asistentes: number | null;
  p_observaciones: string | null;
  p_motivo_cancelacion: string | null;
}

/** Argumentos de `actualizar_actividad_preventiva` (`snake_case`). */
export interface ActualizarActividadArgs {
  p_actividad_id: string;
  p_payload: Json;
  p_actualizado_en: string;
}

/** Fila que devuelve `actualizar_actividad_preventiva`. TODO: sale de `database.types.ts` al regenerarlo. */
export interface ActualizarActividadRow {
  actividad_id: string;
  total_participantes: number;
  actualizado_en: string;
}

/** Fila que devuelve `actualizar_estado_actividad`. */
export interface ActualizarEstadoRow {
  actividad_id: string;
  estado: EstadoActividad;
  realizada_en: string | null;
}

interface RpcParticipanteShape {
  empleado_id: string;
  nombre: string;
  rol: RolEmpleado;
}

export function mapParticipantes(raw: Json | null): ActividadParticipante[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { [key: string]: Json | undefined } =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item) => {
      const p = item as unknown as RpcParticipanteShape;
      return { empleadoId: p.empleado_id, nombre: p.nombre, rol: p.rol };
    });
}

/** Fila de `get_actividades_preventivas` (`snake_case`) → modelo de dominio. */
export function mapActividadRow(row: ActividadRow): ActividadPreventivaItem {
  return {
    id: row.id,
    titulo: row.titulo,
    tipoActividadId: row.tipo_actividad_id,
    tipoActividadClave: row.tipo_actividad_clave,
    tipoActividadNombre: row.tipo_actividad_nombre,
    tipoInstitucion: row.tipo_institucion,
    nivelEducativo: row.nivel_educativo ?? null,
    sede: row.sede,
    direccion: row.direccion ?? null,
    referencias: row.referencias ?? null,
    asentamientoId: row.asentamiento_id ?? null,
    asentamientoNombre: row.asentamiento_nombre ?? null,
    codigoPostal: row.codigo_postal ?? null,
    municipio: row.municipio ?? null,
    programadaEn: row.programada_en,
    numeroAsistentes: row.numero_asistentes ?? null,
    creadoPor: row.creado_por ?? null,
    creadoPorNombre: row.creado_por_nombre ?? null,
    creadoEn: row.creado_en,
    participantes: mapParticipantes(row.participantes),
    estado: esEstadoActividad(row.estado) ? row.estado : 'pendiente',
    realizadaEn: row.realizada_en ?? null,
    canceladaMotivo: row.cancelada_motivo ?? null,
    observacionesCierre: row.observaciones_cierre ?? null,
    actualizadoEn: row.actualizado_en ?? null,
  };
}

/** Modelo de alta → `p_payload` de `registrar_actividad_preventiva`. */
export function toRegistrarPayload(input: ActividadPreventivaCreateInput): Record<string, Json | null> {
  return {
    titulo: input.titulo.trim(),
    tipo_actividad_id: input.tipoActividadId,
    tipo_institucion: input.tipoInstitucion,
    nivel_educativo: input.nivelEducativo ?? null,
    sede: input.sede.trim(),
    direccion: input.direccion?.trim() || null,
    referencias: input.referencias?.trim() || null,
    asentamiento_id: input.asentamientoId ?? null,
    programada_en: input.programadaEn,
    numero_asistentes: input.numeroAsistentes ?? null,
    participantes_ids: input.participantesIds ?? [],
  };
}

/** Modelo de edición → argumentos de `actualizar_actividad_preventiva` (mismo payload que el alta + bloqueo optimista). */
export function toActualizarActividadArgs(input: ActividadPreventivaUpdateInput): ActualizarActividadArgs {
  return {
    p_actividad_id: input.actividadId,
    p_payload: toRegistrarPayload(input) as Json,
    p_actualizado_en: input.actualizadoEn,
  };
}

/** Modelo de cambio de estado → argumentos del RPC (textos recortados; vacío = `null`). */
export function toActualizarEstadoArgs(input: ActividadEstadoCambioInput): ActualizarEstadoArgs {
  return {
    p_actividad_id: input.actividadId,
    p_estado: input.estado,
    p_numero_asistentes: input.numeroAsistentes ?? null,
    p_observaciones: input.observaciones?.trim() || null,
    p_motivo_cancelacion: input.motivoCancelacion?.trim() || null,
  };
}
