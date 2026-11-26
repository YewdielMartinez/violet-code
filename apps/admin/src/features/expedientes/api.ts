import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaCreateInput } from '@/domain/models/FichaRegistro';
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

export function useExpedientes(query?: string) {
  return useQuery({
    queryKey: ['expedientes', 'list', query?.trim() ?? ''],
    queryFn: () => supabaseExpedienteRepository.list(query),
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

export function useCatalogosFicha(enabled = true) {
  return useQuery({
    queryKey: ['expedientes', 'catalogos'],
    queryFn: () => supabaseSepomexRepository.getCatalogosFicha(),
    staleTime: 10 * 60_000,
    enabled,
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

export function useFichaDetail(fichaId: string | null) {
  return useQuery({
    queryKey: ['expedientes', 'detail', fichaId ?? ''],
    queryFn: () => (fichaId ? supabaseFichaRepository.getDetail(fichaId) : Promise.resolve(null)),
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
