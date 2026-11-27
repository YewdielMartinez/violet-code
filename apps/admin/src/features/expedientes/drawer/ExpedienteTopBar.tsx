import { memo } from 'react';
import { Dialog, toast } from '@yewdiel21/motion-kit/react';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { Icon } from '@/shared/ui/Icon';
import { copyTextToClipboard } from './formatters';

interface Props {
  expediente: ExpedienteResumen | null;
  expanded: boolean;
  onToggleExpand: () => void;
}

/** Cabecera superior del panel: cerrar, expandir ancho y acciones rápidas de contacto/folio. */
export const ExpedienteTopBar = memo(function ExpedienteTopBar({
  expediente,
  expanded,
  onToggleExpand,
}: Props) {
  const phone = expediente?.persona.celular?.trim() ?? '';

  async function handleCopyFolio() {
    if (!expediente) return;
    const ok = await copyTextToClipboard(expediente.folio);
    if (ok) {
      toast('Folio copiado al portapapeles.', { tone: 'success' });
    } else {
      toast('No se pudo copiar el folio.', { tone: 'error' });
    }
  }

  async function handleCopyCurp() {
    if (!expediente) return;
    const ok = await copyTextToClipboard(expediente.persona.curp);
    if (ok) {
      toast('CURP copiada al portapapeles.', { tone: 'success' });
    } else {
      toast('No se pudo copiar la CURP.', { tone: 'error' });
    }
  }

  return (
    <Dialog.Header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Dialog.Close label="Cerrar" />
          <Dialog.Title className="truncate text-2xl font-medium tracking-tight text-on-surface">
            Expediente
          </Dialog.Title>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {expediente ? (
            <>
              <button
                type="button"
                className="mk-button mk-button--tonal"
                onClick={() => void handleCopyFolio()}
              >
                <Icon name="content_copy" />
                <span>Copiar folio</span>
              </button>

              {phone ? (
                <a href={`tel:${phone}`} className="mk-button mk-button--primary">
                  <Icon name="call" />
                  <span>Llamar</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="mk-button mk-button--primary"
                  onClick={() => void handleCopyCurp()}
                >
                  <Icon name="badge" />
                  <span>Copiar CURP</span>
                </button>
              )}
            </>
          ) : null}

          <button
            type="button"
            aria-pressed={expanded}
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name={expanded ? 'chevron_right' : 'chevron_left'} className="text-[18px]" />
            <span>{expanded ? 'Contraer' : 'Expandir'}</span>
          </button>
        </div>
      </div>
    </Dialog.Header>
  );
});
