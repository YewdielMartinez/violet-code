import { queryOptions, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  aplicarCambioEstado,
  type ActividadEstadoCambioInput,
} from '@/domain/models/ActividadEstado';
import type {
  ActividadPreventivaCreateInput,
  ActividadPreventivaFilters,
  ActividadPreventivaItem,
} from '@/domain/models/ActividadPreventiva';
import { supabaseActividadPreventivaRepository } from '@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository';

const CATALOGO_STALE_TIME_MS = 1000 * 60 * 30;
const BASE_KEY = ['actividades-preventivas'] as const;

export function actividadesQueryKey(filters?: ActividadPreventivaFilters) {
  return [
    ...BASE_KEY,
    filters?.estado ?? null,
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
    // La lista puede no estar montada (el alta es una página aparte): se marca como vencida incluso si está
    // inactiva y se espera a que termine, para que al volver ya aparezca la actividad nueva.
    onSuccess: () => qc.invalidateQueries({ queryKey: BASE_KEY, refetchType: 'all' }),
  });
}

type ListaEnCache = readonly [QueryKey, ActividadPreventivaItem[] | undefined];

/** Las listas de actividades en caché (los catálogos `tipos` / `empleados` no son listas de actividades). */
function listasEnCache(qc: ReturnType<typeof useQueryClient>): ListaEnCache[] {
  return qc
    .getQueriesData<ActividadPreventivaItem[]>({ queryKey: BASE_KEY })
    .filter(([key]) => key[1] !== 'tipos' && key[1] !== 'empleados');
}

/**
 * Cambia el estado de una actividad (`actualizar_estado_actividad`): realizar, cancelar o reabrir.
 * Optimista: las listas en caché reflejan el cambio al instante; si el servidor lo rechaza se restauran, y al
 * terminar se invalidan para traer la verdad del servidor (p. ej. `realizada_en`).
 */
export function useCambiarEstadoActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActividadEstadoCambioInput) => supabaseActividadPreventivaRepository.actualizarEstado(input),
    retry: false,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: BASE_KEY });
      const previas = listasEnCache(qc);
      const ahoraIso = new Date().toISOString();
      for (const [key, data] of previas) {
        if (!Array.isArray(data)) continue;
        qc.setQueryData<ActividadPreventivaItem[]>(
          key,
          data.map((item) => (item.id === input.actividadId ? aplicarCambioEstado(item, input, ahoraIso) : item)),
        );
      }
      return { previas };
    },
    onError: (_error, _input, contexto) => {
      for (const [key, data] of contexto?.previas ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: BASE_KEY });
    },
  });
}
