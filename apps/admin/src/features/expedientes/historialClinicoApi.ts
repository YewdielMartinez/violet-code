import { useQuery } from '@tanstack/react-query';
import { supabaseHistorialClinicoRepository } from '@/infrastructure/supabase/adapters/SupabaseHistorialClinicoRepository';

/**
 * Versiones del historial clínico (más reciente primero). Su clave cuelga de
 * `['expedientes', 'historial-clinico', fichaId]`, así que `useGuardarHistorialClinico` (api.ts) la
 * invalida junto con el historial sin tocar ese archivo.
 */
export function useHistorialClinicoVersiones(fichaId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['expedientes', 'historial-clinico', fichaId ?? '', 'versiones'],
    queryFn: () =>
      fichaId ? supabaseHistorialClinicoRepository.versiones(fichaId) : Promise.resolve([]),
    enabled: Boolean(fichaId) && enabled,
  });
}
