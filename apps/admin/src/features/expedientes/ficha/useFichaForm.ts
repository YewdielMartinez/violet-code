import { useCallback, useMemo, useState, type SetStateAction } from 'react';
import { INITIAL_DOMICILIO_INPUT, type DomicilioInput } from '@/domain/models/Domicilio';
import {
  INITIAL_ESTUDIO_INPUT,
  type EstudioSocioeconomicoInput,
} from '@/domain/models/EstudioSocioeconomico';
import {
  createIdentidadFromPreRegistro,
  type FichaIdentidadInput,
} from '@/domain/models/FichaRegistro';
import type { PreRegistroMovil } from '@/domain/models/PreRegistroMovil';
import { useCreateFicha } from '../api';
import {
  validateStepDomicilio,
  validateStepEstudio,
  validateStepIdentidad,
} from './fichaValidation';

export interface FichaSeedContext {
  curp?: string;
  existingPersonaId?: string | null;
  preRegistro?: PreRegistroMovil | null;
}

function serializeDraft(
  identidad: FichaIdentidadInput,
  domicilio: DomicilioInput,
  estudio: EstudioSocioeconomicoInput,
): string {
  return JSON.stringify({ identidad, domicilio, estudio });
}

export function useFichaForm() {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [identidad, setIdentidadRaw] = useState<FichaIdentidadInput>(() =>
    createIdentidadFromPreRegistro(null),
  );
  const [domicilio, setDomicilioRaw] = useState<DomicilioInput>(INITIAL_DOMICILIO_INPUT);
  const [estudio, setEstudioRaw] = useState<EstudioSocioeconomicoInput>(INITIAL_ESTUDIO_INPUT);
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    serializeDraft(
      createIdentidadFromPreRegistro(null),
      INITIAL_DOMICILIO_INPUT,
      INITIAL_ESTUDIO_INPUT,
    ),
  );

  const createMutation = useCreateFicha();

  const isDirty = useMemo(
    () => serializeDraft(identidad, domicilio, estudio) !== initialSnapshot,
    [identidad, domicilio, estudio, initialSnapshot],
  );

  const setIdentidad = useCallback((next: SetStateAction<FichaIdentidadInput>) => {
    setIdentidadRaw(next);
    setStepError(null);
    setInvalidField(null);
  }, []);

  const setDomicilio = useCallback((next: SetStateAction<DomicilioInput>) => {
    setDomicilioRaw(next);
    setStepError(null);
    setInvalidField(null);
  }, []);

  const setEstudio = useCallback((next: SetStateAction<EstudioSocioeconomicoInput>) => {
    setEstudioRaw(next);
    setStepError(null);
    setInvalidField(null);
  }, []);

  const initialize = useCallback((seed?: FichaSeedContext) => {
    const base = createIdentidadFromPreRegistro(seed?.preRegistro, seed?.curp);
    if (seed?.existingPersonaId) {
      base.existingPersonaId = seed.existingPersonaId;
    }
    setIdentidadRaw(base);
    setDomicilioRaw(INITIAL_DOMICILIO_INPUT);
    setEstudioRaw(INITIAL_ESTUDIO_INPUT);
    setInitialSnapshot(serializeDraft(base, INITIAL_DOMICILIO_INPUT, INITIAL_ESTUDIO_INPUT));
    setStep(0);
    setStepError(null);
    setInvalidField(null);
  }, []);

  const goToStep = useCallback((nextStep: number) => {
    setStepError(null);
    setInvalidField(null);
    setStep(Math.max(0, Math.min(2, nextStep)));
  }, []);

  function goNext(onInvalid?: (field: string) => void): boolean {
    const failure =
      step === 0
        ? validateStepIdentidad(identidad)
        : step === 1
          ? validateStepDomicilio(domicilio)
          : null;

    if (failure) {
      setStepError(failure.error);
      setInvalidField(failure.field);
      onInvalid?.(failure.field);
      return false;
    }

    setStepError(null);
    setInvalidField(null);
    setStep((prev) => Math.min(prev + 1, 2));
    return true;
  }

  function goBack() {
    setStepError(null);
    setInvalidField(null);
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function submit(onInvalid?: (field: string, invalidStep: number) => void) {
    const checks = [
      validateStepIdentidad(identidad),
      validateStepDomicilio(domicilio),
      validateStepEstudio(estudio),
    ];

    for (let i = 0; i < checks.length; i++) {
      const failure = checks[i];
      if (!failure) continue;
      setStep(i);
      setStepError(failure.error);
      setInvalidField(failure.field);
      onInvalid?.(failure.field, i);
      return null;
    }

    setStepError(null);
    setInvalidField(null);
    return createMutation.mutateAsync({ identidad, domicilio, estudio });
  }

  return {
    step,
    setStep,
    stepError,
    setStepError,
    invalidField,
    isDirty,
    identidad,
    setIdentidad,
    domicilio,
    setDomicilio,
    estudio,
    setEstudio,
    initialize,
    goToStep,
    goNext,
    goBack,
    submit,
    isSubmitting: createMutation.isPending,
  };
}
