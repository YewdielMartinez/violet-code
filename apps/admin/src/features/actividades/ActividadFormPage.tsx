import { useId, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FadeContent, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fade-content';
import { puedeRegistrarActividad } from '@/domain/models/ActividadPreventiva';
import { useAsentamientosSepomex } from '@/features/expedientes/api';
import { useAuth } from '@/shared/auth/useAuth';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog';
import { ActividadWizardFooter, ActividadWizardStepper, ActividadWizardSteps } from './ActividadWizard';
import { fechaLargaActividad, horaActividad, mensajeError } from './actividadesList';
import { focusActividadField, useActividadForm } from './useActividadForm';

/**
 * Alta de actividad preventiva (`/actividades/nuevo`, `RF-16`) en pantalla completa,
 * con el mismo esqueleto que `UsuarioFormPage` y `NuevaFichaPage`.
 */
export default function ActividadFormPage() {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pendingFocusFieldRef = useRef<string | null>(null);
  const bypassGuardRef = useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState(false);

  const canCreate = puedeRegistrarActividad(user?.role);
  const form = useActividadForm();
  const { step, goToStep, goNext, goBack, submit, isDirty, isSubmitting } = form;

  // El catálogo de colonias solo se pide al llegar al paso que lo usa.
  const asentamientosQuery = useAsentamientosSepomex(undefined, canCreate && step >= 1);
  const asentamientos = useMemo(() => asentamientosQuery.data ?? [], [asentamientosQuery.data]);

  const blocker = useUnsavedChangesGuard(canCreate && isDirty, bypassGuardRef);

  if (user && !canCreate) {
    return <Navigate to="/actividades" replace />;
  }

  function goToList() {
    navigate('/actividades');
  }

  function handleNext() {
    goNext((field) => focusActividadField(formRef.current, field));
  }

  function handleStepSelect(nextStep: number) {
    if (nextStep < step) goToStep(nextStep);
    else if (nextStep === step + 1) handleNext();
  }

  async function handleFinish() {
    setSubmitError(false);
    try {
      const saved = await submit((field, invalidStep) => {
        if (invalidStep === step) focusActividadField(formRef.current, field);
        else pendingFocusFieldRef.current = field;
      });
      if (!saved) return;
      toast(`Actividad registrada: ${fechaLargaActividad(saved.input.programadaEn)}, ${horaActividad(saved.input.programadaEn)}.`, {
        tone: 'success',
      });
      bypassGuardRef.current = true;
      navigate('/actividades', { replace: true });
    } catch (err) {
      setSubmitError(true);
      toast(mensajeError(err, 'No se pudo registrar la actividad.'), { tone: 'error' });
    }
  }

  return (
    <>
      <PageHeader
        title="Nueva actividad"
        leading={
          <button
            type="button"
            onClick={goToList}
            aria-label="Volver a Actividades"
            title="Volver a Actividades"
            className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="arrow_back" />
          </button>
        }
        subtitle="Programa o registra una capacitación, taller o jornada en una escuela, empresa o comunidad."
      />

      <FadeContent rise={10} duration={0.28} trigger="load" once>
        <div ref={cardRef} className="w-full rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
          <div className="mb-6 border-b border-outline-variant pb-5">
            <ActividadWizardStepper step={step} onSelectStep={handleStepSelect} />
          </div>

          <ActividadWizardSteps
            formId={formId}
            formRef={formRef}
            scrollAnchorRef={cardRef}
            step={step}
            stepError={form.stepError}
            invalidField={form.invalidField}
            value={form.value}
            onChange={form.setValue}
            asentamientos={asentamientos}
            asentamientosLoading={asentamientosQuery.isLoading}
            onNext={handleNext}
            onSubmit={() => {
              void handleFinish();
            }}
            onStepAnimated={() => {
              if (!pendingFocusFieldRef.current) return;
              const target = pendingFocusFieldRef.current;
              pendingFocusFieldRef.current = null;
              focusActividadField(formRef.current, target);
            }}
          />

          <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-lowest pt-5 pb-1">
            <ActividadWizardFooter
              formId={formId}
              step={step}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onClearSubmitError={() => setSubmitError(false)}
              onBack={goBack}
              onCancel={goToList}
              onNext={handleNext}
            />
          </div>
        </div>
      </FadeContent>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
