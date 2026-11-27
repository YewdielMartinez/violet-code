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
import type { ActividadEstadoCambioInput, ActividadEstadoCambioResult } from '@/domain/models/ActividadEstado';
import type { ActividadActualizadaResult, ActividadPreventivaUpdateInput } from '@/domain/models/ActividadEdicion';
import type { ActividadPreventivaRepository } from '@/domain/ports/ActividadPreventivaRepository';
import {
  mapActividadRow,
  toActualizarActividadArgs,
  toActualizarEstadoArgs,
  toRegistrarPayload,
  type ActividadRow,
  type ActualizarActividadArgs,
  type ActualizarActividadRow,
  type ActualizarEstadoArgs,
  type ActualizarEstadoRow,
} from './actividadPreventiva.mapper';

interface GetActividadesArgs {
  p_desde?: string;
  p_hasta?: string;
  p_estado?: string;
  p_limite: number;
}

type RpcResult<T> = PromiseLike<{ data: T | null; error: Error | null }>;

/**
 * `get_actividades_preventivas` (con `p_estado`, estado y `actualizado_en`), `actualizar_estado_actividad` y
 * `actualizar_actividad_preventiva` aún no
 * están en `database.types.ts` (se regenera con `supabase gen types` tras la migración); mientras tanto se tipan
 * aquí las llamadas. TODO: retirar este cast y usar `supabase.rpc(...)` directo al regenerar los tipos.
 */
const rpcActividades = supabase as unknown as {
  rpc: {
    (fn: 'get_actividades_preventivas', args: GetActividadesArgs): RpcResult<ActividadRow[]>;
    (fn: 'actualizar_estado_actividad', args: ActualizarEstadoArgs): RpcResult<ActualizarEstadoRow[] | ActualizarEstadoRow>;
    (
      fn: 'actualizar_actividad_preventiva',
      args: ActualizarActividadArgs,
    ): RpcResult<ActualizarActividadRow[] | ActualizarActividadRow>;
  };
};

export const supabaseActividadPreventivaRepository: ActividadPreventivaRepository = {
  async list(filters?: ActividadPreventivaFilters): Promise<ActividadPreventivaItem[]> {
    const { data, error } = await rpcActividades.rpc('get_actividades_preventivas', {
      p_desde: filters?.desde ?? undefined,
      p_hasta: filters?.hasta ?? undefined,
      p_estado: filters?.estado ?? undefined,
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

  async actualizar(input: ActividadPreventivaUpdateInput): Promise<ActividadActualizadaResult> {
    const { data, error } = await rpcActividades.rpc('actualizar_actividad_preventiva', toActualizarActividadArgs(input));

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió la actividad actualizada.');
    }

    return {
      actividadId: row.actividad_id,
      totalParticipantes: row.total_participantes,
      actualizadoEn: row.actualizado_en,
    };
  },

  async actualizarEstado(input: ActividadEstadoCambioInput): Promise<ActividadEstadoCambioResult> {
    const { data, error } = await rpcActividades.rpc('actualizar_estado_actividad', toActualizarEstadoArgs(input));

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el nuevo estado de la actividad.');
    }

    return { actividadId: row.actividad_id, estado: row.estado, realizadaEn: row.realizada_en ?? null };
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
