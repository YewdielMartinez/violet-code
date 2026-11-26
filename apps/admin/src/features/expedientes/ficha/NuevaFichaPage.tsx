import { useEffect, useId } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoadingButton, Stepper, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/stepper';
import { useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { canLookupPreRegistro } from '../api';
import { FichaDomicilioStep } from './FichaDomicilioStep';
import { FichaIdentidadStep } from './FichaIdentidadStep';
import { FichaSocioeconomicoStep } from './FichaSocioeconomicoStep';
import { useFichaForm, type FichaSeedContext } from './useFichaForm';

const STEP_ITEMS = [
  { label: 'Ficha Única', description: 'Identidad, servicios y aviso' },
  { label: 'Domicilio', description: 'SEPOMEX Ahome o foráneo' },
  { label: 'Estudio Socioeconómico', description: 'Vivienda y aportantes' },
];

/**
 * Vista dedicada para la captura completa de la Ficha Única (`/expedientes/nuevo`).
 * Sustituye al modal para dar amplitud operativa en monitores de escritorio.
 */
export default function NuevaFichaPage() {
  const formId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const seed = (location.state as FichaSeedContext | null) ?? null;

  const canCreate = user ? canLookupPreRegistro(user.role) : false;

  const {
    step,
    setStep,
    stepError,
    identidad,
    setIdentidad,
    domicilio,
    setDomicilio,
    estudio,
    setEstudio,
    initialize,
    goNext,
    goBack,
    submit,
    isSubmitting,
  } = useFichaForm();

  // Carga los catálogos solo si el usuario tiene permiso de captura.
  const { data: catalogos } = useCatalogosFichaSafe(canCreate);

  useEffect(() => {
    initialize(seed ?? undefined);
  }, [seed, initialize]);

  if (!canCreate) {
    return <Navigate to="/expedientes" replace />;
  }

  async function handleFinish() {
    try {
      const created = await submit();
      if (!created) return;
      toast(`Expediente ${created.folio} registrado correctamente.`);
      navigate('/expedientes', { replace: true });
    } catch {
      toast('No se pudo guardar el expediente. Verifica los datos e intenta de nuevo.', {
        tone: 'error',
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Secretaría de las Mujeres · Ahome · Trabajo Social"
        title="Nueva Ficha Única de Registro"
        subtitle={
          seed?.preRegistro
            ? `Datos precargados desde app móvil para ${seed.preRegistro.nombreCompleto}.`
            : 'Captura inicial del expediente, domicilio SEPOMEX y estudio socioeconómico.'
        }
        actions={
          <Link to="/expedientes" className="mk-button mk-button--tonal">
            <Icon name="arrow_back" />
            <span className="ml-2">Volver a Expedientes</span>
          </Link>
        }
      />

      <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
        <div className="mb-6 border-b border-outline-variant pb-5">
          <Stepper
            items={STEP_ITEMS}
            value={step}
            variant="horizontal"
            linear
            onChange={(nextStep) => {
              if (nextStep < step) setStep(nextStep);
            }}
          />
        </div>

        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            void handleFinish();
          }}
          noValidate
        >
          {step === 0 ? (
            <FichaIdentidadStep value={identidad} onChange={setIdentidad} catalogos={catalogos} />
          ) : step === 1 ? (
            <FichaDomicilioStep value={domicilio} onChange={setDomicilio} />
          ) : (
            <FichaSocioeconomicoStep value={estudio} onChange={setEstudio} catalogos={catalogos} />
          )}
        </form>

        {stepError ? (
          <p
            role="alert"
            className="mt-5 rounded-2xl bg-status-danger-bg px-4 py-3 text-sm text-status-danger"
          >
            {stepError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-5">
          <button
            type="button"
            className="mk-button mk-button--text"
            onClick={() => (step === 0 ? navigate('/expedientes') : goBack())}
          >
            {step === 0 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < 2 ? (
            <button type="button" className="mk-button mk-button--filled" onClick={goNext}>
              <span>Siguiente</span>
              <Icon name="arrow_forward" />
            </button>
          ) : (
            <LoadingButton
              type="submit"
              form={formId}
              state={isSubmitting ? 'loading' : 'idle'}
              className="mk-button mk-button--filled"
            >
              <Icon name="save" />
              <span className="ml-2">Guardar expediente</span>
            </LoadingButton>
          )}
        </div>
      </div>
    </>
  );
}

import { useCatalogosFicha } from '../api';

function useCatalogosFichaSafe(enabled: boolean) {
  return useCatalogosFicha(enabled);
}
