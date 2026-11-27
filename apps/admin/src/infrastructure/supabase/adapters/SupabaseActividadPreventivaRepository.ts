import { supabase } from '../client';
import type { Json } from '../database.types';
import type {
  ActividadParticipante,
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
  ActividadPreventivaItem,
  ActividadRegistradaResult,
  RolEmpleado,
} from '@/domain/models/ActividadPreventiva';
import type { ActividadPreventivaRepository } from '@/domain/ports/ActividadPreventivaRepository';

interface RpcParticipanteShape {
  empleado_id: string;
  nombre: string;
  rol: RolEmpleado;
}

function mapParticipantes(raw: Json | null): ActividadParticipante[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { [key: string]: Json | undefined } =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item) => {
      const p = item as unknown as RpcParticipanteShape;
      return {
        empleadoId: p.empleado_id,
        nombre: p.nombre,
        rol: p.rol,
      };
    });
}

export const supabaseActividadPreventivaRepository: ActividadPreventivaRepository = {
  async list(filters?: ActividadPreventivaFilters): Promise<ActividadPreventivaItem[]> {
    const { data, error } = await supabase.rpc('get_actividades_preventivas', {
      p_desde: filters?.desde ?? undefined,
      p_hasta: filters?.hasta ?? undefined,
      p_limite: filters?.limite ?? 100,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
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
    }));
  },

  async registrar(input: ActividadPreventivaCreateInput): Promise<ActividadRegistradaResult> {
    const payload: Record<string, Json | null> = {
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

    const { data, error } = await supabase.rpc('registrar_actividad_preventiva', {
      p_payload: payload as Json,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el identificador de la actividad preventiva.');
    }

    return {
      actividadId: row.actividad_id,
      totalParticipantes: row.total_participantes,
    };
  },
};
