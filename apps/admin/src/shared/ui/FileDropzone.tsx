import { Attachment, type AttachmentProps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/attachment';
import './file-dropzone.css';

/** Una sola línea de ayuda bajo la zona de carga (el texto del prompt ya no repite formatos ni peso). */
export const FILE_DROPZONE_HINT = 'JPG, PNG o PDF · Máximo 10 MB';

const DEFAULT_LABELS: NonNullable<AttachmentProps['labels']> = {
  drop: 'o arrástralo aquí',
};

export interface FileDropzoneProps extends AttachmentProps {
  /** Disposición horizontal y compacta (ranuras del checklist documental). */
  compact?: boolean;
}

/**
 * Zona de carga de archivos de la app. Envuelve `Attachment` de motion-kit y carga
 * `file-dropzone.css`, que enlaza sus colores a los roles `--md-sys-color-*` del tema activo
 * (Salmverse, blue, black, oled… en claro y oscuro). Úsala en vez de `Attachment` directo.
 */
export function FileDropzone({
  compact = false,
  className,
  hint = FILE_DROPZONE_HINT,
  labels,
  ...props
}: FileDropzoneProps) {
  const classes = ['vc-dropzone', compact ? 'vc-dropzone--compact' : '', className]
    .filter(Boolean)
    .join(' ');
  return <Attachment {...props} hint={hint} labels={{ ...DEFAULT_LABELS, ...labels }} className={classes} />;
}
