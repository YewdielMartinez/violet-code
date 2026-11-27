import type { CSSProperties } from 'react';
import { Dialog } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import type { UsuarioCuenta } from '@/domain/models/Usuario';

interface Props {
  cuenta: UsuarioCuenta | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (cuenta: UsuarioCuenta) => void;
}

const NO_ORIGIN = typeof document !== 'undefined' ? document.createElement('span') : null;

/** Confirmación para activar o desactivar una cuenta (mismo diseño que el diálogo de descarte de la Ficha Única). */
export function UsuarioEstadoDialog({ cuenta, isPending, onOpenChange, onConfirm }: Props) {
  const desactivar = cuenta?.activo ?? true;
  return (
    <Dialog.Root anchor={NO_ORIGIN} open={cuenta !== null} onOpenChange={onOpenChange}>
      <Dialog.Content
        style={{ '--mk-dialog-width': '480px' } as CSSProperties}
        className="w-[min(480px,calc(100vw-32px))]"
      >
        <Dialog.Header className="flex items-center justify-start gap-2" style={{ justifyContent: 'flex-start' }}>
          <Dialog.Close label="Cerrar confirmación" />
          <Dialog.Title>{desactivar ? '¿Desactivar esta cuenta?' : '¿Reactivar esta cuenta?'}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-base leading-relaxed text-on-surface-variant">
            {desactivar ? (
              <>
                <strong className="text-on-surface">{cuenta?.nombre}</strong> ya no podrá iniciar sesión. Su historial,
                expedientes y bitácora se conservan; puedes reactivarla en cualquier momento.
              </>
            ) : (
              <>
                <strong className="text-on-surface">{cuenta?.nombre}</strong> podrá volver a iniciar sesión con su
                rol actual.
              </>
            )}
          </p>
        </Dialog.Body>
        <Dialog.Footer className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="mk-button mk-button--tonal min-h-11 px-5 text-base whitespace-nowrap"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            aria-busy={isPending || undefined}
            className={`mk-button mk-button--filled min-h-11 px-5 text-base whitespace-nowrap ${
              desactivar ? 'bg-error text-on-error' : ''
            }`}
            onClick={() => {
              if (cuenta) onConfirm(cuenta);
            }}
          >
            {isPending ? 'Guardando…' : desactivar ? 'Desactivar cuenta' : 'Reactivar cuenta'}
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
