import { useCallback, useRef, useState, type RefObject } from 'react';
import { Dialog, LoadingButton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import { CanalizacionFormFields } from './CanalizacionFormFields';
import { useCanalizacionForm } from './useCanalizacionForm';
import './canalizacion-drawer.css';

const LOADING_LABELS = {
  loading: 'Registrando…',
  success: 'Canalización registrada',
  error: 'Revisa los datos',
};

interface BodyProps {
  fixedFichaId?: string;
  fixedFolio?: string;
  onDone: () => void;
}

function CanalizacionFormBody({ fixedFichaId, fixedFolio, onDone }: BodyProps) {
  const form = useCanalizacionForm({ fixedFichaId, onSuccess: onDone });
  const busy = form.submitState === 'loading';

  return (
    <>
      <Dialog.Body>
        <CanalizacionFormFields form={form} fixedFolio={fixedFolio} />
      </Dialog.Body>
      <Dialog.Footer>
        <button type="button" className="mk-button mk-button--text" disabled={busy} onClick={onDone}>
          Cancelar
        </button>
        <LoadingButton
          type="button"
          aria-label="Registrar canalización"
          state={form.submitState}
          labels={LOADING_LABELS}
          compact={false}
          resetAfter={1600}
          onStateChange={(next) => {
            if (next === 'idle') form.setSubmitState('idle');
          }}
          action={form.submit}
          className="mk-button mk-button--primary"
        >
          <Icon name="alt_route" />
          <span>Registrar</span>
        </LoadingButton>
      </Dialog.Footer>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expediente fijo (pestaña del expediente): oculta el selector. */
  fixedFichaId?: string;
  fixedFolio?: string;
  /** Control del que nace el panel lateral; sin él, el kit usa el último control pulsado. */
  anchor?: RefObject<HTMLElement | null> | HTMLElement | null;
}

/**
 * Panel lateral derecho para registrar una canalización (`RF-08`, `RN-01`, `RN-03`).
 * Usa `Dialog` (motion-kit) con `placement="side"`, `variant="morph"` y `anchor` para nacer
 * desde el botón disparador; el formulario se reinicia en cada apertura.
 */
export function CanalizacionFormDialog({ open, onOpenChange, fixedFichaId, fixedFolio, anchor }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setFormKey((k) => k + 1);
  }
  if (open && formKey === 0) setFormKey(1);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onOpenChange(false);
    },
    [onOpenChange],
  );

  const requestClose = useCallback(() => {
    const closeBtn = hostRef.current?.querySelector<HTMLButtonElement>('[data-mk-part="close"]');
    if (closeBtn) closeBtn.click();
    else onOpenChange(false);
  }, [onOpenChange]);

  return (
    <div ref={hostRef}>
      <Dialog.Root
        placement="side"
        variant="morph"
        animateContent={false}
        autoResize={false}
        drag={false}
        anchor={anchor ?? undefined}
        open={open}
        onOpenChange={handleOpenChange}
      >
        <Dialog.Content dividers className="vc-canalizacion-form-dialog">
          <Dialog.Header className="justify-start items-center gap-3">
            <Dialog.Close label="Cerrar" />
            <Dialog.Title className="truncate">Nueva canalización</Dialog.Title>
          </Dialog.Header>
          {formKey > 0 ? (
            <CanalizacionFormBody
              key={formKey}
              fixedFichaId={fixedFichaId}
              fixedFolio={fixedFolio}
              onDone={requestClose}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
