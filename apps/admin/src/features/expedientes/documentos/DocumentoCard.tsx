import { Menu, Tooltip } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/menu';
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
  ordenLabel: string | null;
  thumbnailUrl: string | null;
  loadingThumbnail: boolean;
  busy: boolean;
  onLoadThumbnail: () => void;
  onThumbnailError: () => void;
  onVer: () => void;
  onDescargar: () => void;
  onRequestArchivar: () => void;
}

export function DocumentoCard({
  doc,
  ordenLabel,
  thumbnailUrl,
  loadingThumbnail,
  busy,
  onLoadThumbnail,
  onThumbnailError,
  onVer,
  onDescargar,
  onRequestArchivar,
}: DocumentoCardProps) {
  const esImagenDoc = esImagen(inferirMimeDesdeNombre(doc.nombreArchivo));

  function handleMenuSelect(value: string) {
    if (value === 'ver') onVer();
    else if (value === 'descargar') onDescargar();
    else if (value === 'archivar') onRequestArchivar();
  }

  return (
    <li
      data-flip-id={doc.id}
      data-mk-cascade="fade"
      className="group flex flex-col justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:border-outline motion-reduce:transition-none"
    >
      <div className="grid gap-2.5">
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

        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-on-surface"
            title={doc.nombreArchivo}
          >
            {doc.nombreArchivo}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {formatFechaDocumento(doc.creadoEn)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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
          <p className="line-clamp-2 text-xs text-on-surface-variant">{doc.descripcion}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            className="mk-button mk-button--tonal mk-button--sm"
            onClick={onVer}
          >
            <Icon name={esImagenDoc ? 'visibility' : 'open_in_new'} />
            <span>Ver</span>
          </button>

          <Tooltip content="Descargar archivo">
            <button
              type="button"
              disabled={busy}
              aria-label={`Descargar ${doc.nombreArchivo}`}
              className="mk-button mk-button--outlined mk-button--icon h-8 w-8"
              onClick={onDescargar}
            >
              <Icon name="download" className="text-[18px]" />
            </button>
          </Tooltip>
        </div>

        <Menu.Root onSelect={handleMenuSelect}>
          <Menu.Trigger
            disabled={busy}
            aria-label={`Más opciones para ${doc.nombreArchivo}`}
            className="mk-button mk-button--text mk-button--icon h-8 w-8"
          >
            <Icon name="more_vert" className="text-[18px]" />
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item value="ver">
              <Icon name={esImagenDoc ? 'visibility' : 'open_in_new'} />
              <span>{esImagenDoc ? 'Vista previa' : 'Abrir en pestaña'}</span>
            </Menu.Item>
            <Menu.Item value="descargar">
              <Icon name="download" />
              <span>Descargar</span>
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="archivar" className="text-status-danger">
              <Icon name="archive" className="text-status-danger" />
              <span>Archivar documento</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </div>
    </li>
  );
}
