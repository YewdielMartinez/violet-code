import { supabase } from '../client';
import { mapSupabaseError } from './errors';
import type {
  ContextoHojaSeguimiento,
  ContextoSeguimiento,
  CorregirSeguimientoInput,
  CorregirSeguimientoResult,
  TipoAtencion,
} from '@/domain/models/HojaSeguimiento';
import type {
  NotaPrivada,
  NotaPrivadaCreateInput,
  NotaPrivadaUpdateInput,
} from '@/domain/models/NotaPrivada';
import type {
  LineaTiempoEvento,
  SeguimientoCreateInput,
  SeguimientoResult,
} from '@/domain/models/Seguimiento';
import type { SeguimientoRepository } from '@/domain/ports/SeguimientoRepository';
import {
  DOMICILIO_SELECT,
  NOTA_SELECT,
  mapDomicilioRow,
  mapEventType,
  mapNotaRow,
  mapTipoAtencionRow,
} from './seguimiento.mapper';

function toOptionalRpcText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.trim();
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

    if (error) throw mapSupabaseError(error);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el resultado del seguimiento registrado.');
    }

    return {
      atencionId: row.atencion_id,
      folioSeguimiento: '',
      citaProximaId: row.cita_proxima_id ?? null,
      esPrimeraVezArea: row.es_primera_vez_area,
      tieneHistorialClinico: row.tiene_historial_clinico,
    };
  },

  async contexto(citaId: string): Promise<ContextoSeguimiento> {
    const { data, error } = await supabase.rpc('get_contexto_seguimiento', {
      p_cita_id: citaId,
    });

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el contexto de la cita.');
    }

    return {
      fichaId: row.ficha_id,
      folioExpediente: row.folio_expediente,
      nombrePersona: row.nombre_persona,
      edad: row.edad ?? null,
      esPrimeraVezArea: row.es_primera_vez_area,
      ultimaProximaAccion: row.ultima_proxima_accion ?? null,
      tieneOrdenVigente: row.tiene_orden_vigente,
      tieneHistorialClinico: row.tiene_historial_clinico ?? null,
    };
  },

  async corregir(input: CorregirSeguimientoInput): Promise<CorregirSeguimientoResult> {
    const { data, error } = await supabase.rpc('corregir_seguimiento', {
      p_atencion_id: input.atencionId,
      p_actualizado_en: input.actualizadoEn,
      p_tipo_atencion_id: input.tipoAtencionId ?? undefined,
      p_acciones_realizadas: toOptionalRpcText(input.accionesRealizadas),
      p_proxima_accion: toOptionalRpcText(input.proximaAccion),
      p_prioridad: input.prioridad ?? undefined,
      p_observaciones: toOptionalRpcText(input.observaciones),
    });

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió confirmación al corregir el seguimiento.');
    }

    return {
      atencionId: row.atencion_id,
      actualizadoEn: row.actualizado_en,
    };
  },

  async getLineaTiempo(fichaId: string): Promise<LineaTiempoEvento[]> {
    const { data, error } = await supabase.rpc('get_linea_tiempo', {
      p_ficha_id: fichaId,
    });

    if (error) throw error;

    return (data ?? []).flatMap((row) => {
      const tipo = mapEventType(row.tipo);
      if (!tipo) return [];
      return [
        {
          fecha: row.fecha,
          tipo,
          area: row.area ?? null,
          titulo: row.titulo,
          detalle: row.detalle ?? null,
          referenciaId: row.referencia_id,
        },
      ];
    });
  },

  async listarTiposAtencion(areaId: number): Promise<TipoAtencion[]> {
    const { data, error } = await supabase
      .from('cat_tipo_atencion')
      .select('id, area_id, clave, nombre')
      .eq('area_id', areaId)
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapTipoAtencionRow);
  },

  async getContextoHoja(personaId: string): Promise<ContextoHojaSeguimiento | null> {
    const [ficha, persona, domicilio] = await Promise.all([
      supabase
        .from('ficha_registro')
        .select('id, folio, persona_id, estado_civil, ocupacion_id, ocupacion_otra')
        .eq('persona_id', personaId)
        .eq('activo', true)
        .maybeSingle(),
      supabase.from('persona').select('celular').eq('id', personaId).maybeSingle(),
      supabase
        .from('domicilio')
        .select(DOMICILIO_SELECT)
        .eq('persona_id', personaId)
        .eq('activo', true)
        .eq('es_actual', true)
        .maybeSingle(),
    ]);

    if (ficha.error) throw ficha.error;
    if (persona.error) throw persona.error;
    if (domicilio.error) throw domicilio.error;
    if (!ficha.data) return null;

    return {
      fichaId: ficha.data.id,
      folio: ficha.data.folio,
      personaId: ficha.data.persona_id,
      estadoCivil: ficha.data.estado_civil,
      ocupacionId: ficha.data.ocupacion_id,
      ocupacionOtra: ficha.data.ocupacion_otra,
      celular: persona.data?.celular ?? null,
      domicilio: mapDomicilioRow(domicilio.data),
    };
  },

  async listarNotas(fichaId: string): Promise<NotaPrivada[]> {
    const { data, error } = await supabase
      .from('nota_area')
      .select(NOTA_SELECT)
      .eq('ficha_id', fichaId)
      .eq('activo', true)
      .order('actualizado_en', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapNotaRow);
  },

  async crearNota(input: NotaPrivadaCreateInput): Promise<NotaPrivada> {
    const { data: auth } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('nota_area')
      .insert({
        ficha_id: input.fichaId,
        area_id: input.areaId,
        contenido: input.contenido.trim(),
        creado_por: auth.session?.user.id ?? null,
      })
      .select(NOTA_SELECT)
      .single();
    if (error) throw error;
    return mapNotaRow(data);
  },

  async actualizarNota(input: NotaPrivadaUpdateInput): Promise<NotaPrivada> {
    const { data, error } = await supabase
      .from('nota_area')
      .update({ contenido: input.contenido.trim() })
      .eq('id', input.id)
      .eq('activo', true)
      .select(NOTA_SELECT)
      .single();
    if (error) throw error;
    return mapNotaRow(data);
  },

  async archivarNota(id: string): Promise<void> {
    const { error } = await supabase.from('nota_area').update({ activo: false }).eq('id', id);
    if (error) throw error;
  },
};
