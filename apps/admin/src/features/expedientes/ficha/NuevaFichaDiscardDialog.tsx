import { Dialog } from '@yewdiel21/motion-kit/react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
}

/** Diálogo de confirmación para evitar perder datos capturados en la Ficha Única. */
export function NuevaFichaDiscardDialog({ open, onOpenChange, onConfirmDiscard }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>¿Descartar cambios sin guardar?</Dialog.Title>
          <Dialog.Close label="Cerrar confirmación" />
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-sm text-on-surface-variant">
            Tienes datos capturados en la Ficha Única. Si cierras ahora, perderás el avance.
          </p>
        </Dialog.Body>
        <Dialog.Footer>
          <button
            type="button"
            className="mk-button mk-button--tonal"
            onClick={() => onOpenChange(false)}
          >
            Seguir editando
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled bg-error text-on-error"
            onClick={onConfirmDiscard}
          >
            Descartar y cerrar
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
