import { FuseButton, Tooltip, type FuseButtonProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fuse-button';
import '@yewdiel21/motion-kit/css/components/tooltip';
import { Icon } from '@/shared/ui/Icon';
import {
  esImagen,
  inferirMimeDesdeNombre,
  type DocumentoAdjunto,
} from '../documentosApi';
import { formatFechaDocumento } from './documentoGrouping';
import { DocumentoThumbnail } from './DocumentoThumbnail';

interface DocumentoCardProps {
  doc: DocumentoAdjunto;
  showSubtipoBadge?: boolean;
  ordenLabel: string | null;
  thumbnailUrl: string | null;
  loadingThumbnail: boolean;
  busy: boolean;
  onLoadThumbnail: () => void;
  onThumbnailError: () => void;
  onVer: () => void;
  onDescargar: () => void;
  onArchivar: () => Promise<void>;
}

const ARCHIVE_FUSE_LABELS: NonNullable<FuseButtonProps['labels']> = {
  primary: 'Archivar',
  secondary: 'Cancelar',
  confirm: 'Sí, archivar',
  loading: 'Archivando…',
  success: 'Archivado',
  error: 'Error',
  prompt: '¿Archivar este documento del expediente? Cancelar o Sí, archivar.',
};

export function DocumentoCard({
  doc,
  showSubtipoBadge = false,
  ordenLabel,
  thumbnailUrl,
  loadingThumbnail,
  busy,
  onLoadThumbnail,
  onThumbnailError,
  onVer,
  onDescargar,
  onArchivar,
}: DocumentoCardProps) {
  const esImagenDoc = esImagen(inferirMimeDesdeNombre(doc.nombreArchivo));

  return (
    <li
      data-flip-id={doc.id}
      className="grid gap-2.5 rounded-xl border border-outline-variant/80 bg-surface-container-lowest p-2.5 transition-colors hover:border-outline motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3">
        <DocumentoThumbnail
          doc={doc}
          esImagenDoc={esImagenDoc}
          thumbnailUrl={thumbnailUrl}
          loadingThumbnail={loadingThumbnail}
          busy={busy}
          onLoadThumbnail={onLoadThumbnail}
          onThumbnailError={onThumbnailError}
          onVer={onVer}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-on-surface" title={doc.nombreArchivo}>
            {doc.nombreArchivo}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {formatFechaDocumento(doc.creadoEn)}
          </p>

          {(showSubtipoBadge || ordenLabel) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {showSubtipoBadge ? (
                <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container">
                  {doc.tipoDocumentoNombre}
                </span>
              ) : null}
              {ordenLabel ? (
                <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-medium text-status-info">
                  {ordenLabel}
                </span>
              ) : null}
            </div>
          ) : null}

          {doc.descripcion ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-on-surface-variant">
              {doc.descripcion}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            className="mk-button mk-button--tonal mk-button--sm"
            onClick={onVer}
          >
            <Icon name={esImagenDoc ? 'visibility' : 'open_in_new'} />
            <span>{esImagenDoc ? 'Ver' : 'Abrir PDF'}</span>
          </button>

          <Tooltip content="Descargar archivo con enlace temporal">
            <button
              type="button"
              disabled={busy}
              aria-label={`Descargar ${doc.nombreArchivo}`}
              className="mk-button mk-button--outlined mk-button--sm"
              onClick={onDescargar}
            >
              <Icon name="download" />
              <span>Descargar</span>
            </button>
          </Tooltip>
        </div>

        <FuseButton
          key={doc.id}
          mode="split"
          tone="danger"
          align="end"
          height={34}
          disabled={busy}
          labels={ARCHIVE_FUSE_LABELS}
          onConfirm={async () => {
            await onArchivar();
          }}
        />
      </div>
    </li>
  );
}
