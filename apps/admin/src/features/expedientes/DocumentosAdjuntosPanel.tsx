import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, toast, type PreviewImage } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import type { EstadoFicha } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { formatErrorEscrituraExpediente } from './api';
import { DocumentoList } from './DocumentoList';
import { DocumentoSummaryHeader } from './documentos/DocumentoSummaryHeader';
import {
  SIGNED_URL_TTL_SECONDS,
  prefersReducedMotion,
  type ChecklistSlotKey,
} from './documentos/documentoGrouping';
import {
  DOCUMENTOS_QUERY_KEYS,
  esImagen,
  inferirMimeDesdeNombre,
  puedeVerDocumentos,
  useArchivarDocumento,
  useDocumentos,
  useDocumentoThumbnails,
  useOrdenesProteccionDocumento,
  useSubirDocumento,
  useTiposDocumento,
  useUrlFirmada,
  type DocumentoAdjunto,
} from './documentosApi';

export interface DocumentosAdjuntosPanelProps {
  fichaId: string;
  estado?: EstadoFicha;
}

function abrirEnNuevaPestana(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function descargarDesdeUrl(url: string, nombreArchivo: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Panel inline de documentos adjuntos privados de un expediente (`RF-35`, `RF-35.1`).
 * Organizado por ranuras de checklist con carga directa por tipo y acciones inline sin diálogos.
 */
export function DocumentosAdjuntosPanel({ fichaId, estado }: DocumentosAdjuntosPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const autorizado = puedeVerDocumentos(user?.role);
  const isArchivado = estado === 'archivado';

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [archivingDocId, setArchivingDocId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

  const previewReturnFocusRef = useRef<HTMLElement | null>(null);

  const documentosQuery = useDocumentos(fichaId, autorizado);
  const tiposQuery = useTiposDocumento(autorizado);
  const ordenesQuery = useOrdenesProteccionDocumento(fichaId, autorizado);
  const subirMutation = useSubirDocumento(fichaId);
  const urlFirmadaMutation = useUrlFirmada();
  const archivarMutation = useArchivarDocumento(fichaId);

  const { urlsById: thumbnailsById, loadingIds: loadingThumbIds } = useDocumentoThumbnails(
    documentosQuery.data ?? [],
    autorizado,
  );

  const ordenesLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const orden of ordenesQuery.data ?? []) {
      map.set(orden.id, orden.label);
    }
    return map;
  }, [ordenesQuery.data]);

  if (!autorizado) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <EmptyState
          illustration="error"
          title="Acceso restringido"
          description="Tu rol no cuenta con permisos para consultar ni adjuntar documentos del expediente."
        />
      </div>
    );
  }

  function handleRefreshThumbnail(doc: DocumentoAdjunto) {
    void queryClient.invalidateQueries({
      queryKey: DOCUMENTOS_QUERY_KEYS.thumbnail(doc.id, doc.rutaStorage),
    });
  }

  function handleThumbnailError(doc: DocumentoAdjunto) {
    queryClient.removeQueries({
      queryKey: DOCUMENTOS_QUERY_KEYS.thumbnail(doc.id, doc.rutaStorage),
    });
  }

  function handleFocusSlot(slotKey: ChecklistSlotKey) {
    const slotEl = document.getElementById(`doc-slot-${slotKey}`);
    if (!slotEl) return;

    // motion-kit dialogs usan un viewport propio; buscamos el ancestro scrollable
    const scrollParent = slotEl.closest<HTMLElement>('[data-mk-scroll-viewport]');
    if (scrollParent) {
      // Calcula el offset del slot relativo al viewport scrollable
      let top = 0;
      let el: HTMLElement | null = slotEl;
      while (el && el !== scrollParent) {
        top += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      scrollParent.scrollTo({
        top: top - 16,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    } else {
      slotEl.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }

    // Espera a que el scroll termine antes de enfocar el input
    const delay = prefersReducedMotion() ? 0 : 300;
    window.setTimeout(() => {
      const inputEl = slotEl.querySelector<HTMLElement>('input[type="file"], button');
      inputEl?.focus({ preventScroll: true });
    }, delay);
  }

  async function handleVer(doc: DocumentoAdjunto) {
    previewReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveDocId(doc.id);
    try {
      const esImagenDoc = esImagen(inferirMimeDesdeNombre(doc.nombreArchivo));
      const cachedUrl = esImagenDoc ? thumbnailsById[doc.id] : undefined;

      const signedUrl =
        cachedUrl ??
        (await urlFirmadaMutation.mutateAsync({
          rutaStorage: doc.rutaStorage,
          segundos: SIGNED_URL_TTL_SECONDS,
        }));

      if (esImagenDoc) {
        const caption = doc.descripcion
          ? `${doc.tipoDocumentoNombre} · ${doc.descripcion}`
          : doc.tipoDocumentoNombre;
        setPreviewImage({ src: signedUrl, alt: doc.nombreArchivo, caption });
      } else {
        abrirEnNuevaPestana(signedUrl);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo abrir el documento en este momento.';
      toast(message, { tone: 'error' });
    } finally {
      setActiveDocId(null);
    }
  }

  async function handleDescargar(doc: DocumentoAdjunto) {
    setActiveDocId(doc.id);
    try {
      const signedUrl = await urlFirmadaMutation.mutateAsync({
        rutaStorage: doc.rutaStorage,
        segundos: SIGNED_URL_TTL_SECONDS,
        opciones: { download: doc.nombreArchivo },
      });
      descargarDesdeUrl(signedUrl, doc.nombreArchivo);
      toast('Descarga iniciada.', { tone: 'success' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo descargar el documento en este momento.';
      toast(message, { tone: 'error' });
    } finally {
      setActiveDocId(null);
    }
  }

  async function handleArchivar(doc: DocumentoAdjunto) {
    setArchivingDocId(doc.id);
    try {
      await archivarMutation.mutateAsync(doc.id);
      handleThumbnailError(doc);
      toast('Documento archivado del expediente.', { tone: 'success' });
    } catch (err) {
      toast(formatErrorEscrituraExpediente(err, 'No se pudo archivar el documento.', isArchivado), {
        tone: 'error',
      });
      throw err;
    } finally {
      setArchivingDocId(null);
    }
  }

  const docById = new Map((documentosQuery.data ?? []).map((d) => [d.id, d]));

  return (
    <section aria-label="Documentos adjuntos privados" className="grid gap-4">
      {isArchivado ? (
        <p className="rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2 text-xs font-medium text-on-surface-variant">
          Expediente archivado: solo consulta
        </p>
      ) : null}

      <DocumentoSummaryHeader
        documentos={documentosQuery.data ?? []}
        isLoading={documentosQuery.isLoading}
        onFocusSlot={handleFocusSlot}
      />

      <DocumentoList
        readOnly={isArchivado}
        documentos={documentosQuery.data ?? []}
        tipos={tiposQuery.data ?? []}
        tiposLoading={tiposQuery.isLoading}
        ordenes={ordenesQuery.data ?? []}
        ordenesLoading={ordenesQuery.isLoading}
        isLoading={documentosQuery.isLoading}
        isError={documentosQuery.isError}
        onRetry={() => {
          void documentosQuery.refetch();
        }}
        ordenesLabelById={ordenesLabelById}
        activeDocId={activeDocId}
        archivingDocId={archivingDocId}
        thumbnailsById={thumbnailsById}
        loadingThumbIds={loadingThumbIds}
        onUpload={async ({ tipoDocumentoId, ordenProteccionId, descripcion, file, onProgress }) => {
          try {
            await subirMutation.mutateAsync({
              input: {
                fichaId,
                tipoDocumentoId,
                ordenProteccionId,
                descripcion,
                file,
              },
              onProgress,
            });
          } catch (err) {
            const msg = formatErrorEscrituraExpediente(
              err,
              'No se pudo subir el documento.',
              isArchivado,
            );
            toast(msg, { tone: 'error' });
            throw new Error(msg);
          }
        }}
        onLoadThumbnail={handleRefreshThumbnail}
        onThumbnailError={(docId) => {
          const doc = docById.get(docId);
          if (doc) handleThumbnailError(doc);
        }}
        onVer={(doc) => {
          void handleVer(doc);
        }}
        onDescargar={(doc) => {
          void handleDescargar(doc);
        }}
        onArchivar={handleArchivar}
        previewImage={previewImage}
        onClosePreview={() => {
          setPreviewImage(null);
          previewReturnFocusRef.current?.focus();
        }}
      />
    </section>
  );
}
