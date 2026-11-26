import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, EmptyState, toast, type PreviewImage } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { DocumentoList } from './DocumentoList';
import { DocumentoUploadForm } from './DocumentoUploadForm';
import { ArchivarDocumentoDialog } from './documentos/ArchivarDocumentoDialog';
import { DocumentoSummaryHeader } from './documentos/DocumentoSummaryHeader';
import {
  SIGNED_URL_TTL_SECONDS,
  THUMBNAIL_FRESH_MS,
  prefersReducedMotion,
} from './documentos/documentoGrouping';
import {
  esImagen,
  inferirMimeDesdeNombre,
  puedeVerDocumentos,
  useArchivarDocumento,
  useDocumentos,
  useOrdenesProteccionDocumento,
  useTiposDocumento,
  useUrlFirmada,
  type DocumentoAdjunto,
} from './documentosApi';

export interface DocumentosAdjuntosPanelProps {
  fichaId: string;
}

interface ThumbnailCacheEntry {
  url: string;
  expiresAt: number;
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
 * Panel de documentos adjuntos privados de un expediente (`RF-35`, `RF-35.1`).
 * Montado en una pestaña del Drawer de expediente para roles con permiso `expediente.ver`.
 */
export function DocumentosAdjuntosPanel({ fichaId }: DocumentosAdjuntosPanelProps) {
  const { user } = useAuth();
  const autorizado = puedeVerDocumentos(user?.role);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DocumentoAdjunto | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [archivingDocId, setArchivingDocId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, ThumbnailCacheEntry>>({});
  const [loadingThumbIds, setLoadingThumbIds] = useState<Record<string, boolean>>({});

  const previewReturnFocusRef = useRef<HTMLElement | null>(null);
  const archiveMenuTimerRef = useRef<number | null>(null);
  const archiveCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (archiveMenuTimerRef.current !== null) window.clearTimeout(archiveMenuTimerRef.current);
      if (archiveCloseTimerRef.current !== null) window.clearTimeout(archiveCloseTimerRef.current);
    };
  }, []);

  const documentosQuery = useDocumentos(fichaId, autorizado);
  const tiposQuery = useTiposDocumento(autorizado);
  const ordenesQuery = useOrdenesProteccionDocumento(fichaId, autorizado);
  const urlFirmadaMutation = useUrlFirmada();
  const archivarMutation = useArchivarDocumento(fichaId);

  const ordenesLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const orden of ordenesQuery.data ?? []) {
      map.set(orden.id, orden.label);
    }
    return map;
  }, [ordenesQuery.data]);

  const thumbnailsById = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const [id, entry] of Object.entries(thumbnails)) {
      urls[id] = entry.url;
    }
    return urls;
  }, [thumbnails]);

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

  async function handleLoadThumbnail(doc: DocumentoAdjunto) {
    setLoadingThumbIds((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const signedUrl = await urlFirmadaMutation.mutateAsync({
        rutaStorage: doc.rutaStorage,
        segundos: SIGNED_URL_TTL_SECONDS,
      });
      setThumbnails((prev) => ({
        ...prev,
        [doc.id]: { url: signedUrl, expiresAt: Date.now() + THUMBNAIL_FRESH_MS },
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo cargar la miniatura del documento.';
      toast(message, { tone: 'error' });
    } finally {
      setLoadingThumbIds((prev) => ({ ...prev, [doc.id]: false }));
    }
  }

  function handleThumbnailError(docId: string) {
    setThumbnails((prev) => {
      if (!(docId in prev)) return prev;
      const next = { ...prev };
      delete next[docId];
      return next;
    });
  }

  async function handleVer(doc: DocumentoAdjunto) {
    previewReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveDocId(doc.id);
    try {
      const esImagenDoc = esImagen(inferirMimeDesdeNombre(doc.nombreArchivo));
      const cached = thumbnails[doc.id];
      const freshUrl =
        esImagenDoc && cached && cached.expiresAt > Date.now() ? cached.url : null;

      const signedUrl =
        freshUrl ??
        (await urlFirmadaMutation.mutateAsync({
          rutaStorage: doc.rutaStorage,
          segundos: SIGNED_URL_TTL_SECONDS,
        }));

      if (esImagenDoc) {
        if (!freshUrl) {
          setThumbnails((prev) => ({
            ...prev,
            [doc.id]: { url: signedUrl, expiresAt: Date.now() + THUMBNAIL_FRESH_MS },
          }));
        }
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

  function handleRequestArchivar(doc: DocumentoAdjunto) {
    if (archiveMenuTimerRef.current !== null) {
      window.clearTimeout(archiveMenuTimerRef.current);
    }
    const delay = prefersReducedMotion() ? 0 : 220;
    if (delay === 0) {
      setArchiveTarget(doc);
    } else {
      archiveMenuTimerRef.current = window.setTimeout(() => setArchiveTarget(doc), delay);
    }
  }

  async function handleConfirmArchive(doc: DocumentoAdjunto) {
    setArchivingDocId(doc.id);
    try {
      await archivarMutation.mutateAsync(doc.id);
      handleThumbnailError(doc.id);
      toast('Documento archivado del expediente.', { tone: 'success' });
      const delay = prefersReducedMotion() ? 0 : 550;
      if (delay > 0) {
        await new Promise<void>((resolve) => {
          archiveCloseTimerRef.current = window.setTimeout(resolve, delay);
        });
      }
      setArchiveTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo archivar el documento.';
      toast(message, { tone: 'error' });
      throw err;
    } finally {
      setArchivingDocId(null);
    }
  }

  return (
    <section aria-label="Documentos adjuntos privados" className="grid gap-4">
      <Dialog.Root open={uploadOpen} onOpenChange={setUploadOpen} closeOnBackdrop={false}>
        <DocumentoSummaryHeader
          documentos={documentosQuery.data ?? []}
          isLoading={documentosQuery.isLoading}
          uploadTrigger={
            <Dialog.Trigger className="mk-button mk-button--primary mk-button--sm">
              <Icon name="upload_file" />
              <span>Adjuntar documento</span>
            </Dialog.Trigger>
          }
        />

        <Dialog.Content size="lg">
          <Dialog.Header>
            <div>
              <Dialog.Title>Adjuntar documento</Dialog.Title>
              <Dialog.Description>
                JPG, PNG o PDF · Máximo 10 MB · Enlace privado de {SIGNED_URL_TTL_SECONDS} s
              </Dialog.Description>
            </div>
            <Dialog.Close label="Cerrar" />
          </Dialog.Header>

          {uploadOpen ? (
            <DocumentoUploadForm
              fichaId={fichaId}
              tipos={tiposQuery.data ?? []}
              tiposLoading={tiposQuery.isLoading}
              ordenes={ordenesQuery.data ?? []}
              ordenesLoading={ordenesQuery.isLoading}
              onCancel={() => setUploadOpen(false)}
              onSuccess={() => setUploadOpen(false)}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Root>

      <DocumentoList
        documentos={documentosQuery.data ?? []}
        isLoading={documentosQuery.isLoading}
        isError={documentosQuery.isError}
        onRetry={() => {
          void documentosQuery.refetch();
        }}
        onRequestUpload={() => setUploadOpen(true)}
        ordenesLabelById={ordenesLabelById}
        activeDocId={activeDocId}
        archivingDocId={archivingDocId}
        thumbnailsById={thumbnailsById}
        loadingThumbIds={loadingThumbIds}
        onLoadThumbnail={(doc) => {
          void handleLoadThumbnail(doc);
        }}
        onThumbnailError={handleThumbnailError}
        onVer={(doc) => {
          void handleVer(doc);
        }}
        onDescargar={(doc) => {
          void handleDescargar(doc);
        }}
        onRequestArchivar={handleRequestArchivar}
        previewImage={previewImage}
        onClosePreview={() => {
          setPreviewImage(null);
          previewReturnFocusRef.current?.focus();
        }}
      />

      <ArchivarDocumentoDialog
        documento={archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirmArchive={handleConfirmArchive}
      />
    </section>
  );
}
