import type { ContextoHojaSeguimiento, TipoAtencion } from '../models/HojaSeguimiento';
import type {
  NotaPrivada,
  NotaPrivadaCreateInput,
  NotaPrivadaUpdateInput,
} from '../models/NotaPrivada';
import type {
  LineaTiempoEvento,
  SeguimientoCreateInput,
  SeguimientoResult,
} from '../models/Seguimiento';

export interface SeguimientoRepository {
  /** Registra asistencia, hoja de seguimiento y próxima cita opcional en una transacción (`RF-09`). */
  registrar(input: SeguimientoCreateInput): Promise<SeguimientoResult>;
  /** Consulta la línea de tiempo cronológica del expediente filtrada por rol (`RF-25`, `RN-18`). */
  getLineaTiempo(fichaId: string): Promise<LineaTiempoEvento[]>;
  /** Tipos de atención del catálogo para un área (`cat_tipo_atencion`). */
  listarTiposAtencion(areaId: number): Promise<TipoAtencion[]>;
  /** Expediente activo de la persona y datos vigentes para precargar la hoja (`null` si no tiene ficha). */
  getContextoHoja(personaId: string): Promise<ContextoHojaSeguimiento | null>;
  /** Notas privadas activas del área del actor (`nota_area`, RLS por área — `RF-10`, `RN-18.1`). */
  listarNotas(fichaId: string): Promise<NotaPrivada[]>;
  crearNota(input: NotaPrivadaCreateInput): Promise<NotaPrivada>;
  actualizarNota(input: NotaPrivadaUpdateInput): Promise<NotaPrivada>;
  /** Baja lógica (`activo = false`): nunca hay borrado físico (`RN-15.1`). */
  archivarNota(id: string): Promise<void>;
}
