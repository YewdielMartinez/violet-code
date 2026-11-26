import type { CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { Blocker } from 'react-router-dom';

interface Props {
  blocker: Blocker;
  message?: string;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;

/** Diálogo de confirmación cuando el usuario intenta salir con cambios sin guardar. */
export function UnsavedChangesDialog({
  blocker,
  message = 'Tienes datos capturados que aún no se han guardado. Si sales ahora, se perderán.',
}: Props) {
  const isBlocked = blocker.state === 'blocked';

  return (
    <Dialog.Root
      anchor={NO_ORIGIN}
      open={isBlocked}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') {
          blocker.reset();
        }
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
          <Dialog.Close label="Cerrar" />
          <Dialog.Title>Cambios sin guardar</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-base leading-relaxed text-on-surface-variant">{message}</p>
        </Dialog.Body>
        <Dialog.Footer className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="mk-button mk-button--tonal min-h-11 px-5 text-base whitespace-nowrap"
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            Seguir editando
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled bg-error text-on-error min-h-11 px-5 text-base whitespace-nowrap"
            onClick={() => blocker.state === 'blocked' && blocker.proceed()}
          >
            Descartar cambios
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
