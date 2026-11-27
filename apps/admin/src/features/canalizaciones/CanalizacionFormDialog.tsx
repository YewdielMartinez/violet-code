import { startTransition, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog, LoadingButton } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/loading-button';
import { prefersReducedMotion } from '@/features/expedientes/drawer/formatters';
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
          <span>Registrar</span>
        </LoadingButton>
      </Dialog.Footer>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expediente fijo (pestaña del expediente): oculta el selector y abre como diálogo centrado. */
  fixedFichaId?: string;
  fixedFolio?: string;
  /** Ubicación del diálogo: por defecto centrado dentro de expediente y lateral en Canalizaciones. */
  placement?: 'side' | 'center';
  /** Control del que nace el diálogo; sin él, el kit usa el último control pulsado. */
  anchor?: RefObject<HTMLElement | null> | HTMLElement | null;
  onAfterClose?: () => void;
}

/**
 * Diálogo para registrar una canalización (`RF-08`, `RN-01`, `RN-03`).
 * En la pantalla de Canalizaciones abre como panel lateral (`side`); dentro del expediente
 * abre como diálogo centrado (`center`), usando `morph` y `anchor` nativos de motion-kit.
 */
  export function CanalizacionFormDialog({
    open,
    onOpenChange,
    fixedFichaId,
    fixedFolio,
    placement,
    anchor,
    onAfterClose,
  }: Props) {
    const resolvedPlacement = placement ?? (fixedFichaId ? 'center' : 'side');
    const hostRef = useRef<HTMLDivElement>(null);
    const [formKey, setFormKey] = useState(0);
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
      setPrevOpen(open);
      if (open) setFormKey((k) => k + 1);
    }
    if (open && formKey === 0) setFormKey(1);

    const [bodyReady, setBodyReady] = useState(() => open && prefersReducedMotion());

    useEffect(() => {
      if (!open) {
        startTransition(() => setBodyReady(false));
        return;
      }
      if (prefersReducedMotion()) {
        startTransition(() => setBodyReady(true));
        return;
      }
      const rafId = window.requestAnimationFrame(() => {
        startTransition(() => setBodyReady(true));
      });
      return () => window.cancelAnimationFrame(rafId);
    }, [open]);

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
          placement={resolvedPlacement}
          variant="morph"
          animateContent={false}
          autoResize={false}
          drag={false}
          anchor={anchor ?? undefined}
          open={open}
          onOpenChange={handleOpenChange}
          onAfterClose={onAfterClose}
        >
              <Dialog.Content
                size={resolvedPlacement === 'center' ? 'md' : undefined}
                dividers
                className="vc-canalizacion-form-dialog vc-perf-dialog"
              >
                <Dialog.Header>
                  <div className="flex min-w-0 items-center gap-3">
                    <Dialog.Close label="Cerrar" />
                    <Dialog.Title className="truncate">Nueva canalización</Dialog.Title>
                  </div>
                </Dialog.Header>
                {formKey > 0 && bodyReady ? (
                  <CanalizacionFormBody
                    key={formKey}
                    fixedFichaId={fixedFichaId}
                    fixedFolio={fixedFolio}
                    onDone={requestClose}
                  />
                ) : (
                  <Dialog.Body>
                    <div
                      role="status"
                      aria-busy="true"
                      aria-label="Cargando formulario"
                      className="grid gap-4 py-2"
                    >
                      <div className="h-14 rounded-2xl bg-surface-container-low animate-pulse motion-reduce:animate-none" />
                      <div className="h-14 rounded-2xl bg-surface-container-low animate-pulse motion-reduce:animate-none" />
                      <div className="h-28 rounded-2xl bg-surface-container-low animate-pulse motion-reduce:animate-none" />
                    </div>
                  </Dialog.Body>
                )}
              </Dialog.Content>
            </Dialog.Root>
          </div>
          );
}
