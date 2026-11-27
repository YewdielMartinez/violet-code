import type {
  ContextoHojaSeguimiento,
  ContextoSeguimiento,
  CorregirSeguimientoInput,
  CorregirSeguimientoResult,
  TipoAtencion,
} from '../models/HojaSeguimiento';
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
  /** Consulta el contexto mínimo de la cita del día vía `get_contexto_seguimiento`. */
  contexto(citaId: string): Promise<ContextoSeguimiento>;
  /** Corrige una atención el mismo día por su autora vía `corregir_seguimiento` (bloqueo optimista). */
  corregir(input: CorregirSeguimientoInput): Promise<CorregirSeguimientoResult>;
  /** Consulta la línea de tiempo cronológica del expediente filtrada por rol (`RF-25`, `RN-18`). */
  getLineaTiempo(fichaId: string): Promise<LineaTiempoEvento[]>;
  /** Tipos de atención del catálogo para un área (`cat_tipo_atencion`). */
  listarTiposAtencion(areaId: number): Promise<TipoAtencion[]>;
  /** Expediente activo de la persona y datos vigentes para precargar la hoja (`null` si no tiene ficha). */
  getContextoHoja(personaId: string): Promise<ContextoHojaSeguimiento | null>;
  /** Notas privadas activas (`nota_area`, RLS: cada área ve las suyas; Titular y Subdirección ven las de TS y Jurídico en solo lectura, nunca las de Psicología — `RF-10`, `RN-18.1`, migración 71). */
  listarNotas(fichaId: string): Promise<NotaPrivada[]>;
  crearNota(input: NotaPrivadaCreateInput): Promise<NotaPrivada>;
  actualizarNota(input: NotaPrivadaUpdateInput): Promise<NotaPrivada>;
  /** Baja lógica (`activo = false`): nunca hay borrado físico (`RN-15.1`). */
  archivarNota(id: string): Promise<void>;
}
