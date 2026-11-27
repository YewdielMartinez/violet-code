import type { PrioridadNivel } from '../models/Cita';
import type { DomicilioActualizadoResult, DomicilioUpdateInput } from '../models/Domicilio';
import type {
  EstudioSocioeconomicoRegistradoResult,
  EstudioSocioeconomicoRegistroInput,
} from '../models/EstudioSocioeconomico';
import type {
  CambiarPrioridadExpedienteResult,
  FichaActualizada,
  FichaCompletaDetalle,
  FichaCreateInput,
  FichaUpdateInput,
} from '../models/FichaRegistro';
import type { EstadoFicha, PersonaActualizada, PersonaUpdateInput } from '../models/Persona';

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
  /** Edita datos de identidad de la persona atendida vía `actualizar_persona` (bloqueo optimista). */
  actualizarPersona(input: PersonaUpdateInput): Promise<PersonaActualizada>;
  /** Edita campos de la ficha única y sus servicios solicitados vía `actualizar_ficha`. */
  actualizar(input: FichaUpdateInput): Promise<FichaActualizada>;
  /** Registra un nuevo domicilio actual de la persona vía `actualizar_domicilio`. */
  actualizarDomicilio(input: DomicilioUpdateInput): Promise<DomicilioActualizadoResult>;
  /** Cambia la prioridad del expediente vía `cambiar_prioridad_expediente`. */
  cambiarPrioridad(
    fichaId: string,
    prioridad: PrioridadNivel,
  ): Promise<CambiarPrioridadExpedienteResult>;
  /** Registra o corrige el estudio socioeconómico del expediente vía `registrar_estudio_socioeconomico`. */
  registrarEstudioSocioeconomico(
    input: EstudioSocioeconomicoRegistroInput,
  ): Promise<EstudioSocioeconomicoRegistradoResult>;
  /** Archiva un expediente (`estado = 'archivado'`) sin borrado físico mediante RPC. */
  archive(fichaId: string, motivo?: string): Promise<void>;
  /** Reabre (desarchiva) un expediente mediante RPC `reabrir_ficha`; exige motivo. Devuelve el nuevo estado. */
  reopen(fichaId: string, motivo: string): Promise<EstadoFicha>;
  /** Baja lógica (`activo = false`) sin borrado físico. */
  deactivate(fichaId: string): Promise<void>;
}
