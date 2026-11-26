import { useMutation, useQuery } from '@tanstack/react-query';
import { supabaseExpedienteRepository } from '@/infrastructure/supabase/adapters/SupabaseExpedienteRepository';

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
