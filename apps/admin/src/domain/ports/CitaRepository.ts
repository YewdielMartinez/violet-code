import type {
  AgendaItem,
  AgendaQuery,
  CambiarEstadoCitaResult,
  CitaCreateInput,
  EstadoCita,
  EstadoCitaGestionable,
  ListaUrgenciasItem,
  PersonaAgendaItem,
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
  /** Búsqueda por nombre/apellidos o prefijo de CURP (≥ 3 caracteres) para agendar; excluye fichas archivadas. */
  buscarPersonas(termino: string, limite?: number): Promise<PersonaAgendaItem[]>;
  listarUrgencias(areaId?: number | null): Promise<ListaUrgenciasItem[]>;
}
