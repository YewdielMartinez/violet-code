import type { CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
  /** Texto del cuerpo; por defecto, el de la Ficha Única (también lo reutiliza el alta de cuentas). */
  message?: string;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;

/** Diálogo de confirmación para evitar perder datos capturados en la Ficha Única. */
export function NuevaFichaDiscardDialog({
  open,
  onOpenChange,
  onConfirmDiscard,
  message = 'Tienes datos capturados en la Ficha Única. Si cierras ahora, perderás el avance.',
}: Props) {
  return (
    <Dialog.Root anchor={NO_ORIGIN} open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        style={{ '--mk-dialog-width': '480px' } as CSSProperties}
        className="w-[min(480px,calc(100vw-32px))]"
      >
        <Dialog.Header
          className="flex items-center justify-start gap-2"
          style={{ justifyContent: 'flex-start' }}
        >
          <Dialog.Close label="Cerrar confirmación" />
          <Dialog.Title>¿Descartar cambios sin guardar?</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-base leading-relaxed text-on-surface-variant">
            {message}
          </p>
        </Dialog.Body>
        <Dialog.Footer className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="mk-button mk-button--tonal min-h-11 px-5 text-base whitespace-nowrap"
            onClick={() => onOpenChange(false)}
          >
            Seguir editando
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled bg-error text-on-error min-h-11 px-5 text-base whitespace-nowrap"
            onClick={onConfirmDiscard}
          >
            Descartar y cerrar
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
