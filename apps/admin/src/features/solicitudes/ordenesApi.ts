import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatAgresorNombre } from '@/domain/models/Agresor';
import {
  TAMANO_MAXIMO_BYTES,
  validarArchivo,
  type SubirDocumentoInput,
} from '@/domain/models/DocumentoAdjunto';
import type { OrdenProteccionInput } from '@/domain/models/OrdenProteccion';
import { lineaTiempoQueryKey } from '@/features/seguimiento/api';
import { supabaseAgresorRepository } from '@/infrastructure/supabase/adapters/SupabaseAgresorRepository';
import { supabaseDocumentoStorageRepository } from '@/infrastructure/supabase/adapters/SupabaseDocumentoStorageRepository';
import { supabaseOrdenProteccionRepository } from '@/infrastructure/supabase/adapters/SupabaseOrdenProteccionRepository';

export type {
  EstadoOrdenProteccion,
  OrdenProteccion,
  OrdenProteccionInput,
  OrdenProteccionValidationField,
} from '@/domain/models/OrdenProteccion';

export {
  AUTORIDAD_EMISORA_MAX_LENGTH,
  ESTADO_ORDEN_LABELS,
  ESTADOS_ORDEN_PROTECCION,
  NOTA_CAMBIO_ESTADO_MAX_LENGTH,
  NUMERO_OFICIO_MAX_LENGTH,
  esOrdenVigente,
  fechaHoyLocalMazatlan,
  puedeEscribirOrdenesProteccion,
  puedeVerOrdenesProteccion,
  validarOrdenProteccion,
} from '@/domain/models/OrdenProteccion';

export { TAMANO_MAXIMO_BYTES, validarArchivo };

export const ORDENES_QUERY_KEYS = {
  porFicha: (fichaId: string) => ['solicitudes', 'ordenes_proteccion', fichaId] as const,
  documentosPorFicha: (fichaId: string) => ['expedientes', 'documentos', fichaId] as const,
  documentosOrdenesPorFicha: (fichaId: string) =>
    ['expedientes', 'ordenes_proteccion', fichaId] as const,
  tiposDocumento: () => ['catalogos', 'tipo_documento'] as const,
  agresoresPorFicha: (fichaId: string) => ['expedientes', 'agresores', fichaId] as const,
};

export function useOrdenesProteccion(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: ORDENES_QUERY_KEYS.porFicha(fichaId),
    queryFn: () => supabaseOrdenProteccionRepository.listarPorFicha(fichaId),
    enabled: Boolean(fichaId) && enabled,
  });
}

export function useAgresoresParaOrden(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: ORDENES_QUERY_KEYS.agresoresPorFicha(fichaId),
    queryFn: () => supabaseAgresorRepository.listarPorFicha(fichaId),
    enabled: Boolean(fichaId) && enabled,
    select: (rows) =>
      rows.map((agresor) => ({
        id: agresor.id,
        nombre: formatAgresorNombre(agresor),
      })),
  });
}

export function useDocumentosOrdenes(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: ORDENES_QUERY_KEYS.documentosPorFicha(fichaId),
    queryFn: () => supabaseDocumentoStorageRepository.listarPorFicha(fichaId),
    enabled: Boolean(fichaId) && enabled,
  });
}

export function useTiposDocumentoOrden(enabled = true) {
  return useQuery({
    queryKey: ORDENES_QUERY_KEYS.tiposDocumento(),
    queryFn: () => supabaseDocumentoStorageRepository.listarTipos(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

function invalidateOrdenRelatedQueries(qc: ReturnType<typeof useQueryClient>, fichaId: string) {
  void qc.invalidateQueries({ queryKey: ORDENES_QUERY_KEYS.porFicha(fichaId) });
  void qc.invalidateQueries({ queryKey: ORDENES_QUERY_KEYS.documentosOrdenesPorFicha(fichaId) });
  // Cada cambio de estado queda en el área de Seguimiento (línea de tiempo del expediente).
  void qc.invalidateQueries({ queryKey: lineaTiempoQueryKey(fichaId) });
  void qc.invalidateQueries({ queryKey: ['alertas', 'cola'] });
  void qc.invalidateQueries({ queryKey: ['alerts'] });
}

export function useCrearOrdenProteccion(fichaId: string) {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: OrdenProteccionInput) => supabaseOrdenProteccionRepository.crear(input),
    onSuccess: () => {
      invalidateOrdenRelatedQueries(qc, fichaId);
    },
  });
}

export function useActualizarOrdenProteccion(fichaId: string) {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ id, input }: { id: string; input: OrdenProteccionInput }) =>
      supabaseOrdenProteccionRepository.actualizar(id, input),
    onSuccess: () => {
      invalidateOrdenRelatedQueries(qc, fichaId);
    },
  });
}

export function useDesactivarOrdenProteccion(fichaId: string) {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ id, actualizadoEnEsperado }: { id: string; actualizadoEnEsperado?: string }) =>
      supabaseOrdenProteccionRepository.desactivar(id, actualizadoEnEsperado),
    onSuccess: () => {
      invalidateOrdenRelatedQueries(qc, fichaId);
    },
  });
}

export function useSubirCopiaOrden(fichaId: string) {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({
      input,
      onProgress,
    }: {
      input: SubirDocumentoInput;
      onProgress?: (pct: number) => void;
    }) => supabaseDocumentoStorageRepository.subir(input, onProgress),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ORDENES_QUERY_KEYS.documentosPorFicha(fichaId) });
    },
  });
}

export function useObtenerUrlCopiaOrden() {
  return useMutation({
    retry: false,
    mutationFn: ({ rutaStorage, download }: { rutaStorage: string; download?: string }) =>
      supabaseDocumentoStorageRepository.obtenerUrlFirmada(
        rutaStorage,
        60,
        download ? { download } : undefined,
      ),
  });
}
