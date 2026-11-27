import { useCallback, useMemo, useState } from 'react';
import {
  validateActividadActualizar,
  aplicarEdicionActividad,
  type ActividadEdicionVista,
} from '@/domain/models/ActividadEdicion';
import {
  validateActividadCampos,
  type ActividadCampo,
  type ActividadPreventivaCreateInput,
  type ActividadPreventivaItem,
  type NivelEducativo,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';
import type { AsentamientoSepomex } from '@/domain/models/Domicilio';
import {
  useActualizarActividadPreventiva,
  useEmpleadosParticipantes,
  useRegistrarActividadPreventiva,
  useTiposActividad,
} from './api';
import { aIsoMazatlan, deIsoMazatlan } from './actividadesList';

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

/** Valores del formulario a partir de una actividad existente (modo edición). */
export function actividadAFormValue(actividad: ActividadPreventivaItem): ActividadFormValue {
  return {
    titulo: actividad.titulo,
    tipoActividadId: actividad.tipoActividadId,
    tipoInstitucion: actividad.tipoInstitucion,
    nivelEducativo: actividad.nivelEducativo ?? '',
    sede: actividad.sede,
    direccion: actividad.direccion ?? '',
    referencias: actividad.referencias ?? '',
    asistentes: actividad.numeroAsistentes === null ? '' : String(actividad.numeroAsistentes),
    cuando: deIsoMazatlan(actividad.programadaEn),
    // El detalle solo trae nombre, CP y municipio: el tipo de asentamiento no se conoce y no se muestra.
    colonia:
      actividad.asentamientoId === null
        ? null
        : {
            id: actividad.asentamientoId,
            nombre: actividad.asentamientoNombre ?? 'Colonia',
            tipoAsentamiento: '',
            codigoPostal: actividad.codigoPostal ?? '',
            municipio: actividad.municipio ?? '',
            estado: '',
            localidad: null,
          },
    participantes: actividad.participantes.map((p) => p.empleadoId),
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

export interface UseActividadFormOptions {
  /** Con una actividad, el formulario es de edición (`actualizar_actividad_preventiva`): precarga sus valores. */
  actividad?: ActividadPreventivaItem;
}

/** Lo que devuelve `submit`: los datos enviados y, en edición, la actividad ya actualizada (con el nuevo `actualizado_en`). */
export interface ActividadGuardada {
  input: ActividadPreventivaCreateInput;
  actualizada: ActividadPreventivaItem | null;
}

/**
 * Estado del asistente de actividad (mismo patrón que `useUsuarioForm` y `useFichaForm`): paso actual, error del
 * paso, campo inválido a enfocar, detección de cambios sin guardar y envío. Sin `actividad` registra una nueva
 * («Nueva actividad»); con ella edita una pendiente desde el diálogo de detalle.
 */
export function useActividadForm({ actividad }: UseActividadFormOptions = {}) {
  const isEdit = actividad !== undefined;
  const [initial] = useState(() => {
    const base = actividad ? actividadAFormValue(actividad) : estadoInicial();
    return { base, snapshot: JSON.stringify(base) };
  });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<ActividadCampo | null>(null);
  const [value, setValueRaw] = useState<ActividadFormValue>(initial.base);
  const registrar = useRegistrarActividadPreventiva();
  const actualizar = useActualizarActividadPreventiva();
  // Nombres de catálogo para reflejar la edición al instante (en alta no se piden aquí).
  const tiposQuery = useTiposActividad(isEdit);
  const empleadosQuery = useEmpleadosParticipantes(isEdit);

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
    ): Promise<ActividadGuardada | null> => {
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
      if (!actividad) {
        await registrar.mutateAsync(input);
        return { input, actualizada: null };
      }

      const cambio = { ...input, actividadId: actividad.id, actualizadoEn: actividad.actualizadoEn ?? '' };
      const invalido = validateActividadActualizar(cambio);
      if (invalido) throw new Error(invalido);
      const tipo = tiposQuery.data?.find((t) => t.id === input.tipoActividadId);
      const vista: ActividadEdicionVista = {
        tipoActividadClave: tipo?.clave ?? actividad.tipoActividadClave,
        tipoActividadNombre: tipo?.nombre ?? actividad.tipoActividadNombre,
        asentamientoNombre: value.colonia?.nombre ?? null,
        codigoPostal: value.colonia?.codigoPostal || null,
        municipio: value.colonia?.municipio || null,
        participantes: (input.participantesIds ?? []).flatMap((id) => {
          const conocido = actividad.participantes.find((p) => p.empleadoId === id);
          if (conocido) return [conocido];
          const empleado = empleadosQuery.data?.find((e) => e.id === id);
          return empleado ? [{ empleadoId: empleado.id, nombre: empleado.nombre, rol: empleado.rol }] : [];
        }),
      };
      const result = await actualizar.mutateAsync({ input: cambio, vista });
      return { input, actualizada: aplicarEdicionActividad(actividad, input, vista, result.actualizadoEn) };
    },
    [validateStep, value, registrar, actualizar, actividad, tiposQuery.data, empleadosQuery.data],
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
    isSubmitting: registrar.isPending || actualizar.isPending,
    isEdit,
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
