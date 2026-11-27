import type { CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';

interface Props {
  open: boolean;
  /** «Seguir editando» (o cerrar la confirmación): no descarta nada. */
  onKeepEditing: () => void;
  onDiscard: () => void;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;

/** Confirmación al salir de la edición de una actividad con cambios sin guardar (mismo aspecto que el resto de la app). */
export function ActividadDescartarDialog({ open, onKeepEditing, onDiscard }: Props) {
  return (
    <Dialog.Root anchor={NO_ORIGIN} open={open} onOpenChange={(next) => !next && onKeepEditing()}>
      <Dialog.Content style={{ '--mk-dialog-width': '480px' } as CSSProperties} className="w-[min(480px,calc(100vw-32px))]">
        <Dialog.Header className="flex items-center justify-start gap-2" style={{ justifyContent: 'flex-start' }}>
          <Dialog.Close label="Cerrar confirmación" />
          <Dialog.Title>Cambios sin guardar</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-base leading-relaxed text-on-surface-variant">
            Tienes cambios en la actividad que aún no se han guardado. Si sales ahora, se perderán.
          </p>
        </Dialog.Body>
        <Dialog.Footer className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button type="button" className="mk-button mk-button--tonal min-h-11 px-5 text-base whitespace-nowrap" onClick={onKeepEditing}>
            Seguir editando
          </button>
          <button
            type="button"
            className="mk-button mk-button--filled bg-error text-on-error min-h-11 px-5 text-base whitespace-nowrap"
            onClick={onDiscard}
          >
            Descartar cambios
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
