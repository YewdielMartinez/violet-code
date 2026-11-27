import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { DateTimePicker, LoadingButton, Stepper, Steps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/date-time-picker';
import '@yewdiel21/motion-kit/css/components/range-calendar';
import '@yewdiel21/motion-kit/css/components/time-field';
import '@yewdiel21/motion-kit/css/components/popover';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/stepper';
import '@yewdiel21/motion-kit/css/components/steps';
import {
  NIVEL_EDUCATIVO_LABELS,
  TIPO_INSTITUCION_LABELS,
  type ActividadCampo,
  type NivelEducativo,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';
import { ROLE_LABELS, type StaffRole } from '@/domain/models/Auth';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';
import { useScrollToTopOnStep } from '@/shared/hooks/useScrollToTopOnStep';
import { Icon } from '@/shared/ui/Icon';
import { useEmpleadosParticipantes, useTiposActividad } from './api';
import { ColoniaSearchField } from './ColoniaSearchField';
import { ACTIVIDAD_LAST_STEP, type ActividadFormValue } from './useActividadForm';
import '@/features/expedientes/ficha/ficha-wizard.css';

export const ACTIVIDAD_STEP_ITEMS = [
  { label: 'Actividad', description: 'Qué, dónde y cuándo' },
  { label: 'Lugar y equipo', description: 'Ubicación y participantes' },
];

const SUBMIT_LABELS = {
  loading: 'Guardando…',
  success: 'Registrada',
  error: 'Error al guardar',
};

const TIPOS_INSTITUCION = Object.keys(TIPO_INSTITUCION_LABELS) as TipoInstitucionActividad[];
const NIVELES = Object.keys(NIVEL_EDUCATIVO_LABELS) as NivelEducativo[];
const CHIP_ON = 'bg-secondary-container text-on-secondary-container';

export function ActividadWizardStepper({
  step,
  onSelectStep,
  editing = false,
}: {
  step: number;
  onSelectStep: (next: number) => void;
  /** Edición de una actividad existente (dentro del diálogo de detalle). */
  editing?: boolean;
}) {
  return (
    <Stepper
      className="vc-ficha-stepper"
      items={ACTIVIDAD_STEP_ITEMS}
      value={step}
      variant="horizontal"
      linear
      label={editing ? 'Pasos de la edición de la actividad' : 'Pasos de la nueva actividad'}
      onChange={onSelectStep}
    />
  );
}

interface StepsProps {
  formId: string;
  formRef: RefObject<HTMLFormElement | null>;
  /** Elemento cuyo inicio se muestra al cambiar de paso (por defecto el formulario; en la página, la tarjeta con el stepper). */
  scrollAnchorRef?: RefObject<HTMLElement | null>;
  step: number;
  stepError: string | null;
  invalidField: ActividadCampo | null;
  value: ActividadFormValue;
  onChange: (next: ActividadFormValue) => void;
  asentamientos: readonly AsentamientoSepomex[];
  asentamientosLoading: boolean;
  /** Edición: «Guardar cambios» está disponible en cualquier paso, así que Enter guarda en lugar de avanzar. */
  editing?: boolean;
  onNext: () => void;
  onSubmit: () => void;
  onStepAnimated?: (stepIndex: number) => void;
}

export function ActividadWizardSteps({
  formId,
  formRef,
  scrollAnchorRef,
  step,
  stepError,
  invalidField,
  value,
  onChange,
  asentamientos,
  asentamientosLoading,
  editing = false,
  onNext,
  onSubmit,
  onStepAnimated,
}: StepsProps) {
  const tiposQuery = useTiposActividad();
  // El personal se pide al llegar al paso donde se usa (el catálogo queda en caché al volver atrás).
  const empleadosQuery = useEmpleadosParticipantes(step >= 1);

  function update<K extends keyof ActividadFormValue>(key: K, next: ActividadFormValue[K]) {
    onChange({ ...value, [key]: next });
  }

  function alternarParticipante(id: string) {
    update(
      'participantes',
      value.participantes.includes(id) ? value.participantes.filter((p) => p !== id) : [...value.participantes, id],
    );
  }

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

  const labelClass = (campo: ActividadCampo) => `vc-ficha-label ${invalidField === campo ? 'text-status-danger' : ''}`;

  return (
    <form
      ref={formRef}
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!editing && step < ACTIVIDAD_LAST_STEP) onNext();
        else onSubmit();
      }}
    >
      <Steps index={step} align="start" duration={0.22} onChange={handleStepChange} className="vc-ficha-steps">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span>
            Paso <Steps.Counter className="font-mono font-semibold text-on-surface" /> de {ACTIVIDAD_STEP_ITEMS.length}
          </span>
          <span>Los campos con * son obligatorios</span>
        </div>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Datos de la actividad
            </h3>
            <div className="vc-ficha-form grid gap-5">
              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Descripción</h4>
                <label className="mk-field" data-actividad-field="titulo">
                  <span className="mk-field__label">Título *</span>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    autoComplete="off"
                    placeholder="Ej. Violencia en el noviazgo"
                    aria-invalid={invalidField === 'titulo' || undefined}
                    value={value.titulo}
                    onChange={(e) => update('titulo', e.target.value)}
                  />
                </label>

                <div
                  className="grid gap-2"
                  data-actividad-field="tipoActividadId"
                  data-ficha-invalid={invalidField === 'tipoActividadId' || undefined}
                >
                  <span className={labelClass('tipoActividadId')}>Tipo de actividad *</span>
                  <div role="radiogroup" aria-label="Tipo de actividad" className="flex flex-wrap gap-2">
                    {tiposQuery.isLoading ? (
                      <span className="text-sm text-on-surface-variant">Cargando tipos…</span>
                    ) : null}
                    {tiposQuery.isError ? (
                      <span className="text-sm text-status-danger">No se pudo cargar el catálogo.</span>
                    ) : null}
                    {(tiposQuery.data ?? []).map((tipo) => (
                      <button
                        key={tipo.id}
                        type="button"
                        role="radio"
                        aria-checked={value.tipoActividadId === tipo.id}
                        onClick={() => update('tipoActividadId', tipo.id)}
                        className={`mk-chip mk-chip--filter vc-press ${value.tipoActividadId === tipo.id ? CHIP_ON : ''}`}
                      >
                        {tipo.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Institución</h4>
                <div
                  className="grid gap-2"
                  data-actividad-field="tipoInstitucion"
                  data-ficha-invalid={invalidField === 'tipoInstitucion' || undefined}
                >
                  <span className={labelClass('tipoInstitucion')}>Tipo de institución *</span>
                  <div role="radiogroup" aria-label="Tipo de institución" className="flex flex-wrap gap-2">
                    {TIPOS_INSTITUCION.map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        role="radio"
                        aria-checked={value.tipoInstitucion === tipo}
                        onClick={() =>
                          onChange({
                            ...value,
                            tipoInstitucion: tipo,
                            ...(tipo !== 'escuela' ? { nivelEducativo: '' as const } : {}),
                          })
                        }
                        className={`mk-chip mk-chip--filter vc-press ${value.tipoInstitucion === tipo ? CHIP_ON : ''}`}
                      >
                        {TIPO_INSTITUCION_LABELS[tipo]}
                      </button>
                    ))}
                  </div>
                </div>

                {value.tipoInstitucion === 'escuela' ? (
                  <div
                    className="grid gap-2"
                    data-actividad-field="nivelEducativo"
                    data-ficha-invalid={invalidField === 'nivelEducativo' || undefined}
                  >
                    <span className={labelClass('nivelEducativo')}>Nivel educativo (opcional)</span>
                    <div role="radiogroup" aria-label="Nivel educativo" className="flex flex-wrap gap-2">
                      {NIVELES.map((nivel) => (
                        <button
                          key={nivel}
                          type="button"
                          role="radio"
                          aria-checked={value.nivelEducativo === nivel}
                          onClick={() => update('nivelEducativo', value.nivelEducativo === nivel ? '' : nivel)}
                          className={`mk-chip mk-chip--filter vc-press ${value.nivelEducativo === nivel ? CHIP_ON : ''}`}
                        >
                          {NIVEL_EDUCATIVO_LABELS[nivel]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="mk-field" data-actividad-field="sede">
                  <span className="mk-field__label">Sede *</span>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    autoComplete="off"
                    placeholder="Ej. Escuela Secundaria Técnica 12"
                    aria-invalid={invalidField === 'sede' || undefined}
                    value={value.sede}
                    onChange={(e) => update('sede', e.target.value)}
                  />
                  <span className="mt-1 text-xs text-on-surface-variant">
                    Nombre de la escuela, empresa, dependencia, parque o recinto.
                  </span>
                </label>
              </section>

              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Programación</h4>
                <div
                  className="grid gap-2"
                  data-actividad-field="programadaEn"
                  data-ficha-invalid={invalidField === 'programadaEn' || undefined}
                >
                  <span className={labelClass('programadaEn')}>Fecha y hora *</span>
                  <DateTimePicker
                    label="Fecha y hora de la actividad"
                    value={value.cuando}
                    minuteStep={15}
                    hourCycle={24}
                    locale="es-MX"
                    onChange={(cuando) => update('cuando', cuando)}
                  />
                  <span className="text-xs text-on-surface-variant">
                    Hora de Mazatlán. {editing ? 'La actividad sigue pendiente' : 'Se registra como pendiente'}; si la fecha ya pasó,
                    ciérrala como realizada desde su detalle.
                  </span>
                </div>
              </section>
            </div>
          </div>
        </Steps.Step>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Lugar, asistentes y equipo
            </h3>
            <div className="vc-ficha-form grid gap-5">
              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Ubicación</h4>
                <div className="grid gap-2">
                  <span className="vc-ficha-label">Colonia (opcional)</span>
                  <ColoniaSearchField
                    value={value.colonia}
                    onChange={(colonia) => update('colonia', colonia)}
                    asentamientos={asentamientos}
                    loading={asentamientosLoading}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="mk-field" data-actividad-field="direccion">
                    <span className="mk-field__label">Dirección (opcional)</span>
                    <input
                      type="text"
                      maxLength={250}
                      autoComplete="off"
                      aria-invalid={invalidField === 'direccion' || undefined}
                      value={value.direccion}
                      onChange={(e) => update('direccion', e.target.value)}
                    />
                  </label>
                  <label className="mk-field" data-actividad-field="referencias">
                    <span className="mk-field__label">Referencias (opcional)</span>
                    <input
                      type="text"
                      maxLength={250}
                      autoComplete="off"
                      placeholder="Entre calles, auditorio, aula…"
                      aria-invalid={invalidField === 'referencias' || undefined}
                      value={value.referencias}
                      onChange={(e) => update('referencias', e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Asistentes y personal</h4>
                <label className="mk-field sm:max-w-64" data-actividad-field="numeroAsistentes">
                  <span className="mk-field__label">Número de asistentes (opcional)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10000}
                    step={1}
                    aria-invalid={invalidField === 'numeroAsistentes' || undefined}
                    value={value.asistentes}
                    onChange={(e) => update('asistentes', e.target.value)}
                  />
                  <span className="mt-1 text-xs text-on-surface-variant">
                    Esperados; al marcarla como realizada registrarás los que asistieron.
                  </span>
                </label>

                <div className="grid gap-2">
                  <span className="vc-ficha-label">Personal que participa (opcional)</span>
                  <div role="group" aria-label="Personal que participa" className="flex flex-wrap gap-2">
                    {empleadosQuery.isLoading ? (
                      <span className="text-sm text-on-surface-variant">Cargando personal…</span>
                    ) : null}
                    {empleadosQuery.isError ? (
                      <span className="text-sm text-status-danger">No se pudo cargar el personal.</span>
                    ) : null}
                    {(empleadosQuery.data ?? []).map((empleado) => {
                      const on = value.participantes.includes(empleado.id);
                      return (
                        <button
                          key={empleado.id}
                          type="button"
                          aria-pressed={on}
                          title={ROLE_LABELS[empleado.rol as StaffRole] ?? empleado.rol}
                          onClick={() => alternarParticipante(empleado.id)}
                          className={`mk-chip mk-chip--filter vc-press ${on ? CHIP_ON : ''}`}
                        >
                          {empleado.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
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

export function ActividadWizardFooter({
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

      {step < ACTIVIDAD_LAST_STEP ? (
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
          <Icon name="event_available" />
          <span className="ml-2">Registrar actividad</span>
        </LoadingButton>
      )}
    </>
  );
}
