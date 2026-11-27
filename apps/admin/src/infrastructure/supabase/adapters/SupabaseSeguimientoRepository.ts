import { supabase } from '../client';
import type {
  ContextoHojaSeguimiento,
  HojaSeguimientoCopia,
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
  isEventType,
  mapDomicilioRow,
  mapNotaRow,
  mapTipoAtencionRow,
  toAtencionCopiaUpdate,
  toDomicilioHistoricoInsert,
} from './seguimiento.mapper';

/** Guarda la copia histórica del día sobre la atención recién creada (RLS `atencion_update` por área). */
async function guardarCopiaHoja(atencionId: string, copia: HojaSeguimientoCopia): Promise<void> {
  let domicilioId: string | null = null;
  if (copia.domicilio) {
    const { data, error } = await supabase
      .from('domicilio')
      .insert(toDomicilioHistoricoInsert(copia.personaId, copia.domicilio))
      .select('id')
      .single();
    if (error) throw error;
    domicilioId = data.id;
  }

  const { error } = await supabase
    .from('atencion')
    .update(toAtencionCopiaUpdate(copia, domicilioId))
    .eq('id', atencionId);
  if (error) throw error;
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

    const result: SeguimientoResult = {
      atencionId: row.atencion_id,
      folioSeguimiento: '',
      citaProximaId: row.cita_proxima_id ?? null,
      esPrimeraVezArea: row.es_primera_vez_area,
      tieneHistorialClinico: row.tiene_historial_clinico,
    };

    if (input.copia) {
      // La hoja ya quedó registrada: si la copia falla no se lanza (reintentar duplicaría la hoja).
      try {
        await guardarCopiaHoja(result.atencionId, input.copia);
        result.copiaGuardada = true;
      } catch {
        result.copiaGuardada = false;
      }
    }

    return result;
  },

  async getLineaTiempo(fichaId: string): Promise<LineaTiempoEvento[]> {
    const { data, error } = await supabase.rpc('get_linea_tiempo', {
      p_ficha_id: fichaId,
    });

    if (error) throw error;

    return (data ?? []).flatMap((row) =>
      isEventType(row.tipo)
        ? [
            {
              fecha: row.fecha,
              tipo: row.tipo,
              area: row.area ?? null,
              titulo: row.titulo,
              detalle: row.detalle ?? null,
              referenciaId: row.referencia_id,
            },
          ]
        : [],
    );
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
