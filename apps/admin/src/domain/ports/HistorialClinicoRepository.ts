import type { HistorialClinico, HistorialClinicoGuardarInput } from '../models/HistorialClinico';

export interface HistorialClinicoRepository {
  /** Consulta el historial clínico de una ficha vía `get_historial_clinico` (`null` si aún no existe). */
  obtener(fichaId: string): Promise<HistorialClinico | null>;
  /** Crea o actualiza el historial clínico vía `guardar_historial_clinico` (con bloqueo optimista al editar). */
  guardar(input: HistorialClinicoGuardarInput): Promise<HistorialClinico>;
}
