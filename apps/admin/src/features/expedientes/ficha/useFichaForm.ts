import { useCallback, useMemo, useState } from 'react';
import {
  INITIAL_DOMICILIO_INPUT,
  validateDomicilio,
  type DomicilioInput,
} from '@/domain/models/Domicilio';
import {
  INITIAL_ESTUDIO_INPUT,
  validateEstudioSocioeconomico,
  type EstudioSocioeconomicoInput,
} from '@/domain/models/EstudioSocioeconomico';
import {
  createIdentidadFromPreRegistro,
  validateFichaIdentidad,
  type FichaIdentidadInput,
} from '@/domain/models/FichaRegistro';
import type { PreRegistroMovil } from '@/domain/models/PreRegistroMovil';
import { useCreateFicha } from '../api';

export interface FichaSeedContext {
  curp?: string;
  existingPersonaId?: string | null;
  preRegistro?: PreRegistroMovil | null;
}

export function useFichaForm() {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState<{
    identidad: FichaIdentidadInput;
    domicilio: DomicilioInput;
    estudio: EstudioSocioeconomicoInput;
  }>(() => ({
    identidad: createIdentidadFromPreRegistro(null),
    domicilio: INITIAL_DOMICILIO_INPUT,
    estudio: INITIAL_ESTUDIO_INPUT,
  }));
  const [identidad, setIdentidadState] = useState<FichaIdentidadInput>(() =>
    createIdentidadFromPreRegistro(null),
  );
  const [domicilio, setDomicilioState] = useState<DomicilioInput>(INITIAL_DOMICILIO_INPUT);
  const [estudio, setEstudioState] = useState<EstudioSocioeconomicoInput>(INITIAL_ESTUDIO_INPUT);

  const setIdentidad = useCallback((next: FichaIdentidadInput) => {
    setStepError(null);
    setIdentidadState(next);
  }, []);

  const setDomicilio = useCallback((next: DomicilioInput) => {
    setStepError(null);
    setDomicilioState(next);
  }, []);

  const setEstudio = useCallback((next: EstudioSocioeconomicoInput) => {
    setStepError(null);
    setEstudioState(next);
  }, []);

  const createMutation = useCreateFicha();

  const initialize = useCallback((seed?: FichaSeedContext) => {
    const base = createIdentidadFromPreRegistro(seed?.preRegistro, seed?.curp);
    if (seed?.existingPersonaId) {
      base.existingPersonaId = seed.existingPersonaId;
    }
    setBaseline({
      identidad: base,
      domicilio: INITIAL_DOMICILIO_INPUT,
      estudio: INITIAL_ESTUDIO_INPUT,
    });
    setIdentidadState(base);
    setDomicilioState(INITIAL_DOMICILIO_INPUT);
    setEstudioState(INITIAL_ESTUDIO_INPUT);
    setSaved(false);
    setStep(0);
    setStepError(null);
  }, []);

  const isDirty = useMemo(() => {
    if (saved) return false;
    return (
      JSON.stringify(identidad) !== JSON.stringify(baseline.identidad) ||
      JSON.stringify(domicilio) !== JSON.stringify(baseline.domicilio) ||
      JSON.stringify(estudio) !== JSON.stringify(baseline.estudio)
    );
  }, [saved, identidad, domicilio, estudio, baseline]);

  function goNext(): boolean {
    if (step === 0) {
      const err = validateFichaIdentidad(identidad);
      if (err) {
        setStepError(err);
        return false;
      }
    } else if (step === 1) {
      const err = validateDomicilio(domicilio);
      if (err) {
        setStepError(err);
        return false;
      }
    }
    setStepError(null);
    setStep((prev) => Math.min(prev + 1, 2));
    return true;
  }

  function goBack() {
    setStepError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function goToStep(nextStep: number) {
    setStepError(null);
    setStep(nextStep);
  }

  async function submit() {
    const errIdentidad = validateFichaIdentidad(identidad);
    if (errIdentidad) {
      setStep(0);
      setStepError(errIdentidad);
      return null;
    }
    const errDomicilio = validateDomicilio(domicilio);
    if (errDomicilio) {
      setStep(1);
      setStepError(errDomicilio);
      return null;
    }
    const errEstudio = validateEstudioSocioeconomico(estudio);
    if (errEstudio) {
      setStep(2);
      setStepError(errEstudio);
      return null;
    }

    setStepError(null);
    try {
      const created = await createMutation.mutateAsync({ identidad, domicilio, estudio });
      setSaved(true);
      return created;
    } catch (err) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'No se pudo guardar el expediente. Verifica los datos e intenta de nuevo.';
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string'
          ? (err as { code: string }).code
          : '';

      if (code === '23505' || /curp|expediente registrado|ficha única/i.test(msg)) {
        setStep(0);
      }
      setStepError(msg);
      throw err;
    }
  }

  return {
    step,
    setStep,
    goToStep,
    stepError,
    setStepError,
    isDirty,
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
    isSubmitting: createMutation.isPending,
  };
}
