import type { ExpedienteResumen } from '@/domain/models/Persona';
import { calculateAge } from '@/features/expedientes/drawer/formatters';
import { isInternalDestino, type DestinoDerivacion } from './api';

/**
 * Reglas de negocio que se avisan antes de enviar (la base de datos las vuelve a validar):
 * - `RN-01`: Psicología y Jurídico solo atienden a mayores de 18 años.
 * - `RN-03`: a un hombre que no es tema jurídico se le canaliza a una institución externa.
 */
export function validarReglasDestino(
  persona: ExpedienteResumen['persona'] | null | undefined,
  destino: DestinoDerivacion,
): string | null {
  if (!persona) return null;
  const age = calculateAge(persona.fechaNacimiento);
  if ((destino === 'psicologia' || destino === 'juridico') && age !== null && age < 18) {
    return 'Psicología y Jurídico solo atienden a personas mayores de 18 años (RN-01).';
  }
  if (persona.sexo === 'H' && isInternalDestino(destino) && destino !== 'juridico') {
    return 'A un hombre que no es tema jurídico se le canaliza a una institución externa (RN-03).';
  }
  return null;
}
