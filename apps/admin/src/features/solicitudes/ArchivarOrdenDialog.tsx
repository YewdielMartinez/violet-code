import type { CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';

interface Props {
  /** Número de oficio de la orden a archivar; `null` mantiene el diálogo cerrado. */
  oficio: string | null;
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;

/** Confirmación previa al archivado de una orden de protección (mismo diseño que `ArchivarExpedienteDialog`). */
export function ArchivarOrdenDialog({ oficio, open, busy, onCancel, onConfirm }: Props) {
  return (
    <Dialog.Root
      anchor={NO_ORIGIN}
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
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
          <Dialog.Title>¿Archivar orden de protección?</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body className="grid gap-4">
          <p className="text-base leading-relaxed text-on-surface-variant">
            La orden de protección {oficio ? `con oficio ${oficio} ` : ''}dejará de mostrarse en el
            expediente y ya no contará como vigente para las alertas de la persona.
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
