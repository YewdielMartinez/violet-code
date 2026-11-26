import type { BitacoraFilters, BitacoraRow, InformeFilters, InformeRow } from '../models/Informe';

export interface InformeRepository {
  /** Consulta informe mensual (si `mes` viene definido) o anual agregado por área sin CURP (`RF-13`). */
  getInforme(filters: InformeFilters): Promise<InformeRow[]>;
  /** Consulta paginada de bitácora de auditoría para Dirección (`RF-22`). */
  getBitacora(filters?: BitacoraFilters): Promise<BitacoraRow[]>;
}
