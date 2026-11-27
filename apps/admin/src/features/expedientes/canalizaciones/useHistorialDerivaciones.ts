import { useQuery } from '@tanstack/react-query';
import { supabaseDerivacionRepository } from '@/infrastructure/supabase/adapters/SupabaseDerivacionRepository';

/**
 * Historial de cambios de estado por canalización de una ficha (get_historial_canalizaciones).
 * La clave cuelga de ['canalizaciones'], así que cualquier cambio de estado la invalida.
 */
export function useHistorialDerivacionesByFicha(fichaId: string | null) {
  return useQuery({
    queryKey: ['canalizaciones', 'historial', fichaId ?? ''],
    queryFn: () =>
      fichaId ? supabaseDerivacionRepository.historialCanalizaciones(fichaId) : Promise.resolve([]),
    enabled: Boolean(fichaId),
  });
}
