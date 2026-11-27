import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
} from '@/domain/models/ActividadPreventiva';
import { supabaseActividadPreventivaRepository } from '@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository';

export function actividadesQueryKey(filters?: ActividadPreventivaFilters) {
  return [
    'actividades-preventivas',
    filters?.desde ?? null,
    filters?.hasta ?? null,
    filters?.limite ?? 100,
  ] as const;
}

export function useActividadesPreventivas(filters?: ActividadPreventivaFilters, enabled = true) {
  return useQuery({
    queryKey: actividadesQueryKey(filters),
    queryFn: () => supabaseActividadPreventivaRepository.list(filters),
    enabled,
  });
}

export function useRegistrarActividadPreventiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActividadPreventivaCreateInput) =>
      supabaseActividadPreventivaRepository.registrar(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['actividades-preventivas'] });
    },
  });
}
