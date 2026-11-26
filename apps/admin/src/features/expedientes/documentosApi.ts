import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubirDocumentoInput } from '@/domain/models/DocumentoAdjunto';
import type { UrlFirmadaOpciones } from '@/domain/ports/DocumentoStorageRepository';
import { supabaseDocumentoStorageRepository } from '@/infrastructure/supabase/adapters/SupabaseDocumentoStorageRepository';

export type {
  ArchivoValidable,
  DocumentoAdjunto,
  OrdenProteccionOpcion,
  SubirDocumentoInput,
  TipoDocumento,
  ValidarDocumentoInput,
} from '@/domain/models/DocumentoAdjunto';

export {
  DESCRIPCION_MAX_LENGTH,
  MIME_PERMITIDOS,
  TAMANO_MAXIMO_BYTES,
  esImagen,
  inferirMimeDesdeNombre,
  puedeVerDocumentos,
  validarArchivo,
  validarDocumento,
} from '@/domain/models/DocumentoAdjunto';

export const DOCUMENTOS_QUERY_KEYS = {
  porFicha: (fichaId: string) => ['expedientes', 'documentos', fichaId] as const,
  tipos: () => ['catalogos', 'tipo_documento'] as const,
  ordenesPorFicha: (fichaId: string) => ['expedientes', 'ordenes_proteccion', fichaId] as const,
};

export function useDocumentos(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: DOCUMENTOS_QUERY_KEYS.porFicha(fichaId),
    queryFn: () => supabaseDocumentoStorageRepository.listarPorFicha(fichaId),
    enabled: Boolean(fichaId) && enabled,
  });
}

export function useTiposDocumento(enabled = true) {
  return useQuery({
    queryKey: DOCUMENTOS_QUERY_KEYS.tipos(),
    queryFn: () => supabaseDocumentoStorageRepository.listarTipos(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useOrdenesProteccionDocumento(fichaId: string, enabled = true) {
  return useQuery({
    queryKey: DOCUMENTOS_QUERY_KEYS.ordenesPorFicha(fichaId),
    queryFn: () => supabaseDocumentoStorageRepository.listarOrdenesProteccion(fichaId),
    enabled: Boolean(fichaId) && enabled,
  });
}

export interface SubirDocumentoVariables {
  input: SubirDocumentoInput;
  onProgress?: (porcentaje: number) => void;
}

export function useSubirDocumento(fichaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: ({ input, onProgress }: SubirDocumentoVariables) =>
      supabaseDocumentoStorageRepository.subir(input, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: DOCUMENTOS_QUERY_KEYS.porFicha(fichaId),
      });
    },
  });
}

export interface UrlFirmadaVariables {
  rutaStorage: string;
  segundos?: number;
  opciones?: UrlFirmadaOpciones;
}

export function useUrlFirmada() {
  return useMutation({
    retry: false,
    mutationFn: ({ rutaStorage, segundos = 60, opciones }: UrlFirmadaVariables) =>
      supabaseDocumentoStorageRepository.obtenerUrlFirmada(rutaStorage, segundos, opciones),
  });
}

export function useArchivarDocumento(fichaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (id: string) => supabaseDocumentoStorageRepository.archivar(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: DOCUMENTOS_QUERY_KEYS.porFicha(fichaId),
      });
    },
  });
}
