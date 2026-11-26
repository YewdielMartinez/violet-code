import { useEffect, useRef, useState } from 'react';
import {
  EmptyState,
  ImagePreview,
  Skeleton,
  type ImagePreviewProps,
  type PreviewImage,
} from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/skeleton';
import '@yewdiel21/motion-kit/css/components/image-preview';
import { Icon } from '@/shared/ui/Icon';
import {
  esImagen,
  inferirMimeDesdeNombre,
  type DocumentoAdjunto,
} from './documentosApi';

interface DocumentoListProps {
  documentos: DocumentoAdjunto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  ordenesLabelById: Map<string, string>;
  activeDocId: string | null;
  archivingDocId: string | null;
  onVer: (doc: DocumentoAdjunto) => void;
  onDescargar: (doc: DocumentoAdjunto) => void;
  onArchivar: (doc: DocumentoAdjunto) => void;
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

const DATE_TIME_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Mazatlan',
});

function formatFechaDocumento(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME_FMT.format(date);
}

export function DocumentoList({
  documentos,
  isLoading,
  isError,
  onRetry,
  ordenesLabelById,
  activeDocId,
  archivingDocId,
  onVer,
  onDescargar,
  onArchivar,
  previewImage,
  onClosePreview,
}: DocumentoListProps) {
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const previewRef: NonNullable<ImagePreviewProps['instanceRef']> = useRef(null);

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
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-on-surface">Documentos del expediente</h3>
        {!isLoading ? (
          <span className="font-mono text-xs text-on-surface-variant">
            {documentos.length} {documentos.length === 1 ? 'archivo' : 'archivos'}
          </span>
        ) : null}
      </div>

      <Skeleton loading={isLoading} shape="card" lines={4} label="Cargando documentos adjuntos">
        {documentos.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
            <EmptyState
              illustration="folder"
              title="Sin documentos adjuntos"
              description="Sube identificaciones, fotografías, denuncias u oficios en el formulario superior."
            />
          </div>
        ) : (
          <ul className="grid gap-2.5" aria-label="Listado de documentos adjuntos">
            {documentos.map((doc) => {
              const imagen = esImagen(inferirMimeDesdeNombre(doc.nombreArchivo));
              const busy = activeDocId === doc.id || archivingDocId === doc.id;
              const ordenLabel = doc.ordenProteccionId
                ? ordenesLabelById.get(doc.ordenProteccionId)
                : null;
              const confirmando = confirmArchiveId === doc.id;

              return (
                <li
                  key={doc.id}
                  className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        imagen
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      <Icon name={imagen ? 'image' : 'picture_as_pdf'} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium text-on-surface"
                        title={doc.nombreArchivo}
                      >
                        {doc.nombreArchivo}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                          {doc.tipoDocumentoNombre}
                        </span>
                        {ordenLabel ? (
                          <span className="rounded-full bg-status-info-bg px-2.5 py-0.5 text-xs font-medium text-status-info">
                            {ordenLabel}
                          </span>
                        ) : null}
                      </div>

                      {doc.descripcion ? (
                        <p className="mt-1.5 text-xs text-on-surface-variant">{doc.descripcion}</p>
                      ) : null}

                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        Adjuntado el {formatFechaDocumento(doc.creadoEn)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/60 pt-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      className="mk-button mk-button--tonal mk-button--sm"
                      onClick={() => onVer(doc)}
                    >
                      <Icon name={imagen ? 'visibility' : 'open_in_new'} />
                      <span className="ml-1.5">Ver</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      className="mk-button mk-button--outlined mk-button--sm"
                      onClick={() => onDescargar(doc)}
                    >
                      <Icon name="download" />
                      <span className="ml-1.5">Descargar</span>
                    </button>

                    {confirmando ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          className="mk-button mk-button--sm bg-error-container text-on-error-container"
                          onClick={() => {
                            setConfirmArchiveId(null);
                            onArchivar(doc);
                          }}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="mk-button mk-button--text mk-button--sm"
                          onClick={() => setConfirmArchiveId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="mk-button mk-button--text mk-button--sm text-status-danger"
                        onClick={() => setConfirmArchiveId(doc.id)}
                      >
                        <Icon name="archive" />
                        <span className="ml-1">Archivar</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Skeleton>

      {previewImage ? (
        <div className="sr-only" aria-hidden="true">
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
