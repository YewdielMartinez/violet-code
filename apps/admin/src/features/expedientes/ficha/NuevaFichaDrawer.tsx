import { useEffect, useId, useRef, useState } from 'react';
import { Drawer, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/dialog';
import '@yewdiel21/motion-kit/css/components/drawer';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { useCatalogosFicha } from '../api';
import { focusFichaField } from './fichaValidation';
import { FichaWizardFooter, FichaWizardStepper, FichaWizardSteps } from './FichaWizard';
import { NuevaFichaDiscardDialog } from './NuevaFichaDiscardDialog';
import { useFichaForm, type FichaSeedContext } from './useFichaForm';
import './ficha-wizard.css';

export interface NuevaFichaDrawerProps {
  open: boolean;
  seed: FichaSeedContext | null;
  onClose: () => void;
  onCreated?: (fichaId: string) => void;
  onOpenExpediente?: (expediente: ExpedienteResumen) => void;
  allowPreRegistroLookup?: boolean;
}

/**
 * Panel lateral derecho escalonado para capturar una Nueva Ficha Única (`RF-01`, `RF-04`, `RF-34`, `RNF-04`).
 * Incluye verificación inline de CURP y protege contra pérdida accidental de datos sin guardar.
 */
export function NuevaFichaDrawer({
  open,
  seed,
  onClose,
  onCreated,
  onOpenExpediente,
  allowPreRegistroLookup,
}: NuevaFichaDrawerProps) {
  const formId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bypassCloseGuardRef = useRef(false);
  const pendingFocusFieldRef = useRef<string | null>(null);
  const lastInitRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const isSubmittingRef = useRef(false);

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

  const form = useFichaForm();
  const {
    step,
    initialize,
    goToStep,
    goNext,
    goBack,
    submit,
    isDirty,
    isSubmitting,
    duplicateExpediente,
    setDuplicateExpediente,
  } = form;
  const { data: catalogos } = useCatalogosFicha(open);

  const seedKey = seed
    ? JSON.stringify([seed.curp ?? '', seed.existingPersonaId ?? '', seed.preRegistro?.preRegistroId ?? ''])
    : '';

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
    if (lastInitRef.current === seedKey) return;
    lastInitRef.current = seedKey;
    bypassCloseGuardRef.current = false;
    pendingFocusFieldRef.current = null;
    setSubmitError(false);
    setConfirmDiscardOpen(false);
    initialize(seed ?? undefined);
  }, [open, seed, seedKey, initialize]);

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
      // Cierre ya autorizado (guardado exitoso, descarte confirmado): no bloquear. Tras guardar,
      // `isSubmittingRef` aún vale true en este punto porque su efecto corre después del cierre.
      if (bypassCloseGuardRef.current) return;
      if (isSubmittingRef.current) {
        event.preventDefault();
        return;
      }
      if (isDirtyRef.current && !bypassCloseGuardRef.current) {
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

  function handleOpenExistingExpediente(expediente: ExpedienteResumen) {
    bypassCloseGuardRef.current = true;
    setConfirmDiscardOpen(false);
    onOpenExpediente?.(expediente);
    onClose();
  }

  function handleNext() {
    goNext((field) => focusFichaField(formRef.current, field));
  }

  function handleStepSelect(nextStep: number) {
    if (nextStep < step) goToStep(nextStep);
    else if (nextStep === step + 1) handleNext();
  }

  async function handleFinish() {
    setSubmitError(false);
    try {
      const created = await submit((field, invalidStep) => {
        if (invalidStep === step) focusFichaField(formRef.current, field);
        else pendingFocusFieldRef.current = field;
      });
      if (!created) return;

      toast(`Expediente ${created.folio} registrado.`);
      bypassCloseGuardRef.current = true;
      onCreated?.(created.fichaId);
      onClose();
    } catch {
      setSubmitError(true);
      toast('No se pudo guardar la ficha. Verifica los datos.', { tone: 'error' });
    }
  }

  const subtitle = seed?.preRegistro
    ? `Datos precargados desde app móvil para ${seed.preRegistro.nombreCompleto}.`
    : 'Captura escalonada de identidad, domicilio y estudio socioeconómico.';

  return (
    <>
      <div ref={hostRef}>
        <Drawer.Root side="right" open={open} onOpenChange={handleDrawerOpenChange}>
          <Drawer.Content className="vc-ficha-drawer">
            <Drawer.Header className="vc-ficha-drawer__header">
              <div className="vc-ficha-drawer__header-row">
                <div className="min-w-0">
                  <Drawer.Title>Nueva Ficha Única</Drawer.Title>
                  <Drawer.Description>{subtitle}</Drawer.Description>
                </div>
                <Drawer.Close label="Cerrar panel" />
              </div>
              <FichaWizardStepper key={sessionId} step={step} onSelectStep={handleStepSelect} />
            </Drawer.Header>

            <Drawer.Body>
              {/* El asistente (y sus consultas SEPOMEX) solo se monta tras la primera apertura. */}
              {sessionId > 0 ? (
                <FichaWizardSteps
                  key={sessionId}
                  formId={formId}
                  formRef={formRef}
                  step={step}
                  stepError={form.stepError}
                  invalidField={form.invalidField}
                  duplicateExpediente={duplicateExpediente}
                  identidad={form.identidad}
                  onIdentidadChange={form.setIdentidad}
                  domicilio={form.domicilio}
                  onDomicilioChange={form.setDomicilio}
                  estudio={form.estudio}
                  onEstudioChange={form.setEstudio}
                  catalogos={catalogos}
                  allowPreRegistroLookup={allowPreRegistroLookup}
                  onOpenExpediente={onOpenExpediente ? handleOpenExistingExpediente : undefined}
                  onDuplicateExpedienteChange={setDuplicateExpediente}
                  onNext={handleNext}
                  onSubmit={() => {
                    void handleFinish();
                  }}
                  onStepAnimated={() => {
                    if (!pendingFocusFieldRef.current) return;
                    const target = pendingFocusFieldRef.current;
                    pendingFocusFieldRef.current = null;
                    focusFichaField(formRef.current, target);
                  }}
                />
              ) : null}
            </Drawer.Body>

            <Drawer.Footer className="vc-ficha-drawer__footer">
              <FichaWizardFooter
                formId={formId}
                step={step}
                isSubmitting={isSubmitting}
                submitError={submitError}
                canContinue={!duplicateExpediente}
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
      />
    </>
  );
}
