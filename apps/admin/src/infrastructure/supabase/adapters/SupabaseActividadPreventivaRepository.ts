import { supabase } from '../client';
import type { Json } from '../database.types';
import type {
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
  ActividadPreventivaItem,
  ActividadRegistradaResult,
  EmpleadoParticipanteOpcion,
  TipoActividadItem,
} from '@/domain/models/ActividadPreventiva';
import type { ActividadPreventivaRepository } from '@/domain/ports/ActividadPreventivaRepository';
import { mapActividadRow, toRegistrarPayload } from './actividadPreventiva.mapper';

export const supabaseActividadPreventivaRepository: ActividadPreventivaRepository = {
  async list(filters?: ActividadPreventivaFilters): Promise<ActividadPreventivaItem[]> {
    const { data, error } = await supabase.rpc('get_actividades_preventivas', {
      p_desde: filters?.desde ?? undefined,
      p_hasta: filters?.hasta ?? undefined,
      p_limite: filters?.limite ?? 100,
    });

    if (error) throw error;

    return (data ?? []).map(mapActividadRow);
  },

  async registrar(input: ActividadPreventivaCreateInput): Promise<ActividadRegistradaResult> {
    const { data, error } = await supabase.rpc('registrar_actividad_preventiva', {
      p_payload: toRegistrarPayload(input) as Json,
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

  async listTipos(): Promise<TipoActividadItem[]> {
    const { data, error } = await supabase.from('cat_tipo_actividad').select('id, clave, nombre').order('id');
    if (error) throw error;
    return data ?? [];
  },

  async listEmpleados(): Promise<EmpleadoParticipanteOpcion[]> {
    const { data, error } = await supabase
      .from('empleado')
      .select('id, nombre, rol')
      .eq('activo', true)
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  },
};
