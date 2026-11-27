import { useMemo, useRef } from 'react';
import { Attachment, FlipGroup, type AttachmentProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/attachment';
import { Icon } from '@/shared/ui/Icon';
import { AnimatedReveal } from '../agresor/AnimatedReveal';
import {
  TAMANO_MAXIMO_BYTES,
  type DocumentoAdjunto,
  type OrdenProteccionOpcion,
  type TipoDocumento,
} from '../documentosApi';
import type { ChecklistSlotMeta } from './documentoGrouping';
import { DocumentoCard } from './DocumentoCard';
import { DocumentoSlotDetails } from './DocumentoSlotDetails';
import { useSlotUpload, type SlotUploadRequest } from './useSlotUpload';
import './documentos.css';

interface DocumentoSlotCardProps {
  readOnly?: boolean;
  slot: ChecklistSlotMeta;
  docs: DocumentoAdjunto[];
  tipos: TipoDocumento[];
  tiposLoading: boolean;
  ordenes: OrdenProteccionOpcion[];
  ordenesLoading: boolean;
  ordenesLabelById: Map<string, string>;
  activeDocId: string | null;
  archivingDocId: string | null;
  thumbnailsById: Record<string, string>;
  loadingThumbIds: Record<string, boolean>;
  onUpload: (req: SlotUploadRequest) => Promise<void>;
  onLoadThumbnail: (doc: DocumentoAdjunto) => void;
  onThumbnailError: (docId: string) => void;
  onVer: (doc: DocumentoAdjunto) => void;
  onDescargar: (doc: DocumentoAdjunto) => void;
  onArchivar: (doc: DocumentoAdjunto) => Promise<void>;
}

const ACCEPT_ARCHIVOS = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';

export function DocumentoSlotCard({
  readOnly = false,
  slot,
  docs,
  tipos,
  tiposLoading,
  ordenes,
  ordenesLoading,
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
}: DocumentoSlotCardProps) {
  const filesListRef = useRef<HTMLUListElement>(null);
  const requiresInlineDetails =
    slot.key === 'otro' || (slot.key === 'orden_proteccion' && ordenes.length > 0);
  const hasDocs = docs.length > 0;

  const upload = useSlotUpload({
    slot,
    tipos,
    tiposLoading,
    requiresInlineDetails,
    onUpload,
  });

  const attachmentLabels = useMemo<NonNullable<AttachmentProps['labels']>>(
    () => ({
      choose: `Adjuntar ${slot.title}`,
      drop: 'o arrastra JPG, PNG o PDF (máx. 10 MB)',
      remove: 'Quitar archivo',
      list: `Archivo seleccionado para ${slot.title}`,
      uploading: 'Subiendo…',
      complete: 'Adjuntado',
      error: 'Error al subir',
    }),
    [slot.title],
  );

  const flipSignature = useMemo(
    () => docs.map((d) => `${d.id}:${d.ordenProteccionId ?? ''}:${d.descripcion ?? ''}`).join('|'),
    [docs],
  );

  return (
    <article
      id={`doc-slot-${slot.key}`}
      aria-label={`Ranura de documento: ${slot.title}`}
      className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              hasDocs ? 'bg-status-success-bg text-status-success' : 'bg-surface-container text-primary'
            }`}
          >
            <Icon name={slot.icon} className="text-[20px]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-on-surface">{slot.title}</h3>
            <p className="text-xs text-on-surface-variant">{slot.hint}</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            hasDocs ? 'bg-status-success-bg text-status-success' : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          <Icon name={hasDocs ? 'check_circle' : 'schedule'} className="text-[14px]" />
          <span>{hasDocs ? `Adjuntado${docs.length > 1 ? ` (${docs.length})` : ''}` : 'Pendiente'}</span>
        </span>
      </div>

      {!readOnly ? (
        <div className="grid gap-1.5">
          <Attachment
            className="vc-doc-slot-attachment"
            accept={ACCEPT_ARCHIVOS}
            multiple={false}
            maxFiles={1}
            maxSize={TAMANO_MAXIMO_BYTES}
            hint=""
            labels={attachmentLabels}
            uploads={upload.uploads}
            instanceRef={upload.attachmentRef}
            onFiles={upload.handleFiles}
            onRemove={() => {
              if (!upload.isUploading) upload.resetStaged();
            }}
            onReject={upload.handleReject}
          />

          {upload.slotError && !requiresInlineDetails ? (
            <p role="alert" className="text-xs font-medium text-status-danger">
              {upload.slotError}
            </p>
          ) : null}

          {requiresInlineDetails ? (
            <AnimatedReveal show={Boolean(upload.staged)}>
              <DocumentoSlotDetails
                slotKey={slot.key}
                subtiposOtro={upload.subtiposOtro}
                selectedTipoId={upload.effectiveSubtipoId}
                onSelectTipoId={upload.setSelectedSubtipoId}
                ordenes={ordenes}
                ordenesLoading={ordenesLoading}
                ordenProteccionId={upload.ordenProteccionId}
                onSelectOrdenId={upload.setOrdenProteccionId}
                descripcion={upload.descripcion}
                onChangeDescripcion={upload.setDescripcion}
                esDescripcionObligatoria={upload.esDescripcionObligatoria}
                uploading={upload.isUploading}
                submitState={upload.submitState}
                onSubmitStateChange={upload.setSubmitState}
                error={upload.slotError}
                onCancel={upload.resetStaged}
                onSubmit={upload.handleDetailsSubmit}
              />
            </AnimatedReveal>
          ) : null}
        </div>
      ) : null}

      {hasDocs ? (
        <FlipGroup root={filesListRef} signature={flipSignature}>
          <ul ref={filesListRef} aria-label={`Archivos adjuntos en ${slot.title}`} className="grid gap-2">
            {docs.map((doc) => (
              <DocumentoCard
                key={doc.id}
                doc={doc}
                readOnly={readOnly}
                showSubtipoBadge={slot.key === 'otro' && doc.tipoDocumentoClave !== 'otro'}
                ordenLabel={doc.ordenProteccionId ? (ordenesLabelById.get(doc.ordenProteccionId) ?? null) : null}
                thumbnailUrl={thumbnailsById[doc.id] ?? null}
                loadingThumbnail={Boolean(loadingThumbIds[doc.id])}
                busy={activeDocId === doc.id || archivingDocId === doc.id}
                onLoadThumbnail={() => onLoadThumbnail(doc)}
                onThumbnailError={() => onThumbnailError(doc.id)}
                onVer={() => onVer(doc)}
                onDescargar={() => onDescargar(doc)}
                onArchivar={() => onArchivar(doc)}
              />
            ))}
          </ul>
        </FlipGroup>
      ) : null}
    </article>
  );
}
