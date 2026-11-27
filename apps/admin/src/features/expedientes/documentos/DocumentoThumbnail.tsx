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
        aria-label={`Abrir PDF ${doc.nombreArchivo} en nueva pestaña`}
        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="picture_as_pdf" className="text-[24px] text-primary" />
        <span className="font-mono text-[10px] font-semibold text-on-surface">PDF</span>
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
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <img
          src={thumbnailUrl}
          alt={doc.nombreArchivo}
          loading="lazy"
          onError={onThumbnailError}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </button>
    );
  }

  if (loadingThumbnail) {
    return (
      <div
        role="status"
        aria-label={`Cargando miniatura de ${doc.nombreArchivo}`}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-container animate-pulse motion-reduce:animate-none"
      >
        <Icon name="image" className="text-[22px] text-on-surface-variant" />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onLoadThumbnail}
      aria-label={`Cargar miniatura de ${doc.nombreArchivo}`}
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="image" className="text-[20px] text-primary" />
      <span className="text-[10px] font-medium">Cargar</span>
    </button>
  );
}
