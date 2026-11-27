import { useEffect, useMemo, useRef } from 'react';
import {
  EmptyState,
  FadeContent,
  ImagePreview,
  Skeleton,
  type ImagePreviewProps,
  type PreviewImage,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/fade-content';
import '@yewdiel21/motion-kit/css/components/image-preview';
import '@yewdiel21/motion-kit/css/components/skeleton';
import type {
  DocumentoAdjunto,
  OrdenProteccionOpcion,
  TipoDocumento,
} from './documentosApi';
import {
  DOCUMENTO_CHECKLIST_SLOTS,
  partitionDocumentosPorSlot,
} from './documentos/documentoGrouping';
import { DocumentoSlotCard } from './documentos/DocumentoSlotCard';

interface UploadRequest {
  tipoDocumentoId: number;
  ordenProteccionId: string | null;
  descripcion: string | null;
  file: File;
  onProgress: (porcentaje: number) => void;
}

interface DocumentoListProps {
  readOnly?: boolean;
  documentos: DocumentoAdjunto[];
  tipos: TipoDocumento[];
  tiposLoading: boolean;
  ordenes: OrdenProteccionOpcion[];
  ordenesLoading: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  ordenesLabelById: Map<string, string>;
  activeDocId: string | null;
  archivingDocId: string | null;
  thumbnailsById: Record<string, string>;
  loadingThumbIds: Record<string, boolean>;
  onUpload: (req: UploadRequest) => Promise<void>;
  onLoadThumbnail: (doc: DocumentoAdjunto) => void;
  onThumbnailError: (docId: string) => void;
  onVer: (doc: DocumentoAdjunto) => void;
  onDescargar: (doc: DocumentoAdjunto) => void;
  onArchivar: (doc: DocumentoAdjunto) => Promise<void>;
  previewImage: PreviewImage | null;
  onClosePreview: () => void;
}

const RETRY_ACTIONS = [{ id: 'retry', label: 'Reintentar' }];

const IMAGE_PREVIEW_LABELS: NonNullable<ImagePreviewProps['labels']> = {
  close: 'Cerrar vista previa',
  prev: 'Imagen anterior',
  next: 'Imagen siguiente',
  dialog: 'Vista previa del documento',
  strip: 'Miniaturas',
  picture: 'Documento adjunto',
};

export function DocumentoList({
  readOnly = false,
  documentos,
  tipos,
  tiposLoading,
  ordenes,
  ordenesLoading,
  isLoading,
  isError,
  onRetry,
  ordenesLabelById,
  activeDocId,
  archivingDocId,
  thumbnailsById,
  loadingThumbIds,
  onUpload,
  onLoadThumbnail,
  onThumbnailError,
  onVer,
  onDescargar,
  onArchivar,
  previewImage,
  onClosePreview,
}: DocumentoListProps) {
  const previewRef: NonNullable<ImagePreviewProps['instanceRef']> = useRef(null);

  const docsPorSlot = useMemo(() => partitionDocumentosPorSlot(documentos), [documentos]);

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
      <Skeleton loading={isLoading} shape="card" lines={5} label="Cargando documentos adjuntos">
        <FadeContent blur={6} rise={10} stagger={45} eachChild trigger="load" once>
          <div className="grid gap-3">
            {DOCUMENTO_CHECKLIST_SLOTS.map((slot) => (
              <DocumentoSlotCard
                key={slot.key}
                readOnly={readOnly}
                slot={slot}
                docs={docsPorSlot[slot.key]}
                tipos={tipos}
                tiposLoading={tiposLoading}
                ordenes={ordenes}
                ordenesLoading={ordenesLoading}
                ordenesLabelById={ordenesLabelById}
                activeDocId={activeDocId}
                archivingDocId={archivingDocId}
                thumbnailsById={thumbnailsById}
                loadingThumbIds={loadingThumbIds}
                onUpload={onUpload}
                onLoadThumbnail={onLoadThumbnail}
                onThumbnailError={onThumbnailError}
                onVer={onVer}
                onDescargar={onDescargar}
                onArchivar={onArchivar}
              />
            ))}
          </div>
        </FadeContent>
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
