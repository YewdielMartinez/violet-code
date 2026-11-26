import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DerivacionCreateInput, EstadoDerivacion } from '@/domain/models/Derivacion';
import { supabaseDerivacionRepository } from '@/infrastructure/supabase/adapters/SupabaseDerivacionRepository';
import { supabaseDirectorioRepository } from '@/infrastructure/supabase/adapters/SupabaseDirectorioRepository';
import { supabaseExpedienteRepository } from '@/infrastructure/supabase/adapters/SupabaseExpedienteRepository';
import { supabaseSepomexRepository } from '@/infrastructure/supabase/adapters/SupabaseSepomexRepository';

export type {
  DerivacionCreateInput,
  DerivacionItem,
  DestinoDerivacion,
  EstadoDerivacion,
} from '@/domain/models/Derivacion';
export {
  DESTINO_LABELS,
  DESTINOS_DERIVACION,
  ESTADO_DERIVACION_LABELS,
  ESTADOS_DERIVACION,
  isInternalDestino,
  validateDerivacion,
} from '@/domain/models/Derivacion';

export function useDerivaciones(estado?: EstadoDerivacion) {
  return useQuery({
    queryKey: ['canalizaciones', 'list', estado ?? 'all'],
    queryFn: () => supabaseDerivacionRepository.list(estado),
  });
}

export function useDerivacionesByFicha(fichaId: string | null) {
  return useQuery({
    queryKey: ['canalizaciones', 'ficha', fichaId ?? ''],
    queryFn: () =>
      fichaId ? supabaseDerivacionRepository.listByFicha(fichaId) : Promise.resolve([]),
    enabled: Boolean(fichaId),
  });
}

export function useCreateDerivacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DerivacionCreateInput) => supabaseDerivacionRepository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canalizaciones'] });
    },
  });
}

export function useUpdateEstadoDerivacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoDerivacion }) =>
      supabaseDerivacionRepository.updateEstado(id, estado),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canalizaciones'] });
    },
  });
}

export function useCanalizacionCatalogos(enabled = true) {
  return useQuery({
    queryKey: ['canalizaciones', 'catalogos'],
    queryFn: async () => {
      const [catalogos, instituciones, expedientes] = await Promise.all([
        supabaseSepomexRepository.getCatalogosFicha(),
        supabaseDirectorioRepository.listar(),
        supabaseExpedienteRepository.list(),
      ]);
      return {
        areas: catalogos.areas,
        instituciones,
        expedientes,
      };
    },
    staleTime: 5 * 60_000,
    enabled,
  });
}
