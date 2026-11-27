import {
  HISTORIAL_CLINICO_CAMPOS,
  type HistorialClinicoCampo,
  type HistorialClinicoVersion,
} from '@/domain/models/HistorialClinico';

/**
 * Fila de `get_historial_clinico_versiones` (migración 67).
 * TODO: sale de `database.types.ts` al regenerarlo con `supabase gen types`.
 */
export interface HistorialClinicoVersionRow {
  id: string;
  historial_clinico_id: string;
  ficha_id: string;
  version: number;
  antecedentes_familiares: string | null;
  antecedentes_personales: string | null;
  motivo_consulta: string | null;
  observaciones_iniciales: string | null;
  tiene_atencion_psicologica_previa: boolean | null;
  campos_modificados: string[] | null;
  creado_por: string | null;
  creado_por_nombre: string | null;
  creado_en: string;
}

/** Nombre de columna en la base a campo del modelo. */
const CAMPO_POR_COLUMNA: Record<string, HistorialClinicoCampo> = {
  motivo_consulta: 'motivoConsulta',
  antecedentes_personales: 'antecedentesPersonales',
  antecedentes_familiares: 'antecedentesFamiliares',
  tiene_atencion_psicologica_previa: 'tieneAtencionPsicologicaPrevia',
  observaciones_iniciales: 'observacionesIniciales',
};

export function mapHistorialClinicoVersionRow(row: HistorialClinicoVersionRow): HistorialClinicoVersion {
  const modificados = new Set<HistorialClinicoCampo>();
  for (const columna of row.campos_modificados ?? []) {
    const campo = CAMPO_POR_COLUMNA[columna];
    if (campo) modificados.add(campo);
  }

  return {
    id: row.id,
    historialClinicoId: row.historial_clinico_id,
    fichaId: row.ficha_id,
    version: row.version,
    motivoConsulta: row.motivo_consulta ?? null,
    antecedentesPersonales: row.antecedentes_personales ?? null,
    antecedentesFamiliares: row.antecedentes_familiares ?? null,
    tieneAtencionPsicologicaPrevia: row.tiene_atencion_psicologica_previa ?? null,
    observacionesIniciales: row.observaciones_iniciales ?? null,
    // Orden canónico de presentación, sin depender del orden de la base.
    camposModificados: HISTORIAL_CLINICO_CAMPOS.filter((campo) => modificados.has(campo)),
    creadoPor: row.creado_por ?? null,
    creadoPorNombre: row.creado_por_nombre?.trim() || null,
    creadoEn: row.creado_en,
  };
}
