import { supabase } from '../client';
import type { Database } from '../database.types';
import { mapSupabaseError } from './errors';
import type { HistorialClinico, HistorialClinicoGuardarInput } from '@/domain/models/HistorialClinico';
import type { HistorialClinicoRepository } from '@/domain/ports/HistorialClinicoRepository';

type RpcFunctions = Database['public']['Functions'];
type GetHistorialRow = RpcFunctions['get_historial_clinico']['Returns'][number];
type GuardarHistorialRow = RpcFunctions['guardar_historial_clinico']['Returns'][number];

function mapHistorialRow(row: GetHistorialRow | GuardarHistorialRow): HistorialClinico {
  return {
    id: row.id,
    fichaId: row.ficha_id,
    motivoConsulta: row.motivo_consulta ?? null,
    antecedentesPersonales: row.antecedentes_personales ?? null,
    antecedentesFamiliares: row.antecedentes_familiares ?? null,
    tieneAtencionPsicologicaPrevia: row.tiene_atencion_psicologica_previa ?? null,
    observacionesIniciales: row.observaciones_iniciales ?? null,
    creadoEn: 'creado_en' in row ? (row.creado_en ?? null) : null,
    actualizadoEn: row.actualizado_en,
  };
}

function toOptionalRpcText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.trim();
}

export const supabaseHistorialClinicoRepository: HistorialClinicoRepository = {
  async obtener(fichaId: string): Promise<HistorialClinico | null> {
    const { data, error } = await supabase.rpc('get_historial_clinico', {
      p_ficha_id: fichaId,
    });

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapHistorialRow(row) : null;
  },

  async guardar(input: HistorialClinicoGuardarInput): Promise<HistorialClinico> {
    const { data, error } = await supabase.rpc('guardar_historial_clinico', {
      p_ficha_id: input.fichaId,
      p_actualizado_en: input.actualizadoEn ?? undefined,
      p_motivo_consulta: toOptionalRpcText(input.motivoConsulta),
      p_antecedentes_personales: toOptionalRpcText(input.antecedentesPersonales),
      p_antecedentes_familiares: toOptionalRpcText(input.antecedentesFamiliares),
      p_tiene_atencion_psicologica_previa: input.tieneAtencionPsicologicaPrevia ?? undefined,
      p_observaciones_iniciales: toOptionalRpcText(input.observacionesIniciales),
    });

    if (error) throw mapSupabaseError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('El servidor no devolvió el historial clínico guardado.');
    }
    return mapHistorialRow(row);
  },
};
