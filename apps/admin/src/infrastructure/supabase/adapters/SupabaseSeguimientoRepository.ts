import { supabase } from '../client';
import type {
  LineaTiempoEvento,
  SeguimientoCreateInput,
  SeguimientoResult,
  TipoEventoLineaTiempo,
} from '@/domain/models/Seguimiento';
import type { SeguimientoRepository } from '@/domain/ports/SeguimientoRepository';

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'registro',
  'cita',
  'atencion',
  'derivacion',
  'orden_proteccion',
  'alerta',
]);

function normalizeEventType(raw: string): TipoEventoLineaTiempo {
  return EVENT_TYPES.has(raw) ? (raw as TipoEventoLineaTiempo) : 'atencion';
}

export const supabaseSeguimientoRepository: SeguimientoRepository = {
  async registrar(input: SeguimientoCreateInput): Promise<SeguimientoResult> {
    const { data, error } = await supabase.rpc('registrar_seguimiento', {
      p_ficha_id: input.fichaId,
      p_cita_id: input.citaId,
      p_tipo_atencion_id: input.tipoAtencionId,
      p_acciones_realizadas: input.accionesRealizadas?.trim() || undefined,
      p_proxima_accion: input.proximaAccion?.trim() || undefined,
      p_prioridad: input.prioridad ?? undefined,
      p_observaciones: input.observaciones?.trim() || undefined,
      p_proxima_cita_en: input.proximaCitaEn ?? undefined,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el resultado del seguimiento registrado.');
    }

    return {
      atencionId: row.atencion_id,
      folioSeguimiento: row.folio_seguimiento,
      citaProximaId: row.cita_proxima_id ?? null,
      esPrimeraVezArea: row.es_primera_vez_area,
      tieneHistorialClinico: row.tiene_historial_clinico,
    };
  },

  async getLineaTiempo(fichaId: string): Promise<LineaTiempoEvento[]> {
    const { data, error } = await supabase.rpc('get_linea_tiempo', {
      p_ficha_id: fichaId,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      fecha: row.fecha,
      tipo: normalizeEventType(row.tipo),
      area: row.area ?? null,
      titulo: row.titulo,
      detalle: row.detalle ?? null,
      referenciaId: row.referencia_id,
    }));
  },
};
