import type {
  AgendaItem,
  AgendaQuery,
  CambiarEstadoCitaResult,
  CitaCreateInput,
  EstadoCita,
  EstadoCitaGestionable,
} from '../models/Cita';

export interface CitaRepository {
  listarAgenda(query: AgendaQuery): Promise<AgendaItem[]>;
  crear(input: CitaCreateInput): Promise<{ id: string; estado: EstadoCita; programadaEn: string }>;
  cambiarEstado(
    citaId: string,
    estado: EstadoCitaGestionable,
    motivo?: string | null,
  ): Promise<CambiarEstadoCitaResult>;
}
