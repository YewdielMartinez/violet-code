import type { DerivacionCreateInput, DerivacionItem, EstadoDerivacion } from '../models/Derivacion';

export interface DerivacionRepository {
  list(estado?: EstadoDerivacion): Promise<DerivacionItem[]>;
  listByFicha(fichaId: string): Promise<DerivacionItem[]>;
  create(input: DerivacionCreateInput): Promise<{ id: string }>;
  updateEstado(id: string, estado: EstadoDerivacion): Promise<void>;
}
