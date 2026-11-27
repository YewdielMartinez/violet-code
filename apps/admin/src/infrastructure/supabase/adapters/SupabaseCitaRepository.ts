import { supabase } from '../client';
import type { Database } from '../database.types';
import type {
  AgendaItem,
  AgendaQuery,
  CambiarEstadoCitaResult,
  CitaCreateInput,
  EstadoCita,
  EstadoCitaGestionable,
  ListaUrgenciasItem,
  ReagendarCitaInput,
  ReagendarCitaResult,
} from '@/domain/models/Cita';
import type { CitaRepository } from '@/domain/ports/CitaRepository';

type RpcAgendaRow = Database['public']['Functions']['get_agenda']['Returns'][number];
type RpcUrgenciaRow = Database['public']['Functions']['get_lista_urgencias']['Returns'][number];

function mapAgendaRow(row: RpcAgendaRow): AgendaItem {
  return {
    citaId: row.cita_id,
    programadaEn: row.programada_en,
    estado: row.estado,
    prioridad: row.prioridad,
    areaId: row.area_id,
    areaClave: row.area_clave,
    recomendadaPor: row.recomendada_por,
    reagendadaDe: row.reagendada_de,
    origen: row.origen,
    personaId: row.persona_id,
    nombreCompleto: row.nombre_completo?.trim() || '—',
    celular: row.celular,
  };
}

function mapUrgenciaRow(row: RpcUrgenciaRow): ListaUrgenciasItem {
  return {
    personaId: row.persona_id,
    fichaId: row.ficha_id,
    folio: row.folio,
    nombreCompleto: row.nombre_completo?.trim() || '—',
    celular: row.celular,
    areaUltimaPrioridad: row.area_ultima_prioridad,
    fechaUltimaPrioridad: row.fecha_ultima_prioridad,
  };
}

export const supabaseCitaRepository: CitaRepository = {
  async listarAgenda(query: AgendaQuery): Promise<AgendaItem[]> {
    const { data, error } = await supabase.rpc('get_agenda', {
      p_desde: query.desde,
      p_hasta: query.hasta,
      p_area_id: query.areaId ?? undefined,
      p_estados: query.estados ?? undefined,
      p_limite: query.limite ?? 200,
    });

    if (error) throw error;
    return (data ?? []).map(mapAgendaRow);
  },

  async crear(
    input: CitaCreateInput,
  ): Promise<{ id: string; estado: EstadoCita; programadaEn: string }> {
    const recomendada = input.recomendadaPor?.trim();

    const { data, error } = await supabase
      .from('cita')
      .insert({
        persona_id: input.personaId,
        area_id: input.areaId,
        programada_en: input.programadaEn,
        prioridad: input.prioridad ?? null,
        recomendada_por: recomendada || null,
        origen: input.origen ?? 'regular',
      })
      .select('id, estado, programada_en')
      .single();

    if (error) throw error;
    return {
      id: data.id,
      estado: data.estado,
      programadaEn: data.programada_en,
    };
  },

  async cambiarEstado(
    citaId: string,
    estado: EstadoCitaGestionable,
    motivo?: string | null,
  ): Promise<CambiarEstadoCitaResult> {
    const cleanMotivo = motivo?.trim();

    const { data, error } = await supabase.rpc('cambiar_estado_cita', {
      p_cita_id: citaId,
      p_estado: estado,
      p_motivo: cleanMotivo || undefined,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('No se recibió confirmación al actualizar el estado de la cita.');
    }

    return {
      citaId: row.cita_id,
      estado: row.estado,
      confirmadaEn: row.confirmada_en,
    };
  },

  async reagendar(input: ReagendarCitaInput): Promise<ReagendarCitaResult> {
    const cleanMotivo = input.motivo?.trim();

    const { data, error } = await supabase.rpc('reagendar_cita', {
      p_cita_id: input.citaId,
      p_nueva_fecha: input.nuevaFecha,
      p_motivo: cleanMotivo || undefined,
      p_prioridad: input.prioridad ?? undefined,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('No se recibió confirmación al reagendar la cita.');
    }

    return {
      citaAnteriorId: row.cita_anterior_id,
      citaNuevaId: row.cita_nueva_id,
      programadaEn: row.programada_en,
      estado: row.estado,
    };
  },

  async listarUrgencias(areaId?: number | null): Promise<ListaUrgenciasItem[]> {
    const { data, error } = await supabase.rpc('get_lista_urgencias', {
      p_area_id: areaId ?? undefined,
    });

    if (error) throw error;
    return (data ?? []).map(mapUrgenciaRow);
  },
};
