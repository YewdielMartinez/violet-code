import { useMemo, useState } from 'react';
import { EmptyState, toast, type PreviewImage } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { DocumentoList } from './DocumentoList';
import { DocumentoUploadForm } from './DocumentoUploadForm';
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

const SIGNED_URL_TTL_SECONDS = 60;

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

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [archivingDocId, setArchivingDocId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

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

  async function handleVer(doc: DocumentoAdjunto) {
    setActiveDocId(doc.id);
    try {
      const signedUrl = await urlFirmadaMutation.mutateAsync({
        rutaStorage: doc.rutaStorage,
        segundos: SIGNED_URL_TTL_SECONDS,
      });

      const mime = inferirMimeDesdeNombre(doc.nombreArchivo);
      if (esImagen(mime)) {
        const caption = doc.descripcion
          ? `${doc.tipoDocumentoNombre} · ${doc.descripcion}`
          : doc.tipoDocumentoNombre;
        setPreviewImage({
          src: signedUrl,
          alt: doc.nombreArchivo,
          caption,
        });
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
      toast('Documento archivado del expediente.', { tone: 'success' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo archivar el documento.';
      toast(message, { tone: 'error' });
    } finally {
      setArchivingDocId(null);
    }
  }

  return (
    <section aria-label="Documentos adjuntos privados" className="grid gap-5">
      <div className="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="lock" className="text-primary" />
        <span>
          Bucket privado con acceso temporal de {SIGNED_URL_TTL_SECONDS} segundos por archivo.
        </span>
      </div>

      <DocumentoUploadForm
        fichaId={fichaId}
        tipos={tiposQuery.data ?? []}
        tiposLoading={tiposQuery.isLoading}
        ordenes={ordenesQuery.data ?? []}
        ordenesLoading={ordenesQuery.isLoading}
      />

      <DocumentoList
        documentos={documentosQuery.data ?? []}
        isLoading={documentosQuery.isLoading}
        isError={documentosQuery.isError}
        onRetry={() => {
          void documentosQuery.refetch();
        }}
        ordenesLabelById={ordenesLabelById}
        activeDocId={activeDocId}
        archivingDocId={archivingDocId}
        onVer={(doc) => {
          void handleVer(doc);
        }}
        onDescargar={(doc) => {
          void handleDescargar(doc);
        }}
        onArchivar={(doc) => {
          void handleArchivar(doc);
        }}
        previewImage={previewImage}
        onClosePreview={() => setPreviewImage(null)}
      />
    </section>
  );
}
