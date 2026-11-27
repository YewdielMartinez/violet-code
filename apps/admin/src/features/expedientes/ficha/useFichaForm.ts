import { useCallback, useMemo, useState, type SetStateAction } from 'react';
import {
  INITIAL_FICHA_AGRESOR,
  hasFichaAgresorData,
  toAgresorInput,
  type AgresorValidationField,
  type FichaAgresorInput,
} from '@/domain/models/Agresor';
import { INITIAL_DOMICILIO_INPUT, type DomicilioInput } from '@/domain/models/Domicilio';
import {
  INITIAL_ESTUDIO_INPUT,
  type EstudioSocioeconomicoInput,
} from '@/domain/models/EstudioSocioeconomico';
import {
  createIdentidadFromPreRegistro,
  type CatalogosFicha,
  type FichaIdentidadInput,
} from '@/domain/models/FichaRegistro';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import type { PreRegistroMovil } from '@/domain/models/PreRegistroMovil';
import { useCreateFicha } from '../api';
import {
  validateStepAgresor,
  validateStepDomicilio,
  validateStepEstudio,
  validateStepIdentidad,
} from './fichaValidation';

const LAST_STEP = 3;

export interface FichaSeedContext {
  curp?: string;
  existingPersonaId?: string | null;
  preRegistro?: PreRegistroMovil | null;
}

function serializeDraft(
  identidad: FichaIdentidadInput,
  domicilio: DomicilioInput,
  agresor: FichaAgresorInput,
  estudio: EstudioSocioeconomicoInput,
): string {
  return JSON.stringify({ identidad, domicilio, agresor, estudio });
}

export function useFichaForm(catalogos?: CatalogosFicha) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [agresorErrors, setAgresorErrors] = useState<
    Partial<Record<AgresorValidationField, string>>
  >({});
  const [duplicateExpediente, setDuplicateExpediente] = useState<ExpedienteResumen | null>(null);
  const [identidad, setIdentidadRaw] = useState<FichaIdentidadInput>(() =>
    createIdentidadFromPreRegistro(null),
  );
  const [domicilio, setDomicilioRaw] = useState<DomicilioInput>(INITIAL_DOMICILIO_INPUT);
  const [agresor, setAgresorRaw] = useState<FichaAgresorInput>(INITIAL_FICHA_AGRESOR);
  const [estudio, setEstudioRaw] = useState<EstudioSocioeconomicoInput>(INITIAL_ESTUDIO_INPUT);
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    serializeDraft(
      createIdentidadFromPreRegistro(null),
      INITIAL_DOMICILIO_INPUT,
      INITIAL_FICHA_AGRESOR,
      INITIAL_ESTUDIO_INPUT,
    ),
  );

  const createMutation = useCreateFicha();

  const isDirty = useMemo(
    () => serializeDraft(identidad, domicilio, agresor, estudio) !== initialSnapshot,
    [identidad, domicilio, agresor, estudio, initialSnapshot],
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

  const setAgresor = useCallback((next: SetStateAction<FichaAgresorInput>) => {
    setAgresorRaw(next);
    setStepError(null);
    setInvalidField(null);
    setAgresorErrors({});
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
    setAgresorRaw(INITIAL_FICHA_AGRESOR);
    setEstudioRaw(INITIAL_ESTUDIO_INPUT);
    setInitialSnapshot(
      serializeDraft(base, INITIAL_DOMICILIO_INPUT, INITIAL_FICHA_AGRESOR, INITIAL_ESTUDIO_INPUT),
    );
    setStep(0);
    setStepError(null);
    setInvalidField(null);
    setAgresorErrors({});
    setDuplicateExpediente(null);
  }, []);

  const goToStep = useCallback((nextStep: number) => {
    setStepError(null);
    setInvalidField(null);
    setAgresorErrors({});
    setStep(Math.max(0, Math.min(LAST_STEP, nextStep)));
  }, []);

  function goNext(onInvalid?: (field: string) => void): boolean {
    if (step === 0 && duplicateExpediente) {
      setStepError(
        `Esta persona ya tiene expediente ${duplicateExpediente.folio}. Ábrelo en lugar de crear uno nuevo (RN-02).`,
      );
      setInvalidField('curp');
      onInvalid?.('curp');
      return false;
    }

    if (step === 2) {
      const agresorCheck = validateStepAgresor(
        agresor,
        catalogos?.parentescos ?? [],
        catalogos?.ocupaciones ?? [],
      );
      if (agresorCheck) {
        setAgresorErrors(agresorCheck.errors);
        setStepError(agresorCheck.failure.error);
        setInvalidField(agresorCheck.failure.field);
        onInvalid?.(agresorCheck.failure.field);
        return false;
      }
      setAgresorErrors({});
      setStepError(null);
      setInvalidField(null);
      setStep((prev) => Math.min(prev + 1, LAST_STEP));
      return true;
    }

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
    setStep((prev) => Math.min(prev + 1, LAST_STEP));
    return true;
  }

  function goBack() {
    setStepError(null);
    setInvalidField(null);
    setAgresorErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function submit(onInvalid?: (field: string, invalidStep: number) => void) {
    if (duplicateExpediente) {
      setStep(0);
      setStepError(
        `Esta persona ya tiene expediente ${duplicateExpediente.folio}. Ábrelo en lugar de crear uno nuevo (RN-02).`,
      );
      setInvalidField('curp');
      onInvalid?.('curp', 0);
      return null;
    }

    const parentescos = catalogos?.parentescos ?? [];
    const ocupaciones = catalogos?.ocupaciones ?? [];
    const agresorCheck = validateStepAgresor(agresor, parentescos, ocupaciones);

    const checks = [
      validateStepIdentidad(identidad),
      validateStepDomicilio(domicilio),
      agresorCheck ? agresorCheck.failure : null,
      validateStepEstudio(estudio),
    ];

    for (let i = 0; i < checks.length; i++) {
      const failure = checks[i];
      if (!failure) continue;
      setStep(i);
      setStepError(failure.error);
      setInvalidField(failure.field);
      setAgresorErrors(i === 2 && agresorCheck ? agresorCheck.errors : {});
      onInvalid?.(failure.field, i);
      return null;
    }

    setStepError(null);
    setInvalidField(null);
    setAgresorErrors({});
    const agresorPayload = hasFichaAgresorData(agresor)
      ? toAgresorInput(agresor, '', parentescos, ocupaciones)
      : null;

    try {
      const created = await createMutation.mutateAsync({
        identidad,
        domicilio,
        estudio,
        agresor: agresorPayload,
      });
      // Tras guardar, el borrador deja de contar como "cambios sin guardar".
      setInitialSnapshot(serializeDraft(identidad, domicilio, agresor, estudio));
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
    goNext,
    goBack,
    submit,
    isSubmitting: createMutation.isPending,
  };
}
