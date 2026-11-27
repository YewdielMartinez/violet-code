import { useQuery } from '@tanstack/react-query';
import type { BitacoraFilters, InformeFilters } from '@/domain/models/Informe';
import type { ReporteFilters } from '@/domain/models/Reporte';
import { supabaseReporteRepository } from '@/infrastructure/supabase/adapters/SupabaseReporteRepository';
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

export function reporteQueryKey(filters: ReporteFilters) {
  return [
    'informes',
    'reporte',
    filters.tipo,
    filters.desde,
    filters.hasta,
    filters.areaId ?? null,
    filters.agrupar ?? 'mes',
  ] as const;
}

/** Conteos agregados de `get_reporte` (nunca datos personales). */
export function useReporte(filters: ReporteFilters, enabled = true) {
  return useQuery({
    queryKey: reporteQueryKey(filters),
    queryFn: () => supabaseReporteRepository.getReporte(filters),
    enabled,
    staleTime: 60_000,
  });
}

/** Áreas de atención (catálogo) para el selector de Dirección. */
export function useAreas(enabled = true) {
  return useQuery({
    queryKey: ['informes', 'areas'] as const,
    queryFn: () => supabaseReporteRepository.listAreas(),
    enabled,
    staleTime: 5 * 60_000,
  });
}
