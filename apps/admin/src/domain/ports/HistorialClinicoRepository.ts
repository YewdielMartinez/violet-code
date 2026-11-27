import type {
  HistorialClinico,
  HistorialClinicoGuardarInput,
  HistorialClinicoVersion,
} from '../models/HistorialClinico';

export interface HistorialClinicoRepository {
  /** Consulta el historial clínico de una ficha vía `get_historial_clinico` (`null` si aún no existe). */
  obtener(fichaId: string): Promise<HistorialClinico | null>;
  /** Crea o actualiza el historial clínico vía `guardar_historial_clinico` (solo Psicología; bloqueo optimista al editar). */
  guardar(input: HistorialClinicoGuardarInput): Promise<HistorialClinico>;
  /** Versiones guardadas (más reciente primero) vía `get_historial_clinico_versiones`. */
  versiones(fichaId: string): Promise<HistorialClinicoVersion[]>;
}
