import { Icon } from '@/shared/ui/Icon';
import type { DocumentoAdjunto } from '../documentosApi';

interface DocumentoThumbnailProps {
  doc: DocumentoAdjunto;
  esImagenDoc: boolean;
  thumbnailUrl: string | null;
  loadingThumbnail: boolean;
  busy: boolean;
  onLoadThumbnail: () => void;
  onThumbnailError: () => void;
  onVer: () => void;
}

export function DocumentoThumbnail({
  doc,
  esImagenDoc,
  thumbnailUrl,
  loadingThumbnail,
  busy,
  onLoadThumbnail,
  onThumbnailError,
  onVer,
}: DocumentoThumbnailProps) {
  if (!esImagenDoc) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onVer}
        className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high motion-reduce:transition-none"
      >
        <Icon name="picture_as_pdf" className="text-[32px] text-primary" />
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-medium text-on-surface">
          PDF · Abrir
        </span>
      </button>
    );
  }

  if (thumbnailUrl) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onVer}
        aria-label={`Ampliar vista previa de ${doc.nombreArchivo}`}
        className="relative h-28 w-full overflow-hidden rounded-xl bg-surface-container"
      >
        <img
          src={thumbnailUrl}
          alt={doc.nombreArchivo}
          loading="lazy"
          onError={onThumbnailError}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-on-surface backdrop-blur-xs">
          <Icon name="zoom_in" className="text-[14px]" />
          <span>Ver</span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl bg-surface-container px-3 text-center">
      <Icon name="image" className="text-[28px] text-primary" />
      <button
        type="button"
        disabled={busy || loadingThumbnail}
        onClick={onLoadThumbnail}
        className="mk-button mk-button--tonal mk-button--sm"
      >
        <span>{loadingThumbnail ? 'Cargando…' : 'Cargar miniatura'}</span>
      </button>
    </div>
  );
}
