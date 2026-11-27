import { useQuery } from '@tanstack/react-query';
import type { BitacoraFilters, InformeFilters } from '@/domain/models/Informe';
import { supabaseInformeRepository } from '@/infrastructure/supabase/adapters/SupabaseInformeRepository';

export function informeQueryKey(filters: InformeFilters) {
  return ['informes', 'resumen', filters.anio, filters.mes ?? null, filters.areaId ?? null] as const;
}

export function bitacoraQueryKey(filters?: BitacoraFilters) {
  return [
    'informes',
    'bitacora',
    filters?.desde ?? null,
    filters?.hasta ?? null,
    filters?.tabla ?? null,
    filters?.empleadoId ?? null,
    filters?.limite ?? 100,
  ] as const;
}

export function useInforme(filters: InformeFilters, enabled = true) {
  return useQuery({
    queryKey: informeQueryKey(filters),
    queryFn: () => supabaseInformeRepository.getInforme(filters),
    enabled: enabled && Number.isInteger(filters.anio),
  });
}

export function useBitacora(filters?: BitacoraFilters, enabled = true) {
  return useQuery({
    queryKey: bitacoraQueryKey(filters),
    queryFn: () => supabaseInformeRepository.getBitacora(filters),
    enabled,
  });
}
