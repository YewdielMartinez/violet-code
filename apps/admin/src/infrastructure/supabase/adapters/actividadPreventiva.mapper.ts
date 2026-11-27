import type { Database, Json } from '../database.types';
import type {
  ActividadParticipante,
  ActividadPreventivaCreateInput,
  ActividadPreventivaItem,
  RolEmpleado,
} from '@/domain/models/ActividadPreventiva';

type ActividadRow = Database['public']['Functions']['get_actividades_preventivas']['Returns'][number];

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
