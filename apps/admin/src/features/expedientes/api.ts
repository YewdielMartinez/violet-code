import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { CatalogoItem, CatalogosFicha, FichaCreateInput } from '@/domain/models/FichaRegistro';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import type { CatalogoNombre } from '@/domain/ports/SepomexRepository';
import { supabaseExpedienteRepository } from '@/infrastructure/supabase/adapters/SupabaseExpedienteRepository';
import { supabaseFichaRepository } from '@/infrastructure/supabase/adapters/SupabaseFichaRepository';
import { supabaseSepomexRepository } from '@/infrastructure/supabase/adapters/SupabaseSepomexRepository';

export type { ExpedienteResumen, PersonaResumen, EstadoFicha } from '@/domain/models/Persona';
export {
  CURP_REGEX,
  ESTADO_FICHA_LABELS,
  detectSearchKind,
  isValidCurp,
  normalizeCurp,
} from '@/domain/models/Persona';
export type { PreRegistroMovil, VerificacionCurpResult } from '@/domain/models/PreRegistroMovil';
export { canLookupPreRegistro } from '@/domain/models/PreRegistroMovil';

/** Opciones compartidas del listado: cualquier consumidor (p. ej. Canalizaciones) reutiliza la misma caché. */
export function expedientesListQueryOptions(query?: string) {
  return queryOptions({
    queryKey: ['expedientes', 'list', query?.trim() ?? ''],
    queryFn: () => supabaseExpedienteRepository.list(query),
  });
}

export function useExpedientes(query?: string) {
  return useQuery(expedientesListQueryOptions(query));
}

export function expedienteByIdQueryOptions(fichaId: string) {
  return queryOptions({
    queryKey: ['expedientes', 'byId', fichaId],
    queryFn: () => supabaseExpedienteRepository.getById(fichaId),
  });
}

export function useExpedienteById(fichaId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['expedientes', 'byId', fichaId ?? ''],
    queryFn: () =>
      fichaId ? supabaseExpedienteRepository.getById(fichaId) : Promise.resolve(null),
    enabled: Boolean(fichaId),
    initialData: () => {
      if (!fichaId) return undefined;
      const list = queryClient.getQueryData<ExpedienteResumen[]>(['expedientes', 'list', '']);
      return list?.find((item) => item.id === fichaId);
    },
  });
}

export function useVerifyCurp() {
  return useMutation({
    mutationFn: ({ curp, allowPreRegistroLookup }: { curp: string; allowPreRegistroLookup: boolean }) =>
      supabaseExpedienteRepository.verifyByCurp(curp, allowPreRegistroLookup),
  });
}

export function useRegisterConsult() {
  return useMutation({
    mutationFn: (fichaId: string) => supabaseExpedienteRepository.registerConsult(fichaId),
  });
}

const CATALOGOS_FICHA_STALE_TIME_MS = 10 * 60_000;

/**
 * Una sola consulta (y una sola entrada de caché) por catálogo institucional, compartida por la
 * Ficha Única, Persona agresora y Canalizaciones. Cada consumidor ordena/recorta con `select`.
 */
export function catalogoQueryOptions(catalogo: CatalogoNombre) {
  return queryOptions({
    queryKey: ['catalogos', catalogo],
    queryFn: () => supabaseSepomexRepository.listCatalogo(catalogo),
    staleTime: CATALOGOS_FICHA_STALE_TIME_MS,
  });
}

const CATALOGOS_FICHA: readonly CatalogoNombre[] = ['area', 'ocupacion', 'parentesco'];

function combineCatalogosFicha(results: UseQueryResult<CatalogoItem[]>[]) {
  const [areas, ocupaciones, parentescos] = results;
  const data: CatalogosFicha | undefined =
    areas.data && ocupaciones.data && parentescos.data
      ? { areas: areas.data, ocupaciones: ocupaciones.data, parentescos: parentescos.data }
      : undefined;
  return {
    data,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

export function useCatalogosFicha(enabled = true) {
  return useQueries({
    queries: CATALOGOS_FICHA.map((catalogo) => ({ ...catalogoQueryOptions(catalogo), enabled })),
    combine: combineCatalogosFicha,
  });
}

export function useAsentamientosSepomex(codigoPostal?: string, enabled = true) {
  const cp = codigoPostal?.trim() ?? '';
  return useQuery({
    queryKey: ['sepomex', 'asentamientos', cp],
    queryFn: () => supabaseSepomexRepository.listAsentamientos(cp || undefined),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function fichaDetailQueryOptions(fichaId: string) {
  return queryOptions({
    queryKey: ['expedientes', 'detail', fichaId],
    queryFn: () => supabaseFichaRepository.getDetail(fichaId),
  });
}

export function useFichaDetail(fichaId: string | null) {
  return useQuery({
    ...fichaDetailQueryOptions(fichaId ?? ''),
    enabled: Boolean(fichaId),
  });
}

export function useCreateFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FichaCreateInput) => supabaseFichaRepository.createComplete(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}

export function useArchiveFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => supabaseFichaRepository.archive(fichaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}

export function useDeactivateFicha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => supabaseFichaRepository.deactivate(fichaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
    },
  });
}
