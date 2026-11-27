import { useEffect, useId, useRef, useState } from 'react';
import { Drawer, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/drawer';
import type { UsuarioCuenta } from '@/domain/models/Usuario';
import { NuevaFichaDiscardDialog } from '@/features/expedientes/ficha/NuevaFichaDiscardDialog';
import { useAuth } from '@/shared/auth/useAuth';
import { errorMessage } from './api';
import { focusUsuarioField, useUsuarioForm } from './useUsuarioForm';
import { UsuarioWizardFooter, UsuarioWizardStepper, UsuarioWizardSteps } from './UsuarioWizard';
import '@/features/expedientes/ficha/ficha-wizard.css';

export interface UsuarioDrawerProps {
  open: boolean;
  /** `null` = alta de cuenta nueva; con valor = edición. */
  cuenta: UsuarioCuenta | null;
  onClose: () => void;
  onSaved?: (cuenta: UsuarioCuenta) => void;
}

/**
 * Panel lateral escalonado para dar de alta o editar cuentas del panel (`cuentas.gestionar`).
 * Mismo diseño, componentes y protección de cambios sin guardar que `NuevaFichaDrawer`.
 */
export function UsuarioDrawer({ open, cuenta, onClose, onSaved }: UsuarioDrawerProps) {
  const formId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bypassCloseGuardRef = useRef(false);
  const pendingFocusFieldRef = useRef<string | null>(null);
  const lastInitRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  if (open && !prevOpen) {
    setPrevOpen(true);
    setSessionId((n) => n + 1);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const form = useUsuarioForm();
  const { mode, step, initialize, goToStep, goNext, goBack, submit, isDirty, isSubmitting } = form;
  const initKey = cuenta ? `edit:${cuenta.id}` : 'create';

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    if (!open) {
      lastInitRef.current = null;
      return;
    }
    if (lastInitRef.current === initKey) return;
    lastInitRef.current = initKey;
    bypassCloseGuardRef.current = false;
    pendingFocusFieldRef.current = null;
    setSubmitError(false);
    setConfirmDiscardOpen(false);
    initialize(cuenta);
  }, [open, cuenta, initKey, initialize]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function ignoreStaleClose(event: Event) {
      const target = event.target;
      if (target instanceof HTMLDialogElement && target.hasAttribute('open')) {
        event.stopPropagation();
      }
    }
    host.addEventListener('close', ignoreStaleClose, true);
    return () => host.removeEventListener('close', ignoreStaleClose, true);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function handleNativeClose(event: Event) {
      const target = event.target;
      if (!(target instanceof Element) || !target.hasAttribute('data-mk-drawer')) return;
      if (bypassCloseGuardRef.current) return;
      if (isSubmittingRef.current) {
        event.preventDefault();
        return;
      }
      if (isDirtyRef.current) {
        event.preventDefault();
        setConfirmDiscardOpen(true);
      }
    }
    host.addEventListener('mk:close', handleNativeClose);
    return () => host.removeEventListener('mk:close', handleNativeClose);
  }, []);

  function handleDrawerOpenChange(nextOpen: boolean) {
    if (nextOpen) return;

    function finalizeClose() {
      if (bypassCloseGuardRef.current) {
        onClose();
        return;
      }
      if (isSubmittingRef.current) return;
      if (isDirtyRef.current) {
        setConfirmDiscardOpen(true);
        return;
      }
      onClose();
    }

    if (hostRef.current?.querySelector('dialog') && !bypassCloseGuardRef.current) {
      window.setTimeout(() => {
        if (hostRef.current?.querySelector('dialog')?.open) return;
        finalizeClose();
      }, 0);
      return;
    }

    finalizeClose();
  }

  function requestClose() {
    if (isSubmittingRef.current) return;
    if (isDirtyRef.current) {
      setConfirmDiscardOpen(true);
      return;
    }
    bypassCloseGuardRef.current = true;
    onClose();
  }

  function handleConfirmDiscard() {
    bypassCloseGuardRef.current = true;
    setConfirmDiscardOpen(false);
    onClose();
  }

  function handleNext() {
    goNext((field) => focusUsuarioField(formRef.current, field));
  }

  function handleStepSelect(nextStep: number) {
    if (nextStep < step) goToStep(nextStep);
    else if (nextStep === step + 1) handleNext();
  }

  async function handleFinish() {
    setSubmitError(false);
    try {
      const saved = await submit((field, invalidStep) => {
        if (invalidStep === step) focusUsuarioField(formRef.current, field);
        else pendingFocusFieldRef.current = field;
      });
      if (!saved) return;
      toast(mode === 'create' ? `Cuenta de ${saved.nombre} creada.` : `Cuenta de ${saved.nombre} actualizada.`);
      bypassCloseGuardRef.current = true;
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setSubmitError(true);
      toast(errorMessage(err, 'No se pudo guardar la cuenta. Verifica los datos.'), { tone: 'error' });
    }
  }

  const isEdit = cuenta !== null;
  const title = isEdit ? 'Editar usuario' : 'Nuevo usuario';
  const subtitle = isEdit
    ? `Actualiza el nombre, rol o acceso de ${cuenta.nombre}.`
    : 'Alta escalonada de la cuenta: datos de acceso, rol y área.';

  return (
    <>
      <div ref={hostRef}>
        <Drawer.Root side="right" open={open} onOpenChange={handleDrawerOpenChange}>
          <Drawer.Content className="vc-ficha-drawer">
            <Drawer.Header className="vc-ficha-drawer__header">
              <div className="vc-ficha-drawer__header-row">
                <div className="min-w-0">
                  <Drawer.Title>{title}</Drawer.Title>
                  <Drawer.Description>{subtitle}</Drawer.Description>
                </div>
                <Drawer.Close label="Cerrar panel" />
              </div>
              <UsuarioWizardStepper key={sessionId} step={step} onSelectStep={handleStepSelect} />
            </Drawer.Header>

            <Drawer.Body>
              {sessionId > 0 ? (
                <UsuarioWizardSteps
                  key={sessionId}
                  formId={formId}
                  formRef={formRef}
                  mode={mode}
                  original={form.original}
                  step={step}
                  stepError={form.stepError}
                  invalidField={form.invalidField}
                  value={form.value}
                  onChange={form.setValue}
                  isSelf={Boolean(cuenta && user && cuenta.id === user.id)}
                  onNext={handleNext}
                  onSubmit={() => {
                    void handleFinish();
                  }}
                  onStepAnimated={() => {
                    if (!pendingFocusFieldRef.current) return;
                    const target = pendingFocusFieldRef.current;
                    pendingFocusFieldRef.current = null;
                    focusUsuarioField(formRef.current, target);
                  }}
                />
              ) : null}
            </Drawer.Body>

            <Drawer.Footer className="vc-ficha-drawer__footer">
              <UsuarioWizardFooter
                formId={formId}
                mode={mode}
                step={step}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onClearSubmitError={() => setSubmitError(false)}
                onBack={goBack}
                onCancel={requestClose}
                onNext={handleNext}
              />
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Root>
      </div>

      <NuevaFichaDiscardDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        onConfirmDiscard={handleConfirmDiscard}
        message="Tienes datos capturados en la cuenta de usuario. Si cierras ahora, perderás el avance."
      />
    </>
  );
}
