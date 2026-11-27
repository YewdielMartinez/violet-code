import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { GlassSwitch, LoadingButton, Select, Stepper, Steps } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/glass-switch';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/menu';
import '@yewdiel21/motion-kit/css/components/select';
import '@yewdiel21/motion-kit/css/components/stepper';
import '@yewdiel21/motion-kit/css/components/steps';
import type { StaffRole } from '@/domain/models/Auth';
import {
  MIN_CONTRASENA,
  ROLE_LABELS,
  ROL_DESCRIPCIONES,
  ROLES_ASIGNABLES,
  rolRequiereArea,
  tipoCuentaDeRol,
  type UsuarioCuenta,
  type UsuarioField,
  type UsuarioFormInput,
} from '@/domain/models/Usuario';
import { PasswordField } from '@/features/auth/PasswordField';
import { Icon } from '@/shared/ui/Icon';
import { USUARIO_LAST_STEP, type UsuarioFormMode } from './useUsuarioForm';
import '@/features/expedientes/ficha/ficha-wizard.css';

export const USUARIO_STEP_ITEMS = [
  { label: 'Cuenta', description: 'Nombre y credenciales' },
  { label: 'Rol y acceso', description: 'Permisos y área' },
];

const SUBMIT_LABELS = {
  loading: 'Guardando…',
  success: 'Guardada',
  error: 'Error al guardar',
};

const AREA_POR_ROL: Partial<Record<StaffRole, string>> = {
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
};

export function UsuarioWizardStepper({ step, onSelectStep }: { step: number; onSelectStep: (next: number) => void }) {
  return (
    <Stepper
      className="vc-ficha-stepper"
      items={USUARIO_STEP_ITEMS}
      value={step}
      variant="horizontal"
      linear
      label="Pasos de la cuenta de usuario"
      onChange={onSelectStep}
    />
  );
}

interface StepsProps {
  formId: string;
  formRef: RefObject<HTMLFormElement | null>;
  mode: UsuarioFormMode;
  original: UsuarioCuenta | null;
  step: number;
  stepError: string | null;
  invalidField: UsuarioField | null;
  value: UsuarioFormInput;
  onChange: (next: UsuarioFormInput) => void;
  /** `true` si la cuenta editada es la de quien tiene la sesión abierta (no puede quitarse acceso a sí misma). */
  isSelf?: boolean;
  onNext: () => void;
  onSubmit: () => void;
  onStepAnimated?: (stepIndex: number) => void;
}

