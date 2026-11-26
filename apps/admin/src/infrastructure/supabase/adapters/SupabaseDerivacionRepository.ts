import { supabase } from '../client';
import type { Database } from '../database.types';
import {
  isInternalDestino,
  type DerivacionCreateInput,
  type DerivacionItem,
  type EstadoDerivacion,
} from '@/domain/models/Derivacion';
import type { DerivacionRepository } from '@/domain/ports/DerivacionRepository';

type RpcDerivacionRow = Database['public']['Functions']['get_derivaciones']['Returns'][number];

function mapRpcRow(row: RpcDerivacionRow): DerivacionItem {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    folio: row.folio ?? '—',
    usuariaNombre: row.usuaria_nombre?.trim() || '—',
    areaOrigenId: row.area_origen_id,
    areaOrigenNombre: row.area_origen_nombre,
    areaDestinoId: row.area_destino_id,
    areaDestinoNombre: row.area_destino_nombre,
    institucionId: row.institucion_id,
    institucionNombre: row.institucion_nombre,
    institucionOtra: row.institucion_otra,
    destino: row.destino,
    motivo: row.motivo,
    fechaDerivacion: row.fecha_derivacion,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

export const supabaseDerivacionRepository: DerivacionRepository = {
  async list(estado?: EstadoDerivacion): Promise<DerivacionItem[]> {
    const { data, error } = await supabase.rpc('get_derivaciones', {
      p_estado: estado ?? undefined,
      p_limite: 200,
    });

    if (error) throw error;
    return (data ?? []).map(mapRpcRow);
  },

  async listByFicha(fichaId: string): Promise<DerivacionItem[]> {
    const { data, error } = await supabase.rpc('get_derivaciones', {
      p_ficha_id: fichaId,
      p_limite: 200,
    });

    if (error) throw error;
    return (data ?? []).map(mapRpcRow);
  },

  async create(input: DerivacionCreateInput): Promise<{ id: string }> {
    const internal = isInternalDestino(input.destino);
    const otra = input.institucionOtra.trim();

    const { data, error } = await supabase
      .from('derivacion')
      .insert({
        ficha_id: input.fichaId,
        area_origen_id: input.areaOrigenId,
        destino: input.destino,
        area_destino_id: internal ? input.areaDestinoId : null,
        institucion_id: !internal ? input.institucionId : null,
        institucion_otra: !internal && input.institucionId === null && otra ? otra : null,
        motivo: input.motivo.trim(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  async updateEstado(id: string, estado: EstadoDerivacion): Promise<void> {
    const { error } = await supabase.rpc('cambiar_estado_derivacion', {
      p_derivacion_id: id,
      p_estado: estado,
    });
    if (error) throw error;
  },
};
