export interface HistorialClinico {
  id: string;
  fichaId: string;
  motivoConsulta: string | null;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
  tieneAtencionPsicologicaPrevia: boolean | null;
  observacionesIniciales: string | null;
  creadoEn: string | null;
  actualizadoEn: string;
}

export interface HistorialClinicoGuardarInput {
  fichaId: string;
  /** Obligatorio al editar (`get_historial_clinico` previo); omitir o `null` al crear. */
  actualizadoEn?: string | null;
  motivoConsulta?: string | null;
  antecedentesPersonales?: string | null;
  antecedentesFamiliares?: string | null;
  tieneAtencionPsicologicaPrevia?: boolean | null;
  observacionesIniciales?: string | null;
}
