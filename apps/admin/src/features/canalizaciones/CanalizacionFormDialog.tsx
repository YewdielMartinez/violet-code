import { useCallback, useRef, useState, type RefObject } from 'react';
import { Dialog, LoadingButton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { Icon } from '@/shared/ui/Icon';
import { CanalizacionFormFields } from './CanalizacionFormFields';
import { useCanalizacionForm } from './useCanalizacionForm';

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
  /** Control del que crece el diálogo; sin él, el kit usa el último control pulsado. */
  anchor?: RefObject<HTMLElement | null> | HTMLElement | null;
}

/**
 * Diálogo centrado para registrar una canalización (`RF-08`, `RN-01`, `RN-03`).
 * El formulario se monta al abrir por primera vez y se reinicia en cada apertura.
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
      if (next) return;
      // motion-kit 0.20.x también llama a onClose desde destroy() (StrictMode) y reabre el diálogo
      // enseguida: si sigue abierto tras ese turno, no fue un cierre real.
      window.setTimeout(() => {
        if (hostRef.current?.querySelector('dialog')?.open) return;
        onOpenChange(false);
      }, 0);
    },
    [onOpenChange],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <div ref={hostRef}>
      <Dialog.Root open={open} onOpenChange={handleOpenChange} anchor={anchor ?? undefined}>
        <Dialog.Content size="md" className="vc-canalizacion-form-dialog">
          <Dialog.Header>
            <Dialog.Title>Nueva canalización</Dialog.Title>
            <Dialog.Close label="Cerrar" />
          </Dialog.Header>
          {formKey > 0 ? (
            <CanalizacionFormBody
              key={formKey}
              fixedFichaId={fixedFichaId}
              fixedFolio={fixedFolio}
              onDone={close}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
