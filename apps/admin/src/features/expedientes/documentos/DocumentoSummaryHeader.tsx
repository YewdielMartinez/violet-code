import { Progress, Tooltip } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/progress';
import '@yewdiel21/motion-kit/css/components/tooltip';
import { Icon } from '@/shared/ui/Icon';
import type { DocumentoAdjunto } from '../documentosApi';
import {
  SIGNED_URL_TTL_SECONDS,
  summarizeChecklist,
  type ChecklistSlotKey,
} from './documentoGrouping';

interface DocumentoSummaryHeaderProps {
  documentos: DocumentoAdjunto[];
  isLoading: boolean;
  onFocusSlot?: (slotKey: ChecklistSlotKey) => void;
}

export function DocumentoSummaryHeader({
  documentos,
  isLoading,
  onFocusSlot,
}: DocumentoSummaryHeaderProps) {
  const resumen = summarizeChecklist(documentos);
  const countLabel = `${resumen.total} ${resumen.total === 1 ? 'documento adjunto' : 'documentos adjuntos'}`;

  const keyChecks: ReadonlyArray<{ key: ChecklistSlotKey; label: string; present: boolean }> = [
    { key: 'ine', label: 'INE', present: resumen.hasIne },
    { key: 'foto', label: 'Foto', present: resumen.hasFoto },
    { key: 'denuncia', label: 'Denuncia', present: resumen.hasDenuncia },
    { key: 'orden_proteccion', label: 'Orden', present: resumen.hasOrdenProteccion },
    { key: 'otro', label: 'Otro', present: resumen.hasOtro },
  ];

  return (
    <div className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-on-surface">
            {isLoading ? 'Checklist de documentos' : countLabel}
          </span>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
            {resumen.keyCompleted}/{resumen.keyTotal} clave
          </span>
        </div>

        <Tooltip
          content={`Almacenamiento privado: enlaces firmados de ${SIGNED_URL_TTL_SECONDS} s sin acceso público.`}
        >
          <button
            type="button"
            aria-label="Seguridad de almacenamiento privado"
            className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant"
          >
            <Icon name="lock" className="text-[14px] text-primary" />
            <span className="font-mono">Privado · {SIGNED_URL_TTL_SECONDS} s</span>
          </button>
        </Tooltip>
      </div>

      {!isLoading ? (
        <>
          <Progress
            value={resumen.keyCompleted}
            min={0}
            max={resumen.keyTotal}
            label="Avance de documentos clave"
          />

          <div
            aria-label="Checklist rápido de documentos"
            className="flex flex-wrap items-center gap-1.5 text-xs"
          >
            {keyChecks.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onFocusSlot?.(item.key)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  item.present
                    ? 'bg-status-success-bg text-status-success'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                <Icon
                  name={item.present ? 'check_circle' : 'radio_button_unchecked'}
                  className="text-[14px]"
                />
                <span>{item.label}</span>
                <span className="sr-only">{item.present ? 'adjuntado' : 'pendiente'}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
