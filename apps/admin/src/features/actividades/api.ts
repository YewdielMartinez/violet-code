import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
} from '@/domain/models/ActividadPreventiva';
import { supabaseActividadPreventivaRepository } from '@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository';

const CATALOGO_STALE_TIME_MS = 1000 * 60 * 30;

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

export const tiposActividadQueryOptions = queryOptions({
  queryKey: ['actividades-preventivas', 'tipos'],
  queryFn: () => supabaseActividadPreventivaRepository.listTipos(),
  staleTime: CATALOGO_STALE_TIME_MS,
});

export function useTiposActividad(enabled = true) {
  return useQuery({ ...tiposActividadQueryOptions, enabled });
}

export function useEmpleadosParticipantes(enabled = true) {
  return useQuery({
    queryKey: ['actividades-preventivas', 'empleados'],
    queryFn: () => supabaseActividadPreventivaRepository.listEmpleados(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

export function useRegistrarActividadPreventiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActividadPreventivaCreateInput) =>
      supabaseActividadPreventivaRepository.registrar(input),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['actividades-preventivas'] });
    },
  });
}
