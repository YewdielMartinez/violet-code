import { useCallback, useMemo, useState } from 'react';
import {
  validateActividadCampos,
  type ActividadCampo,
  type ActividadPreventivaCreateInput,
  type NivelEducativo,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';
import { useRegistrarActividadPreventiva } from './api';
import { aIsoMazatlan } from './actividadesList';

export const ACTIVIDAD_LAST_STEP = 1;

/** Campos que valida cada paso, en el orden en que se enfocan al fallar. */
const STEP_FIELDS: readonly (readonly ActividadCampo[])[] = [
  ['titulo', 'tipoActividadId', 'tipoInstitucion', 'nivelEducativo', 'sede', 'programadaEn'],
  ['direccion', 'referencias', 'numeroAsistentes'],
];

export interface ActividadFormValue {
  titulo: string;
  tipoActividadId: number;
  tipoInstitucion: TipoInstitucionActividad | '';
  nivelEducativo: NivelEducativo | '';
  sede: string;
  direccion: string;
  referencias: string;
  asistentes: string;
  cuando: Date | null;
  colonia: AsentamientoSepomex | null;
  participantes: readonly string[];
}

/** Mañana a las 09:00 (hora de pared): lo habitual al programar una visita. */
function fechaInicial(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0);
}

function estadoInicial(): ActividadFormValue {
  return {
    titulo: '',
    tipoActividadId: 0,
    tipoInstitucion: '',
    nivelEducativo: '',
    sede: '',
    direccion: '',
    referencias: '',
    asistentes: '',
    cuando: fechaInicial(),
    colonia: null,
    participantes: [],
  };
}

function aInput(form: ActividadFormValue): ActividadPreventivaCreateInput {
  const asistentes = form.asistentes.trim();
  return {
    titulo: form.titulo,
    tipoActividadId: form.tipoActividadId,
    tipoInstitucion: form.tipoInstitucion || ('' as TipoInstitucionActividad),
    nivelEducativo: form.tipoInstitucion === 'escuela' ? form.nivelEducativo || null : null,
    sede: form.sede,
    direccion: form.direccion.trim() || null,
    referencias: form.referencias.trim() || null,
    asentamientoId: form.colonia?.id ?? null,
    programadaEn: form.cuando ? aIsoMazatlan(form.cuando) : '',
    numeroAsistentes: asistentes === '' ? null : Number(asistentes),
    participantesIds: [...form.participantes],
  };
}

/**
 * Estado del asistente «Nueva actividad» (mismo patrón que `useUsuarioForm` y `useFichaForm`): paso actual,
 * error del paso, campo inválido a enfocar, detección de cambios sin guardar y envío.
 */
export function useActividadForm() {
  const [initial] = useState(() => {
    const base = estadoInicial();
    return { base, snapshot: JSON.stringify(base) };
  });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<ActividadCampo | null>(null);
  const [value, setValueRaw] = useState<ActividadFormValue>(initial.base);
  const registrar = useRegistrarActividadPreventiva();

  const isDirty = useMemo(() => JSON.stringify(value) !== initial.snapshot, [value, initial.snapshot]);

  const setValue = useCallback((next: ActividadFormValue) => {
    setValueRaw(next);
    setStepError(null);
    setInvalidField(null);
  }, []);

  const validateStep = useCallback(
    (index: number): { field: ActividadCampo; error: string } | null => {
      const errores = validateActividadCampos(aInput(value));
      for (const field of STEP_FIELDS[index]) {
        const error = errores[field];
        if (error) return { field, error };
      }
      return null;
    },
    [value],
  );

  const goToStep = useCallback((next: number) => {
    setStep(Math.max(0, Math.min(ACTIVIDAD_LAST_STEP, next)));
    setStepError(null);
    setInvalidField(null);
  }, []);

  const goNext = useCallback(
    (onInvalid?: (field: ActividadCampo) => void) => {
      const failure = validateStep(step);
      if (failure) {
        setStepError(failure.error);
        setInvalidField(failure.field);
        onInvalid?.(failure.field);
        return false;
      }
      setStepError(null);
      setInvalidField(null);
      setStep((s) => Math.min(ACTIVIDAD_LAST_STEP, s + 1));
      return true;
    },
    [step, validateStep],
  );

  const goBack = useCallback(() => {
    setStepError(null);
    setInvalidField(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  /** Valida todos los pasos y registra. Devuelve la actividad enviada o `null` si algún paso no es válido. */
  const submit = useCallback(
    async (
      onInvalid?: (field: ActividadCampo, invalidStep: number) => void,
    ): Promise<ActividadPreventivaCreateInput | null> => {
      for (let index = 0; index <= ACTIVIDAD_LAST_STEP; index++) {
        const failure = validateStep(index);
        if (failure) {
          setStep(index);
          setStepError(failure.error);
          setInvalidField(failure.field);
          onInvalid?.(failure.field, index);
          return null;
        }
      }
      const input = aInput(value);
      await registrar.mutateAsync(input);
      return input;
    },
    [validateStep, value, registrar],
  );

  return {
    step,
    stepError,
    invalidField,
    value,
    setValue,
    isDirty,
    goToStep,
    goNext,
    goBack,
    submit,
    isSubmitting: registrar.isPending,
  };
}

/** Enfoca el control marcado con `data-actividad-field` (mismo criterio que `focusUsuarioField`). */
export function focusActividadField(root: HTMLElement | null, field: string | null): void {
  if (!root || !field) return;
  const container = root.querySelector<HTMLElement>(`[data-actividad-field="${field}"]`);
  if (!container) return;
  const target = container.matches('input, select, textarea, button')
    ? container
    : container.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
  if (!target) return;
  target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  target.focus({ preventScroll: true });
}
