import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { Blocker } from 'react-router-dom';

interface Props {
  blocker: Blocker;
  message?: string;
}

/** Diálogo de confirmación cuando el usuario intenta salir con cambios sin guardar. */
export function UnsavedChangesDialog({
  blocker,
  message = 'Tienes datos capturados que aún no se han guardado. Si sales ahora, se perderán.',
}: Props) {
  const isBlocked = blocker.state === 'blocked';

  return (
    <Dialog.Root
      open={isBlocked}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') {
          blocker.reset();
        }
      }}
    >
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>Cambios sin guardar</Dialog.Title>
          <Dialog.Close label="Cerrar" />
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-sm text-on-surface-variant">{message}</p>
        </Dialog.Body>
        <Dialog.Footer>
          <button
            type="button"
            className="mk-button mk-button--text"
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            Seguir editando
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled"
            onClick={() => blocker.state === 'blocked' && blocker.proceed()}
          >
            Descartar cambios
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
