import type {
  AgendaItem,
  AgendaQuery,
  CambiarEstadoCitaResult,
  CitaCreateInput,
  EstadoCita,
  EstadoCitaGestionable,
  ListaUrgenciasItem,
  ReagendarCitaInput,
  ReagendarCitaResult,
} from '../models/Cita';

export interface CitaRepository {
  listarAgenda(query: AgendaQuery): Promise<AgendaItem[]>;
  crear(input: CitaCreateInput): Promise<{ id: string; estado: EstadoCita; programadaEn: string }>;
  cambiarEstado(
    citaId: string,
    estado: EstadoCitaGestionable,
    motivo?: string | null,
  ): Promise<CambiarEstadoCitaResult>;
  reagendar(input: ReagendarCitaInput): Promise<ReagendarCitaResult>;
  listarUrgencias(areaId?: number | null): Promise<ListaUrgenciasItem[]>;
}
