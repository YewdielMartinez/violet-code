import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentoAdjunto, SubirDocumentoInput } from '@/domain/models/DocumentoAdjunto';
import { esImagen, inferirMimeDesdeNombre } from '@/domain/models/DocumentoAdjunto';
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
  thumbnail: (docId: string, rutaStorage: string) =>
    ['expedientes', 'documentos', 'thumb', docId, rutaStorage] as const,
};

const THUMB_TTL_SECONDS = 60;
const THUMB_FRESH_MS = 45_000;

/**
 * Carga en paralelo URLs firmadas temporales (60 s) para las miniaturas de imágenes activas.
 * Nunca usa URLs públicas y evita efectos manuales con setState.
 */
export function useDocumentoThumbnails(documentos: DocumentoAdjunto[], enabled = true) {
  const imageDocs = documentos.filter((doc) => esImagen(inferirMimeDesdeNombre(doc.nombreArchivo)));

  const results = useQueries({
    queries: imageDocs.map((doc) => ({
      queryKey: DOCUMENTOS_QUERY_KEYS.thumbnail(doc.id, doc.rutaStorage),
      queryFn: () =>
        supabaseDocumentoStorageRepository.obtenerUrlFirmada(doc.rutaStorage, THUMB_TTL_SECONDS),
      enabled,
      staleTime: THUMB_FRESH_MS,
      gcTime: THUMB_TTL_SECONDS * 1000,
      retry: false,
    })),
  });

  const urlsById: Record<string, string> = {};
  const loadingIds: Record<string, boolean> = {};

  imageDocs.forEach((doc, index) => {
    const res = results[index];
    if (!res) return;
    if (res.data) urlsById[doc.id] = res.data;
    if (res.isPending || res.isFetching) loadingIds[doc.id] = true;
  });

  return { urlsById, loadingIds };
}

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
