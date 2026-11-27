import type {
  DerivacionCreateInput,
  DerivacionItem,
  EstadoDerivacion,
  HistorialCanalizacionItem,
} from '../models/Derivacion';

export interface DerivacionRepository {
  list(estado?: EstadoDerivacion): Promise<DerivacionItem[]>;
  listByFicha(fichaId: string): Promise<DerivacionItem[]>;
  /** Consulta el historial completo de canalizaciones de una ficha vía `get_historial_canalizaciones`. */
  historialCanalizaciones(fichaId: string): Promise<HistorialCanalizacionItem[]>;
  create(input: DerivacionCreateInput): Promise<{ id: string; aviso?: string | null }>;
  updateEstado(id: string, estado: EstadoDerivacion): Promise<void>;
}
