import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DerivacionCreateInput, EstadoDerivacion } from '@/domain/models/Derivacion';
import { supabaseDerivacionRepository } from '@/infrastructure/supabase/adapters/SupabaseDerivacionRepository';
import { directoryQueryOptions } from '@/features/directory/api';
import { LINEA_TIEMPO_QUERY_ROOT } from '@/features/seguimiento/queryKeys';
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
  validarTransicionDerivacion,
  validateDerivacion,
} from '@/domain/models/Derivacion';

export function extraerMensajeErrorDerivacion(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

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
    retry: false,
    mutationFn: (input: DerivacionCreateInput) => supabaseDerivacionRepository.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canalizaciones'] });
      void queryClient.invalidateQueries({ queryKey: LINEA_TIEMPO_QUERY_ROOT });
    },
  });
}

export function useUpdateEstadoDerivacion() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ id, estado }: { id: string; estado: EstadoDerivacion }) =>
      supabaseDerivacionRepository.updateEstado(id, estado),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canalizaciones'] });
      // El cambio de estado queda en la línea de tiempo del expediente (`canalizacion_evento`).
      void queryClient.invalidateQueries({ queryKey: LINEA_TIEMPO_QUERY_ROOT });
    },
  });
}

const CANALIZACION_CATALOGOS_STALE_TIME_MS = 5 * 60_000;

/**
 * Catálogos para crear canalizaciones. Reutiliza las consultas (y la caché) existentes:
 * áreas (`['catalogos','area']`), directorio (`['directory','all']`) y listado de expedientes.
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
