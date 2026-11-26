import { supabase } from '../client';
import type { Database } from '../database.types';
import type { AlertaEstadoResult, ColaAlertaItem, EstadoAlerta } from '@/domain/models/Alerta';
import type { AlertaRepository } from '@/domain/ports/AlertaRepository';

type RpcColaRow = Database['public']['Functions']['get_cola_alertas']['Returns'][number];
type RpcAlertaEstadoRow = Database['public']['Functions']['tomar_alerta']['Returns'][number];

function mapColaRow(row: RpcColaRow): ColaAlertaItem {
  return {
    alertaId: row.alerta_id,
    origen: row.origen,
    prioridad: row.prioridad,
    estado: row.estado,
    creadoEn: row.creado_en,
    tomadaEn: row.tomada_en,
    atendidaPorNombre: row.atendida_por_nombre,
    personaId: row.persona_id,
    fichaId: row.ficha_id,
    folio: row.folio,
    nombreCompleto: row.nombre_completo,
    celular: row.celular,
    tieneOrdenVigente: row.tiene_orden_vigente,
    asentamientoNombre: row.asentamiento_nombre,
  };
}

function mapEstadoRow(row: RpcAlertaEstadoRow): AlertaEstadoResult {
  return {
    alertaId: row.alerta_id,
    estado: row.estado,
    tomadaEn: row.tomada_en,
    atendidaEn: row.atendida_en,
    atendidaPor: row.atendida_por,
  };
}

export const supabaseAlertaRepository: AlertaRepository = {
  async listarCola(
    estados: EstadoAlerta[] | null = ['nueva', 'tomada'],
    limite = 50,
  ): Promise<ColaAlertaItem[]> {
    const { data, error } = await supabase.rpc('get_cola_alertas', {
      p_estados: estados ?? undefined,
      p_limite: limite,
    });

    if (error) throw error;
    return (data ?? []).map(mapColaRow);
  },

  async tomar(alertaId: string): Promise<AlertaEstadoResult> {
    const { data, error } = await supabase.rpc('tomar_alerta', {
      p_alerta_id: alertaId,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('No se recibió confirmación al tomar la alerta.');
    }
    return mapEstadoRow(row);
  },

  async atender(alertaId: string, observaciones?: string | null): Promise<AlertaEstadoResult> {
    const cleanObs = observaciones?.trim();

    const { data, error } = await supabase.rpc('atender_alerta', {
      p_alerta_id: alertaId,
      p_observaciones: cleanObs || undefined,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('No se recibió confirmación al atender la alerta.');
    }
    return mapEstadoRow(row);
  },
};
