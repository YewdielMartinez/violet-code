import type { ReactNode } from 'react';
import { Tooltip } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/tooltip';
import { Icon } from '@/shared/ui/Icon';
import type { DocumentoAdjunto } from '../documentosApi';
import { SIGNED_URL_TTL_SECONDS, summarizeDocumentos } from './documentoGrouping';

interface DocumentoSummaryHeaderProps {
  documentos: DocumentoAdjunto[];
  isLoading: boolean;
  uploadTrigger: ReactNode;
}

export function DocumentoSummaryHeader({
  documentos,
  isLoading,
  uploadTrigger,
}: DocumentoSummaryHeaderProps) {
  const { total, hasIne, hasFoto, hasDenuncia } = summarizeDocumentos(documentos);
  const countLabel = `${total} ${total === 1 ? 'documento' : 'documentos'}`;

  const keyChecks = [
    { key: 'ine', label: 'INE', present: hasIne },
    { key: 'foto', label: 'Foto', present: hasFoto },
    { key: 'denuncia', label: 'Denuncia', present: hasDenuncia },
  ];

  return (
    <div className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-on-surface">
            {isLoading ? 'Documentos del expediente' : countLabel}
          </span>
          <Tooltip
            content={`Bucket privado: enlaces temporales de ${SIGNED_URL_TTL_SECONDS} segundos por archivo.`}
          >
            <button
              type="button"
              aria-label="Seguridad de almacenamiento privado"
              className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant"
            >
              <Icon name="lock" className="text-[14px] text-primary" />
              <span className="font-mono">{SIGNED_URL_TTL_SECONDS} s</span>
            </button>
          </Tooltip>
        </div>

        {uploadTrigger}
      </div>

      {!isLoading ? (
        <div
          aria-label="Resumen de documentos clave"
          className="flex flex-wrap items-center gap-1.5 text-xs"
        >
          {keyChecks.map((item) => (
            <span
              key={item.key}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
                item.present
                  ? 'bg-status-success-bg text-status-success'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              <span>{item.label}</span>
              <span aria-hidden>{item.present ? '✓' : '—'}</span>
              <span className="sr-only">{item.present ? 'adjunto' : 'pendiente'}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
