import { useMemo, useState } from 'react';
import { toast } from '@yewdiel21/motion-kit/react';
import { useAuth } from '@/shared/auth/useAuth';
import {
  extraerMensajeErrorDerivacion,
  isInternalDestino,
  useCanalizacionCatalogos,
  useCreateDerivacion,
  validateDerivacion,
  type DestinoDerivacion,
} from './api';
import { validarReglasDestino } from './canalizacionRules';

export type FormErrors = Partial<Record<'expediente' | 'destino' | 'institucion' | 'motivo' | 'general', string>>;

/** Estado, validación y envío del formulario simple de nueva canalización (`RF-08`). */
export function useCanalizacionForm({
  fixedFichaId,
  onSuccess,
}: {
  fixedFichaId?: string;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const catalogos = useCanalizacionCatalogos();
  const createMutation = useCreateDerivacion();

  const [fichaId, setFichaId] = useState(fixedFichaId ?? '');
  const [areaOrigenId, setAreaOrigenId] = useState<number | null>(user?.areaId ?? null);
  const [destino, setDestino] = useState<DestinoDerivacion>('trabajo_social');
  const [institucionId, setInstitucionId] = useState<number | null>(null);
  const [institucionOtra, setInstitucionOtra] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const internal = isInternalDestino(destino);
  const persona = useMemo(
    () => (catalogos.expedientes ?? []).find((e) => e.id === fichaId)?.persona ?? null,
    [catalogos.expedientes, fichaId],
  );
  const reglaError = fichaId ? validarReglasDestino(persona, destino) : null;
  const areaDestinoId = useMemo(
    () => (internal ? ((catalogos.areas ?? []).find((a) => a.clave === destino)?.id ?? null) : null),
    [internal, catalogos.areas, destino],
  );

  function clearError(key: keyof FormErrors) {
    setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: undefined, general: undefined } : prev));
  }

  function changeDestino(next: DestinoDerivacion) {
    setDestino(next);
    setInstitucionId(null);
    setInstitucionOtra('');
    clearError('destino');
    clearError('institucion');
  }

  async function submit() {
    if (submitState === 'loading') return;
    const found: FormErrors = {};
    if (!fichaId) found.expediente = 'Selecciona el expediente a canalizar.';
    if (reglaError) found.destino = reglaError;
    if (!internal && destino === 'otra_institucion' && institucionId === null && !institucionOtra.trim()) {
      found.institucion = 'Especifica la institución externa de destino.';
    }
    if (!motivo.trim()) found.motivo = 'Describe el motivo de la canalización.';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSubmitState('error');
      return;
    }

    const payload = {
      fichaId,
      areaOrigenId,
      destino,
      areaDestinoId,
      institucionId: internal ? null : institucionId,
      institucionOtra: internal || institucionId !== null ? '' : institucionOtra,
      motivo,
    };
    const invalid = validateDerivacion(payload);
    if (invalid) {
      setErrors({ general: invalid });
      setSubmitState('error');
      return;
    }

    setErrors({});
    setSubmitState('loading');
    try {
      await createMutation.mutateAsync(payload);
      setSubmitState('success');
      toast('Canalización registrada correctamente.', { tone: 'success' });
      onSuccess();
    } catch (err) {
      setSubmitState('error');
      const msg = extraerMensajeErrorDerivacion(
        err,
        'No se pudo registrar la canalización. Verifica los datos e intenta de nuevo.',
      );
      setErrors({ general: msg });
      toast(msg, { tone: 'error' });
    }
  }

  return {
    catalogos,
    internal,
    reglaError,
    values: { fichaId, areaOrigenId, destino, institucionId, institucionOtra, motivo },
    errors,
    submitState,
    setSubmitState,
    setFichaId: (v: string) => {
      setFichaId(v);
      clearError('expediente');
      clearError('destino');
    },
    setAreaOrigenId,
    changeDestino,
    setInstitucionId: (v: number | null) => {
      setInstitucionId(v);
      if (v !== null) setInstitucionOtra('');
      clearError('institucion');
    },
    setInstitucionOtra: (v: string) => {
      setInstitucionOtra(v);
      clearError('institucion');
    },
    setMotivo: (v: string) => {
      setMotivo(v);
      clearError('motivo');
    },
    submit,
  };
}

export type CanalizacionFormState = ReturnType<typeof useCanalizacionForm>;
