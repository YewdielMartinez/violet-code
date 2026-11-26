import { useCallback, useState } from 'react';
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
  const [identidad, setIdentidad] = useState<FichaIdentidadInput>(() =>
    createIdentidadFromPreRegistro(null),
  );
  const [domicilio, setDomicilio] = useState<DomicilioInput>(INITIAL_DOMICILIO_INPUT);
  const [estudio, setEstudio] = useState<EstudioSocioeconomicoInput>(INITIAL_ESTUDIO_INPUT);

  const createMutation = useCreateFicha();

  const initialize = useCallback((seed?: FichaSeedContext) => {
    const base = createIdentidadFromPreRegistro(seed?.preRegistro, seed?.curp);
    if (seed?.existingPersonaId) {
      base.existingPersonaId = seed.existingPersonaId;
    }
    setIdentidad(base);
    setDomicilio(INITIAL_DOMICILIO_INPUT);
    setEstudio(INITIAL_ESTUDIO_INPUT);
    setStep(0);
    setStepError(null);
  }, []);

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
    return createMutation.mutateAsync({ identidad, domicilio, estudio });
  }

  return {
    step,
    setStep,
    stepError,
    setStepError,
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