export function UsuarioWizardSteps({
  formId,
  formRef,
  mode,
  original,
  step,
  stepError,
  invalidField,
  value,
  onChange,
  isSelf = false,
  onNext,
  onSubmit,
  onStepAnimated,
}: StepsProps) {
  function update<K extends keyof UsuarioFormInput>(key: K, next: UsuarioFormInput[K]) {
    onChange({ ...value, [key]: next });
  }

  function handleStepChange(next: number, previous: number) {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scroller = formRef.current?.closest<HTMLElement>('[data-mk-part="body"]');
    if (scroller) {
      if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      else scroller.scrollTop = 0;
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
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

  // En edición solo se ofrecen los roles del mismo tipo de cuenta (personal ↔ UMECA viven en tablas distintas).
  const rolOptions = ROLES_ASIGNABLES.filter(
    (rol) => !original || tipoCuentaDeRol(rol) === original.tipo,
  ).map((rol) => ({ value: rol, label: ROLE_LABELS[rol] }));

  const areaLabel = value.rol ? AREA_POR_ROL[value.rol] : undefined;

  return (
    <form
      ref={formRef}
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < USUARIO_LAST_STEP) onNext();
        else onSubmit();
      }}
    >
      <Steps index={step} align="start" duration={0.22} onChange={handleStepChange} className="vc-ficha-steps">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span>
            Paso <Steps.Counter className="font-mono font-semibold text-on-surface" /> de {USUARIO_STEP_ITEMS.length}
          </span>
          <span>Los campos con * son obligatorios</span>
        </div>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Datos de la cuenta
            </h3>
            <div className="vc-ficha-form grid gap-5">
              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Persona responsable</h4>
                <label className="mk-field" data-usuario-field="nombre">
                  <span className="mk-field__label">Nombre completo *</span>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    autoComplete="off"
                    placeholder="Nombre y apellidos"
                    aria-invalid={invalidField === 'nombre' || undefined}
                    value={value.nombre}
                    onChange={(e) => update('nombre', e.target.value)}
                  />
                </label>
              </section>

              {mode === 'create' ? (
                <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                  <h4 className="text-base font-semibold text-on-surface">Credenciales de acceso</h4>
                  <label className="mk-field" data-usuario-field="correo">
                    <span className="mk-field__label">Correo electrónico *</span>
                    <input
                      type="email"
                      required
                      inputMode="email"
                      autoComplete="off"
                      maxLength={254}
                      placeholder="nombre@dependencia.gob.mx"
                      aria-invalid={invalidField === 'correo' || undefined}
                      value={value.correo}
                      onChange={(e) => update('correo', e.target.value)}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <PasswordField
                      label="Contraseña temporal *"
                      name="nueva-contrasena"
                      autoComplete="new-password"
                      placeholder={`Mínimo ${MIN_CONTRASENA} caracteres`}
                      dataAttrs={{ 'data-usuario-field': 'contrasena' }}
                      invalid={invalidField === 'contrasena'}
                      value={value.contrasena}
                      onChange={(next) => update('contrasena', next)}
                    />
                    <PasswordField
                      label="Confirmar contraseña *"
                      name="confirmar-contrasena"
                      autoComplete="new-password"
                      placeholder="Repite la contraseña"
                      dataAttrs={{ 'data-usuario-field': 'confirmarContrasena' }}
                      invalid={invalidField === 'confirmarContrasena'}
                      value={value.confirmarContrasena}
                      onChange={(next) => update('confirmarContrasena', next)}
                    />
                  </div>

                  <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                    <Icon name="info" className="mt-0.5 text-[18px]" />
                    <span>
                      Comparte la contraseña temporal por un medio seguro. Las cuentas son nominales e individuales:
                      no se comparten entre compañeras.
                    </span>
                  </p>
                </section>
              ) : (
                <section className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  <Icon name="lock" className="mt-0.5 text-[18px]" />
                  <span>
                    El correo y la contraseña se administran en Supabase Auth y no se modifican desde este formulario.
                  </span>
                </section>
              )}
            </div>
          </div>
        </Steps.Step>

        <Steps.Step>
          <div data-mk-flow-item="" className="w-full">
            <h3 data-mk-step-title="" className="mb-4 text-base font-semibold text-on-surface">
              Rol, área y acceso
            </h3>
            <div className="vc-ficha-form grid gap-5">
              <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                <h4 className="text-base font-semibold text-on-surface">Permisos</h4>
                <div
                  className="grid gap-2"
                  data-usuario-field="rol"
                  data-ficha-invalid={invalidField === 'rol' || undefined}
                >
                  <span className={`vc-ficha-label ${invalidField === 'rol' ? 'text-status-danger' : ''}`}>Rol *</span>
                  <Select
                    size="lg"
                    label="Rol"
                    placeholder="Selecciona…"
                    options={rolOptions}
                    value={value.rol}
                    onChange={(v) => update('rol', v as StaffRole)}
                  />
                </div>

                {value.rol ? (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface"
                  >
                    <Icon name={value.rol === 'umeca' ? 'domain' : 'badge'} className="mt-0.5 text-status-info" />
                    <div>
                      <p className="font-semibold">{ROLE_LABELS[value.rol]}</p>
                      <p className="mt-0.5 text-on-surface-variant">{ROL_DESCRIPCIONES[value.rol]}</p>
                    </div>
                  </div>
                ) : null}

                <dl className="grid gap-3 rounded-xl bg-surface-container-low p-3.5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-on-surface-variant">Tipo de cuenta</dt>
                    <dd className="mt-0.5 font-medium text-on-surface">
                      {value.rol
                        ? tipoCuentaDeRol(value.rol) === 'externo'
                          ? 'Externa (UMECA)'
                          : 'Personal de SEMUJERES'
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-on-surface-variant">Área de atención</dt>
                    <dd className="mt-0.5 font-medium text-on-surface">
                      {rolRequiereArea(value.rol) ? areaLabel : value.rol ? 'Sin área (no aplica)' : '—'}
                    </dd>
                  </div>
                </dl>
              </section>

              {mode === 'edit' ? (
                <section className="grid gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
                  <h4 className="text-base font-semibold text-on-surface">Estado de la cuenta</h4>
                  <div className="grid gap-3 rounded-2xl bg-surface-container-low p-4">
                    <GlassSwitch
                      checked={value.activo}
                      disabled={isSelf}
                      onChange={(checked) => update('activo', checked)}
                    >
                      Cuenta activa (puede iniciar sesión)
                    </GlassSwitch>
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    {isSelf
                      ? 'No puedes desactivar tu propia cuenta.'
                      : 'Desactivar no borra la cuenta: conserva su historial y bitácora, solo bloquea el acceso.'}
                  </p>
                </section>
              ) : null}
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
  mode: UsuarioFormMode;
  step: number;
  isSubmitting: boolean;
  submitError: boolean;
  onClearSubmitError?: () => void;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
}

export function UsuarioWizardFooter({
  formId,
  mode,
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

      {step < USUARIO_LAST_STEP ? (
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
          <Icon name={mode === 'create' ? 'person_add' : 'save'} />
          <span className="ml-2">{mode === 'create' ? 'Crear cuenta' : 'Guardar cambios'}</span>
        </LoadingButton>
      )}
    </>
  );
}
