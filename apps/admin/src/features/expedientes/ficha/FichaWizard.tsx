import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { LoadingButton, Stepper, Steps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/stepper';
import '@yewdiel21/motion-kit/css/components/steps';
import type { AgresorValidationField, FichaAgresorInput } from '@/domain/models/Agresor';
import type { DomicilioInput } from '@/domain/models/Domicilio';
import type { EstudioSocioeconomicoInput } from '@/domain/models/EstudioSocioeconomico';
import type { CatalogosFicha, FichaIdentidadInput } from '@/domain/models/FichaRegistro';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { useScrollToTopOnStep } from '@/shared/hooks/useScrollToTopOnStep';
import { Icon } from '@/shared/ui/Icon';
import { FichaAgresorStep } from './FichaAgresorStep';
import { FichaDomicilioStep } from './FichaDomicilioStep';
import { FichaIdentidadStep } from './FichaIdentidadStep';
import { FichaSocioeconomicoStep } from './FichaSocioeconomicoStep';
import './ficha-wizard.css';

export const FICHA_STEP_ITEMS = [
  { label: 'Identidad', description: 'CURP, servicios y aviso' },
  { label: 'Domicilio', description: 'Ubicación y dirección' },
  { label: 'Persona agresora', description: 'Datos opcionales del agresor' },
  { label: 'Estudio socioeconómico', description: 'Vivienda y aportantes' },
];

const LAST_STEP = FICHA_STEP_ITEMS.length - 1;

const SUBMIT_LABELS = {
  loading: 'Guardando…',
  success: 'Guardada',
  error: 'Error al guardar',
};

export function FichaWizardStepper({ step, onSelectStep }: { step: number; onSelectStep: (nextStep: number) => void }) {
  return (
    <Stepper
      className="vc-ficha-stepper"
      items={FICHA_STEP_ITEMS}
      value={step}
      variant="horizontal"
      linear
      label="Pasos de la Ficha Única"
      onChange={onSelectStep}
    />
  );
}

interface StepsSectionProps {
  formId: string;
  formRef: RefObject<HTMLFormElement | null>;
  /** Elemento cuyo inicio se muestra al cambiar de paso (por defecto el formulario; en la página, la tarjeta con el stepper). */
  scrollAnchorRef?: RefObject<HTMLElement | null>;
  step: number;
  stepError: string | null;
  invalidField: string | null;
  agresorErrors?: Partial<Record<AgresorValidationField, string>>;
  duplicateExpediente?: ExpedienteResumen | null;
  identidad: FichaIdentidadInput;
  onIdentidadChange: (next: FichaIdentidadInput) => void;
  domicilio: DomicilioInput;
  onDomicilioChange: (next: DomicilioInput) => void;
  agresor: FichaAgresorInput;
  onAgresorChange: (next: FichaAgresorInput) => void;
  estudio: EstudioSocioeconomicoInput;
  onEstudioChange: (next: EstudioSocioeconomicoInput) => void;
  catalogos?: CatalogosFicha;
  allowPreRegistroLookup?: boolean;
  onOpenExpediente?: (expediente: ExpedienteResumen) => void;
  onDuplicateExpedienteChange?: (expediente: ExpedienteResumen | null) => void;
  onNext: () => void;
  onSubmit: () => void;
  onStepAnimated?: (stepIndex: number) => void;
}

export function FichaWizardSteps({
  formId,
  formRef,
  scrollAnchorRef,
  step,
  stepError,
  invalidField,
  agresorErrors,
  duplicateExpediente,
  identidad,
  onIdentidadChange,
  domicilio,
  onDomicilioChange,
  agresor,
  onAgresorChange,
  estudio,
  onEstudioChange,
  catalogos,
  allowPreRegistroLookup,
  onOpenExpediente,
  onDuplicateExpedienteChange,
  onNext,
  onSubmit,
  onStepAnimated,
}: StepsSectionProps) {
  useScrollToTopOnStep(step, scrollAnchorRef ?? formRef);

  function handleStepChange(next: number, previous: number) {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const activeEl = formRef.current?.querySelectorAll<HTMLElement>('[data-mk-step]')?.[next];
    if (activeEl && !reducedMotion && next !== previous) {
      const dir = next > previous ? 1 : -1;
      gsap.fromTo(
        activeEl,
        { x: dir * 24, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.26, ease: 'power2.out', clearProps: 'transform,opacity' },
      );
    }
    onStepAnimated?.(next);
  }

  return (
    <form
      ref={formRef}
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < LAST_STEP) onNext();
        else onSubmit();
      }}
    >
      <Steps index={step} align="start" duration={0.22} onChange={handleStepChange} className="vc-ficha-steps">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span>
            Paso <Steps.Counter className="font-mono font-semibold text-on-surface" /> de {FICHA_STEP_ITEMS.length}
          </span>
          <span>Los campos con * son obligatorios</span>
        </div>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Datos de identidad y servicios solicitados
            </h3>
            <FichaIdentidadStep
              value={identidad}
              onChange={onIdentidadChange}
              catalogos={catalogos}
              invalidField={invalidField}
              allowPreRegistroLookup={allowPreRegistroLookup}
              onOpenExpediente={onOpenExpediente}
              onDuplicateExpedienteChange={onDuplicateExpedienteChange}
            />
          </div>
        </Steps.Step>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Domicilio de la usuaria
            </h3>
            <FichaDomicilioStep value={domicilio} onChange={onDomicilioChange} invalidField={invalidField} />
          </div>
        </Steps.Step>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Datos de la persona agresora (opcional)
            </h3>
            <FichaAgresorStep
              value={agresor}
              onChange={onAgresorChange}
              catalogos={catalogos}
              errors={agresorErrors}
              invalidField={invalidField}
            />
          </div>
        </Steps.Step>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Estudio socioeconómico y vivienda
            </h3>
            <FichaSocioeconomicoStep value={estudio} onChange={onEstudioChange} catalogos={catalogos} invalidField={invalidField} />
          </div>
        </Steps.Step>
      </Steps>

      {stepError && !duplicateExpediente ? (
        <p role="alert" className="mt-5 rounded-2xl bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
          {stepError}
        </p>
      ) : null}
    </form>
  );
}

