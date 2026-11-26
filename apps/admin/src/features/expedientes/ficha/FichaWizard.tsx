import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { LoadingButton, Stepper, Steps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/stepper';
import '@yewdiel21/motion-kit/css/components/steps';
import type { DomicilioInput } from '@/domain/models/Domicilio';
import type { EstudioSocioeconomicoInput } from '@/domain/models/EstudioSocioeconomico';
import type { CatalogosFicha, FichaIdentidadInput } from '@/domain/models/FichaRegistro';
import { Icon } from '@/shared/ui/Icon';
import { FichaDomicilioStep } from './FichaDomicilioStep';
import { FichaIdentidadStep } from './FichaIdentidadStep';
import { FichaSocioeconomicoStep } from './FichaSocioeconomicoStep';
import './ficha-wizard.css';

export const FICHA_STEP_ITEMS = [
  { label: 'Identidad', description: 'CURP, servicios y aviso' },
  { label: 'Domicilio', description: 'SEPOMEX o foráneo' },
  { label: 'Estudio socioeconómico', description: 'Vivienda y aportantes' },
];

const SUBMIT_LABELS = {
  loading: 'Guardando…',
  success: 'Guardada',
  error: 'Error al guardar',
};

export function FichaWizardStepper({ step, onSelectStep }: { step: number; onSelectStep: (nextStep: number) => void }) {
  return (
    <Stepper
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
  step: number;
  stepError: string | null;
  invalidField: string | null;
  identidad: FichaIdentidadInput;
  onIdentidadChange: (next: FichaIdentidadInput) => void;
  domicilio: DomicilioInput;
  onDomicilioChange: (next: DomicilioInput) => void;
  estudio: EstudioSocioeconomicoInput;
  onEstudioChange: (next: EstudioSocioeconomicoInput) => void;
  catalogos?: CatalogosFicha;
  onNext: () => void;
  onSubmit: () => void;
  onStepAnimated?: (stepIndex: number) => void;
}

export function FichaWizardSteps({
  formId,
  formRef,
  step,
  stepError,
  invalidField,
  identidad,
  onIdentidadChange,
  domicilio,
  onDomicilioChange,
  estudio,
  onEstudioChange,
  catalogos,
  onNext,
  onSubmit,
  onStepAnimated,
}: StepsSectionProps) {
  function handleStepChange(next: number, previous: number) {
    const scroller = formRef.current?.closest<HTMLElement>('[data-mk-part="body"]');
    if (scroller) scroller.scrollTop = 0;

    const activeEl = formRef.current?.querySelectorAll<HTMLElement>('[data-mk-step]')?.[next];
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (activeEl && !reducedMotion && next !== previous) {
      const dir = next > previous ? 1 : -1;
      gsap.fromTo(activeEl, { x: dir * 28 }, { x: 0, duration: 0.28, ease: 'power2.out', clearProps: 'transform' });
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
        if (step < 2) onNext();
        else onSubmit();
      }}
    >
      <Steps index={step} duration={0.18} onChange={handleStepChange} className="vc-ficha-steps">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span>
            Paso <Steps.Counter className="font-mono font-semibold text-on-surface" /> de 3
          </span>
          <span>Los campos con * son obligatorios</span>
        </div>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Datos de identidad y servicios solicitados
            </h3>
            <FichaIdentidadStep value={identidad} onChange={onIdentidadChange} catalogos={catalogos} invalidField={invalidField} />
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
              Estudio socioeconómico y vivienda
            </h3>
            <FichaSocioeconomicoStep value={estudio} onChange={onEstudioChange} catalogos={catalogos} invalidField={invalidField} />
          </div>
        </Steps.Step>
      </Steps>

      {stepError ? (
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

      {step < 2 ? (
        <button type="button" className="mk-button mk-button--filled" onClick={onNext}>
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
        >
          <Icon name="save" />
          <span className="ml-2">Guardar ficha</span>
        </LoadingButton>
      )}
    </>
  );
}
