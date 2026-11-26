import { useEffect, useMemo, useRef } from 'react';
import {
  EmptyState,
  FlipGroup,
  ImagePreview,
  Skeleton,
  useCascade,
  type ImagePreviewProps,
  type PreviewImage,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import '@yewdiel21/motion-kit/css/components/image-preview';
import { Icon } from '@/shared/ui/Icon';
import type { DocumentoAdjunto } from './documentosApi';
import { DocumentoCard } from './documentos/DocumentoCard';
import { groupDocumentosByTipo } from './documentos/documentoGrouping';

interface DocumentoListProps {
  documentos: DocumentoAdjunto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRequestUpload: () => void;
  ordenesLabelById: Map<string, string>;
  activeDocId: string | null;
  archivingDocId: string | null;
  thumbnailsById: Record<string, string>;
  loadingThumbIds: Record<string, boolean>;
  onLoadThumbnail: (doc: DocumentoAdjunto) => void;
  onThumbnailError: (docId: string) => void;
  onVer: (doc: DocumentoAdjunto) => void;
  onDescargar: (doc: DocumentoAdjunto) => void;
  onRequestArchivar: (doc: DocumentoAdjunto) => void;
  previewImage: PreviewImage | null;
  onClosePreview: () => void;
}

const RETRY_ACTIONS = [{ id: 'retry', label: 'Reintentar' }];
const EMPTY_UPLOAD_ACTIONS = [{ id: 'upload', label: 'Adjuntar documento' }];
const CASCADE_OPTIONS = { trigger: 'load', duration: 0.42, step: 0.05, once: true } as const;

const IMAGE_PREVIEW_LABELS: NonNullable<ImagePreviewProps['labels']> = {
  close: 'Cerrar vista previa',
  prev: 'Imagen anterior',
  next: 'Imagen siguiente',
  dialog: 'Vista previa del documento',
  strip: 'Miniaturas',
  picture: 'Documento adjunto',
};

export function DocumentoList({
  documentos,
  isLoading,
  isError,
  onRetry,
  onRequestUpload,
  ordenesLabelById,
  activeDocId,
  archivingDocId,
  thumbnailsById,
  loadingThumbIds,
  onLoadThumbnail,
  onThumbnailError,
  onVer,
  onDescargar,
  onRequestArchivar,
  previewImage,
  onClosePreview,
}: DocumentoListProps) {
  const previewRef: NonNullable<ImagePreviewProps['instanceRef']> = useRef(null);
  const listRef = useRef<HTMLDivElement>(null);

  const grupos = useMemo(() => groupDocumentosByTipo(documentos), [documentos]);
  const hasDocs = documentos.length > 0;
  useCascade(listRef, CASCADE_OPTIONS, [hasDocs]);

  const flipSignature = useMemo(
    () =>
      documentos
        .map((doc) => `${doc.id}:${doc.ordenProteccionId ?? ''}:${doc.descripcion ?? ''}`)
        .join('|'),
    [documentos],
  );

  useEffect(() => {
    if (previewImage) {
      previewRef.current?.open(0);
    }
  }, [previewImage]);

  if (isError) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
        <EmptyState
          illustration="error"
          title="No se pudieron cargar los documentos"
          description="Verifica tu conexión o permisos e intenta nuevamente."
          actions={RETRY_ACTIONS}
          onAction={onRetry}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <Skeleton loading={isLoading} shape="card" lines={4} label="Cargando documentos adjuntos">
        {documentos.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
            <EmptyState
              illustration="folder"
              title="Sin documentos adjuntos"
              description="Adjunta identificaciones, fotografías, denuncias u oficios para integrar el expediente."
              actions={EMPTY_UPLOAD_ACTIONS}
              onAction={onRequestUpload}
            />
          </div>
        ) : (
          <FlipGroup root={listRef} signature={flipSignature}>
            <div ref={listRef} className="grid gap-5">
              {grupos.map((group) => (
                <section key={group.key} aria-label={group.title} className="grid gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      <Icon name={group.icon} className="text-[16px] text-primary" />
                      <span>{group.title}</span>
                    </h3>
                    <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[11px] text-on-surface-variant">
                      {group.items.length}
                    </span>
                  </div>

                  <ul
                    className="grid gap-3 sm:grid-cols-2"
                    aria-label={`Documentos de ${group.title}`}
                  >
                    {group.items.map((doc) => (
                      <DocumentoCard
                        key={doc.id}
                        doc={doc}
                        ordenLabel={
                          doc.ordenProteccionId
                            ? (ordenesLabelById.get(doc.ordenProteccionId) ?? null)
                            : null
                        }
                        thumbnailUrl={thumbnailsById[doc.id] ?? null}
                        loadingThumbnail={Boolean(loadingThumbIds[doc.id])}
                        busy={activeDocId === doc.id || archivingDocId === doc.id}
                        onLoadThumbnail={() => onLoadThumbnail(doc)}
                        onThumbnailError={() => onThumbnailError(doc.id)}
                        onVer={() => onVer(doc)}
                        onDescargar={() => onDescargar(doc)}
                        onRequestArchivar={() => onRequestArchivar(doc)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </FlipGroup>
        )}
      </Skeleton>

      {previewImage ? (
        <div className="h-0 overflow-hidden [&_[data-mk-image]]:hidden" aria-hidden="true">
          <ImagePreview
            key={previewImage.src}
            images={[previewImage]}
            labels={IMAGE_PREVIEW_LABELS}
            strip={false}
            loop={false}
            instanceRef={previewRef}
            onOpenChange={(open) => {
              if (!open) onClosePreview();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
