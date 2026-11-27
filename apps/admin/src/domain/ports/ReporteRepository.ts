import type { AreaOption, ReporteFilters, ReporteRow } from '../models/Reporte';

export interface ReporteRepository {
  /** Conteos agregados por área y periodo según el tipo de reporte (`RF-13`); nunca datos personales. */
  getReporte(filters: ReporteFilters): Promise<ReporteRow[]>;
  /** Áreas de atención para el selector de Dirección. */
  listAreas(): Promise<AreaOption[]>;
}
