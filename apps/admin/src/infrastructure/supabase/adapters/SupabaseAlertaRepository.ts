import { supabase } from '../client';
import type { Database } from '../database.types';
import {
  ordenarColaAlertas,
  type AlertaCambioEvento,
  type AlertaCambioTipo,
  type AlertaDetalleExtra,
  type AlertaEstadoResult,
  type ColaAlertaItem,
  type EstadoAlerta,
  type OrigenAlerta,
  type PrioridadAlerta,
} from '@/domain/models/Alerta';
import type { AlertaRealtimeStatus, AlertaRepository } from '@/domain/ports/AlertaRepository';

type RpcColaRow = Database['public']['Functions']['get_cola_alertas']['Returns'][number];
type RpcAlertaEstadoRow = Database['public']['Functions']['tomar_alerta']['Returns'][number];
type AlertaDetalleRow = Pick<
  Database['public']['Tables']['alerta']['Row'],
  'id' | 'atendida_en' | 'observaciones' | 'actualizado_en'
>;

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

function mapDetalleRow(row: AlertaDetalleRow): AlertaDetalleExtra {
  return {
    alertaId: row.id,
    atendidaEn: row.atendida_en,
    observaciones: row.observaciones,
    actualizadoEn: row.actualizado_en,
  };
}

function parseCambioPayload(payload: {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}): AlertaCambioEvento | undefined {
  const eventType = payload.eventType as AlertaCambioTipo | undefined;
  if (eventType !== 'INSERT' && eventType !== 'UPDATE' && eventType !== 'DELETE') {
    return undefined;
  }
  const source = (eventType === 'DELETE' ? payload.old : payload.new) ?? {};
  const alertaId = typeof source.id === 'string' ? source.id : '';
  const prioridad =
    source.prioridad === 'alta' || source.prioridad === 'media' || source.prioridad === 'baja'
      ? (source.prioridad as PrioridadAlerta)
      : null;
  const estado =
    source.estado === 'nueva' || source.estado === 'tomada' || source.estado === 'atendida'
      ? (source.estado as EstadoAlerta)
      : null;
  const origen =
    source.origen === 'app_movil' || source.origen === 'telefono' || source.origen === 'presencial'
      ? (source.origen as OrigenAlerta)
      : null;

  return {
    eventType,
    alertaId,
    prioridad,
    estado,
    origen,
  };
}

let realtimeSubSeq = 0;

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
    return ordenarColaAlertas((data ?? []).map(mapColaRow));
  },

  async obtenerDetalle(alertaId: string): Promise<AlertaDetalleExtra | null> {
    const { data, error } = await supabase
      .from('alerta')
      .select('id, atendida_en, observaciones, actualizado_en')
      .eq('id', alertaId)
      .eq('activo', true)
      .maybeSingle();

    if (error) throw error;
    return data ? mapDetalleRow(data) : null;
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

  suscribirCambios(
    onChange: (evento?: AlertaCambioEvento) => void,
    onStatus?: (status: AlertaRealtimeStatus) => void,
  ): () => void {
    realtimeSubSeq += 1;
    const channel = supabase
      .channel(`alerta-cola-realtime-${realtimeSubSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerta' },
        (payload) => {
          onChange(parseCambioPayload(payload));
        },
      )
      .subscribe((status) => {
        if (
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          onStatus?.(status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
