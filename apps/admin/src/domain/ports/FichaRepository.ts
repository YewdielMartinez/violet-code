import type { FichaCompletaDetalle, FichaCreateInput } from '../models/FichaRegistro';
import type { EstadoFicha } from '../models/Persona';

export interface CreatedFichaResult {
  fichaId: string;
  folio: string;
  personaId: string;
}

export interface FichaRepository {
  /** Crea persona (o reutiliza existente), ficha_registro (folio automático), servicios, domicilio y estudio socioeconómico. */
  createComplete(input: FichaCreateInput): Promise<CreatedFichaResult>;
  /** Consulta el detalle completo del expediente (Ficha Única, Domicilio y Estudio). */
  getDetail(fichaId: string): Promise<FichaCompletaDetalle | null>;
  /** Archiva un expediente (`estado = 'archivado'`) sin borrado físico mediante RPC. */
  archive(fichaId: string, motivo?: string): Promise<void>;
  /** Reabre (desarchiva) un expediente mediante RPC `reabrir_ficha`; exige motivo. Devuelve el nuevo estado. */
  reopen(fichaId: string, motivo: string): Promise<EstadoFicha>;
  /** Baja lógica (`activo = false`) sin borrado físico. */
  deactivate(fichaId: string): Promise<void>;
}
