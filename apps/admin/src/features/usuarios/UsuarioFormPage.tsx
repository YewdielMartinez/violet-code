import { useEffect, useId, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, FadeContent, Skeleton, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import '@yewdiel21/motion-kit/css/components/fade-content';
import '@yewdiel21/motion-kit/css/components/skeleton';
import { useAuth } from '@/shared/auth/useAuth';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog';
import { errorMessage, puedeGestionarCuentas, useUsuarios } from './api';
import { focusUsuarioField, useUsuarioForm } from './useUsuarioForm';
import { UsuarioWizardFooter, UsuarioWizardStepper, UsuarioWizardSteps } from './UsuarioWizard';

const BACK_ACTION = [{ id: 'back', label: 'Volver a Usuarios' }];

/**
 * Alta (`/usuarios/nuevo`) y edición (`/usuarios/:id`) de cuentas en pantalla completa,
 * con el mismo esqueleto que `NuevaFichaPage` (Nueva Ficha Única de Expedientes).
 */
export default function UsuarioFormPage() {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocusFieldRef = useRef<string | null>(null);
  const bypassGuardRef = useRef(false);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState(false);

  const canManage = puedeGestionarCuentas(user?.role);
  const isEditRoute = Boolean(id);
  const { data, isLoading, isError, refetch } = useUsuarios(canManage && isEditRoute);
  const cuenta = isEditRoute ? (data?.find((c) => c.id === id) ?? null) : null;

  const form = useUsuarioForm();
  const { mode, step, initialize, goToStep, goNext, goBack, submit, isDirty, isSubmitting } = form;

  const blocker = useUnsavedChangesGuard(canManage && isDirty, bypassGuardRef);

  // Inicializa una sola vez por cuenta (o al entrar al alta); no re-inicia al refrescar la caché.
  const initKey = isEditRoute ? (cuenta ? `edit:${cuenta.id}` : null) : 'create';
  const lastInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initKey || lastInitRef.current === initKey) return;
    lastInitRef.current = initKey;
    initialize(cuenta);
  }, [initKey, cuenta, initialize]);

  if (user && !canManage) {
    return <Navigate to="/" replace />;
  }

  function goToList() {
    navigate('/usuarios');
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
      bypassGuardRef.current = true;
      navigate('/usuarios', { replace: true });
    } catch (err) {
      setSubmitError(true);
      toast(errorMessage(err, 'No se pudo guardar la cuenta. Verifica los datos e intenta de nuevo.'), {
        tone: 'error',
      });
    }
  }

  const title = isEditRoute ? 'Editar usuario' : 'Nuevo usuario';
  const subtitle = isEditRoute
    ? cuenta
      ? `Actualiza el nombre, rol o acceso de ${cuenta.nombre}.`
      : 'Cargando la cuenta…'
    : 'Alta de la cuenta: datos de acceso, rol y área.';

  const notFound = isEditRoute && !isLoading && !isError && data !== undefined && !cuenta;

  return (
    <>
      <PageHeader
        title={title}
        leading={
          <button
            type="button"
            onClick={goToList}
            aria-label="Volver a Usuarios"
            title="Volver a Usuarios"
            className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon name="arrow_back" />
          </button>
        }
        subtitle={subtitle}
      />

      {isError || notFound ? (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="error"
            title={notFound ? 'No se encontró la cuenta' : 'No se pudo cargar la cuenta'}
            description={
              notFound ? 'Puede que ya no exista o que no tengas acceso a ella.' : 'Verifica tu conexión y permisos en Supabase.'
            }
            actions={notFound ? BACK_ACTION : [{ id: 'retry', label: 'Reintentar' }]}
            onAction={(action) => (action === 'back' ? goToList() : void refetch())}
          />
        </div>
      ) : (
        <Skeleton loading={isEditRoute && !cuenta} shape="card" lines={6} label="Cargando cuenta">
          <FadeContent rise={10} duration={0.28} trigger="load" once>
            <div className="w-full rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
              <div className="mb-6 border-b border-outline-variant pb-5">
                <UsuarioWizardStepper step={step} onSelectStep={handleStepSelect} />
              </div>

              <UsuarioWizardSteps
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

              <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-lowest pt-5 pb-1">
                <UsuarioWizardFooter
                  formId={formId}
                  mode={mode}
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
        </Skeleton>
      )}
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