interface FooterProps {
  formId: string;
  step: number;
  isSubmitting: boolean;
  submitError: boolean;
  canContinue?: boolean;
  onClearSubmitError?: () => void;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
}

export function FichaWizardFooter({
  formId,
  step,
  isSubmitting,
  submitError,
  canContinue = true,
  onClearSubmitError,
  onBack,
  onCancel,
  onNext,
}: FooterProps) {
  return (
    <>
      <button type="button" className="mk-button mk-button--text" onClick={step === 0 ? onCancel : onBack} disabled={isSubmitting}>
        {step > 0 ? <Icon name="arrow_back" /> : null}
        <span className={step > 0 ? 'ml-1.5' : undefined}>{step === 0 ? 'Cancelar' : 'Atrás'}</span>
      </button>

      {step < LAST_STEP ? (
        <button type="button" className="mk-button mk-button--filled" onClick={onNext} disabled={!canContinue}>
          <span>Siguiente</span>
          <Icon name="arrow_forward" />
        </button>
      ) : (
        <LoadingButton
          type="submit"
          form={formId}
          state={isSubmitting ? 'loading' : submitError ? 'error' : 'idle'}
          compact={false}
          labels={SUBMIT_LABELS}
          onStateChange={(next) => {
            if (next === 'idle') onClearSubmitError?.();
          }}
          className="mk-button mk-button--filled"
          disabled={!canContinue}
        >
          <Icon name="save" />
          <span className="ml-2">Guardar ficha</span>
        </LoadingButton>
      )}
    </>
  );
}
