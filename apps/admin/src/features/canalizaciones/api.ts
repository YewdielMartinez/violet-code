import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DerivacionCreateInput, EstadoDerivacion } from '@/domain/models/Derivacion';
import { supabaseDerivacionRepository } from '@/infrastructure/supabase/adapters/SupabaseDerivacionRepository';
import { directoryQueryOptions } from '@/features/directory/api';
import { catalogoQueryOptions, expedientesListQueryOptions } from '@/features/expedientes/api';

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

const CANALIZACION_CATALOGOS_STALE_TIME_MS = 5 * 60_000;

/**
 * Catálogos del diálogo de canalización. Reutiliza las consultas (y la caché) ya existentes:
 * áreas (`['catalogos','area']`), directorio (`['directory','all']`) y listado de expedientes
 * (`['expedientes','list','']`). El listado solo se pide si hay que elegir expediente.
 */
export function useCanalizacionCatalogos({
  enabled = true,
  includeExpedientes = true,
}: { enabled?: boolean; includeExpedientes?: boolean } = {}) {
  const staleTime = CANALIZACION_CATALOGOS_STALE_TIME_MS;
  const areas = useQuery({ ...catalogoQueryOptions('area'), enabled });
  const instituciones = useQuery({ ...directoryQueryOptions(), staleTime, enabled });
  const expedientes = useQuery({
    ...expedientesListQueryOptions(),
    staleTime,
    enabled: enabled && includeExpedientes,
  });
  return {
    areas: areas.data,
    instituciones: instituciones.data,
    expedientes: expedientes.data,
  };
}
