import { useCallback, useMemo, useState, type SetStateAction } from 'react';
import {
  INITIAL_USUARIO_FORM,
  usuarioFormFromCuenta,
  validateUsuarioCuenta,
  validateUsuarioRol,
  type UsuarioCuenta,
  type UsuarioField,
  type UsuarioFormInput,
} from '@/domain/models/Usuario';
import { useActualizarUsuario, useCrearUsuario } from './api';

export const USUARIO_LAST_STEP = 1;

export type UsuarioFormMode = 'create' | 'edit';

/**
 * Estado del asistente de cuenta (mismo patrón que `useFichaForm`): paso actual, error del paso,
 * campo inválido a enfocar, detección de cambios sin guardar y envío.
 */
export function useUsuarioForm() {
  const [mode, setMode] = useState<UsuarioFormMode>('create');
  const [original, setOriginal] = useState<UsuarioCuenta | null>(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<UsuarioField | null>(null);
  const [value, setValueRaw] = useState<UsuarioFormInput>(INITIAL_USUARIO_FORM);
  const [initialSnapshot, setInitialSnapshot] = useState(() => JSON.stringify(INITIAL_USUARIO_FORM));

  const crearMutation = useCrearUsuario();
  const actualizarMutation = useActualizarUsuario();

  const isDirty = useMemo(() => JSON.stringify(value) !== initialSnapshot, [value, initialSnapshot]);

  const setValue = useCallback((next: SetStateAction<UsuarioFormInput>) => {
    setValueRaw(next);
    setStepError(null);
    setInvalidField(null);
  }, []);

  const initialize = useCallback((cuenta?: UsuarioCuenta | null) => {
    const base = cuenta ? usuarioFormFromCuenta(cuenta) : INITIAL_USUARIO_FORM;
    setMode(cuenta ? 'edit' : 'create');
    setOriginal(cuenta ?? null);
    setStep(0);
    setStepError(null);
    setInvalidField(null);
    setValueRaw(base);
    setInitialSnapshot(JSON.stringify(base));
  }, []);

  const validateStep = useCallback(
    (index: number) => (index === 0 ? validateUsuarioCuenta(value, mode) : validateUsuarioRol(value, original)),
    [value, mode, original],
  );

  const goToStep = useCallback((next: number) => {
    setStep(Math.max(0, Math.min(USUARIO_LAST_STEP, next)));
    setStepError(null);
    setInvalidField(null);
  }, []);

  const goNext = useCallback(
    (onInvalid?: (field: UsuarioField) => void) => {
      const failure = validateStep(step);
      if (failure) {
        setStepError(failure.error);
        setInvalidField(failure.field);
        onInvalid?.(failure.field);
        return false;
      }
      setStepError(null);
      setInvalidField(null);
      setStep((s) => Math.min(USUARIO_LAST_STEP, s + 1));
      return true;
    },
    [step, validateStep],
  );

  const goBack = useCallback(() => {
    setStepError(null);
    setInvalidField(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  /** Valida todos los pasos y guarda. Devuelve la cuenta guardada o `null` si algún paso no es válido. */
  const submit = useCallback(
    async (onInvalid?: (field: UsuarioField, invalidStep: number) => void): Promise<UsuarioCuenta | null> => {
      for (let index = 0; index <= USUARIO_LAST_STEP; index++) {
        const failure = validateStep(index);
        if (failure) {
          setStep(index);
          setStepError(failure.error);
          setInvalidField(failure.field);
          onInvalid?.(failure.field, index);
          return null;
        }
      }
      const rol = value.rol;
      if (!rol) return null;

      if (mode === 'edit' && original) {
        return actualizarMutation.mutateAsync({
          cuenta: original,
          input: { nombre: value.nombre, rol, activo: value.activo },
        });
      }
      return crearMutation.mutateAsync({
        nombre: value.nombre,
        correo: value.correo,
        contrasena: value.contrasena,
        rol,
      });
    },
    [validateStep, value, mode, original, actualizarMutation, crearMutation],
  );

  return {
    mode,
    original,
    step,
    stepError,
    invalidField,
    value,
    setValue,
    isDirty,
    initialize,
    goToStep,
    goNext,
    goBack,
    submit,
    isSubmitting: crearMutation.isPending || actualizarMutation.isPending,
  };
}

/** Enfoca el control marcado con `data-usuario-field` (mismo criterio que `focusFichaField`). */
export function focusUsuarioField(root: HTMLElement | null, field: string | null): void {
  if (!root || !field) return;
  const container = root.querySelector<HTMLElement>(`[data-usuario-field="${field}"]`);
  if (!container) return;
  const target = container.matches('input, select, textarea, button')
    ? container
    : container.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
  if (!target) return;
  target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  target.focus({ preventScroll: true });
}
