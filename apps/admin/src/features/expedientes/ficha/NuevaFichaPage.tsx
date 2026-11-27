import { useEffect, useId, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FadeContent, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/fade-content';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { useAuth } from '@/shared/auth/useAuth';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog';
import { canLookupPreRegistro, useCatalogosFicha } from '../api';
import { focusFichaField } from './fichaValidation';
import {
  FichaWizardFooter,
  FichaWizardStepper,
  FichaWizardSteps,
} from './FichaWizard';
import { useFichaForm, type FichaSeedContext } from './useFichaForm';

/**
 * Vista de respaldo en ruta dedicada (`/expedientes/nuevo`).
 * Reutiliza el mismo asistente escalonado del panel lateral `NuevaFichaDrawer`.
 */
export default function NuevaFichaPage() {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pendingFocusFieldRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const seed = (location.state as FichaSeedContext | null) ?? null;
  const [submitError, setSubmitError] = useState(false);

  const canCreate = user ? canLookupPreRegistro(user.role) : false;

  const { data: catalogos } = useCatalogosFicha(canCreate);

  const {
    step,
    stepError,
    invalidField,
    agresorErrors,
    duplicateExpediente,
    setDuplicateExpediente,
    isDirty,
    identidad,
    setIdentidad,
    domicilio,
    setDomicilio,
    agresor,
    setAgresor,
    estudio,
    setEstudio,
    initialize,
    goToStep,
    goNext,
    goBack,
    submit,
    isSubmitting,
  } = useFichaForm(catalogos);

  const savedRef = useRef(false);
  const blocker = useUnsavedChangesGuard(canCreate && isDirty, savedRef);

  useEffect(() => {
    initialize(seed ?? undefined);
  }, [seed, initialize]);

  if (!canCreate) {
    return <Navigate to="/expedientes" replace />;
  }

  function handleNext() {
    goNext((field) => focusFichaField(formRef.current, field));
  }

  function handleStepSelect(nextStep: number) {
    if (nextStep < step) goToStep(nextStep);
    else if (nextStep === step + 1) handleNext();
  }

  function handleOpenExpediente(expediente: ExpedienteResumen) {
    navigate(`/expedientes/${encodeURIComponent(expediente.id)}`, { replace: true });
  }

  async function handleFinish() {
    setSubmitError(false);
    try {
      const created = await submit((field, invalidStep) => {
        if (invalidStep === step) focusFichaField(formRef.current, field);
        else pendingFocusFieldRef.current = field;
      });
      if (!created) return;
      savedRef.current = true;
      toast(`Expediente ${created.folio} registrado.`, { tone: 'success' });
      if (created.agresorError) {
        toast(
          `No se pudo guardar la persona agresora: ${created.agresorError}. Puedes agregarla desde el expediente.`,
          { tone: 'error' },
        );
      }
      // Vuelve a la vista anterior; si no hay historial interno, respalda en /expedientes.
      if (window.history.state?.idx > 0) navigate(-1);
      else navigate('/expedientes', { replace: true });
    } catch (err) {
      const msg =
        typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'No se pudo guardar el expediente. Verifica los datos e intenta de nuevo.';
      setSubmitError(true);
      toast(msg, { tone: 'error' });
    }
  }

  return (
    <>
      <PageHeader
        title="Nueva Ficha Única"
        leading={
          <button
            type="button"
            onClick={() => navigate('/expedientes')}
            aria-label="Volver a Expedientes"
            title="Volver a Expedientes"
            className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="arrow_back" />
          </button>
        }
        subtitle={
          seed?.preRegistro
            ? `Datos precargados desde app móvil para ${seed.preRegistro.nombreCompleto}.`
            : 'Captura inicial del expediente, domicilio, persona agresora y estudio socioeconómico.'
        }
      />

      <FadeContent rise={10} duration={0.28} trigger="load" once>
        <div ref={cardRef} className="w-full rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
          <div className="mb-6 border-b border-outline-variant pb-5">
            <FichaWizardStepper step={step} onSelectStep={handleStepSelect} />
          </div>

          <FichaWizardSteps
            formId={formId}
            formRef={formRef}
            scrollAnchorRef={cardRef}
            step={step}
            stepError={stepError}
            invalidField={invalidField}
            agresorErrors={agresorErrors}
            duplicateExpediente={duplicateExpediente}
            identidad={identidad}
            onIdentidadChange={setIdentidad}
            domicilio={domicilio}
            onDomicilioChange={setDomicilio}
            agresor={agresor}
            onAgresorChange={setAgresor}
            estudio={estudio}
            onEstudioChange={setEstudio}
            catalogos={catalogos}
            allowPreRegistroLookup={canCreate}
            onOpenExpediente={handleOpenExpediente}
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

          <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-lowest pt-5 pb-1">
            <FichaWizardFooter
              formId={formId}
              step={step}
              isSubmitting={isSubmitting}
              submitError={submitError}
              canContinue={!duplicateExpediente}
              onClearSubmitError={() => setSubmitError(false)}
              onBack={goBack}
              onCancel={() => navigate('/expedientes')}
              onNext={handleNext}
            />
          </div>
        </div>
      </FadeContent>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
