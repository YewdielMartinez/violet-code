import type {
  ExpedienteClinico,
  RegistroClinicoInput,
} from '@/domain/models/HistorialClinico';

export interface HistorialClinicoRepository {
  consultar(fichaId: string, signal?: AbortSignal): Promise<ExpedienteClinico | null>;
  guardar(fichaId: string, empleadoId: string, input: RegistroClinicoInput): Promise<void>;
  registrarConsulta(fichaId: string, historialId?: string): Promise<void>;
}
