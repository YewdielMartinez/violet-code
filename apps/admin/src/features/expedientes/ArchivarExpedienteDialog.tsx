import type { CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';

interface Props {
  folio: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;

/** Confirmación previa al archivado desde el menú de la tabla de Expedientes. */
export function ArchivarExpedienteDialog({ folio, busy, onCancel, onConfirm }: Props) {
  return (
    <Dialog.Root
      anchor={NO_ORIGIN}
      open={folio !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <Dialog.Content
        style={{ '--mk-dialog-width': '480px' } as CSSProperties}
        className="w-[min(480px,calc(100vw-32px))]"
      >
        <Dialog.Header
          className="flex items-center justify-start gap-2"
          style={{ justifyContent: 'flex-start' }}
        >
          <Dialog.Close label="Cerrar confirmación" />
          <Dialog.Title>¿Archivar expediente?</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-base leading-relaxed text-on-surface-variant">
            El expediente {folio} cambiará a estado archivado para resguardo y consulta histórica.
          </p>
        </Dialog.Body>
        <Dialog.Footer className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="mk-button mk-button--tonal min-h-11 px-5 text-base whitespace-nowrap"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled min-h-11 px-5 text-base whitespace-nowrap"
            disabled={busy}
            onClick={onConfirm}
          >
            Sí, archivar
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
