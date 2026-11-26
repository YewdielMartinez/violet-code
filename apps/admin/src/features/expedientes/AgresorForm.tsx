import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LoadingButton, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
import { Icon } from '@/shared/ui/Icon';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog';
import {
  useGuardarAgresor,
  validarAgresor,
  type Agresor,
  type AgresorInput,
  type AgresorValidationField,
  type AsentamientoOpcion,
  type CatalogoOpcion,
} from './agresorApi';
import { AgresorConsumoArmaFields, type ConsumoArmaValues } from './AgresorConsumoArmaFields';
import { AgresorDomicilioFields, type DomicilioValues } from './AgresorDomicilioFields';
import { AnimatedReveal } from './agresor/AnimatedReveal';
import { AgresorDialog, prefersReducedMotion } from './agresor/motionCompat';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const SUBMIT_LABELS = {
  loading: 'Guardando…',
  success: 'Guardado',
  error: 'Revisa los datos',
};

interface FormState extends DomicilioValues, ConsumoArmaValues {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  parentescoId: number | null;
  parentescoOtro: string;
  ocupacionId: number | null;
  ocupacionOtra: string;
}

function buildInitialState(initial?: Agresor | null): FormState {
  return {
    nombres: initial?.nombres ?? '',
    apellidoPaterno: initial?.apellidoPaterno ?? '',
    apellidoMaterno: initial?.apellidoMaterno ?? '',
    parentescoId: initial?.parentescoId ?? null,
    parentescoOtro: initial?.parentescoOtro ?? '',
    ocupacionId: initial?.ocupacionId ?? null,
    ocupacionOtra: initial?.ocupacionOtra ?? '',
    asentamientoId: initial?.asentamientoId ?? null,
    codigoPostal: initial?.codigoPostal ?? '',
    calle: initial?.calle ?? '',
    numeroExterior: initial?.numeroExterior ?? '',
    numeroInterior: initial?.numeroInterior ?? '',
    referencias: initial?.referencias ?? '',
    tieneConsumoDroga: initial?.tieneConsumoDroga ?? null,
    drogas: initial?.drogas ?? [],
    especificacionDroga: initial?.especificacionDroga ?? '',
    utilizoArmaUObjeto: initial?.utilizoArmaUObjeto ?? null,
    especificacionArma: initial?.especificacionArma ?? '',
    observaciones: initial?.observaciones ?? '',
  };
}

interface Props {
  fichaId: string;
  initial?: Agresor | null;
  parentescos: CatalogoOpcion[];
  ocupaciones: CatalogoOpcion[];
  asentamientos: AsentamientoOpcion[];
  onCancel: () => void;
  onSaved: () => void;
}

export function AgresorForm({
  fichaId,
  initial,
  parentescos,
  ocupaciones,
  asentamientos,
  onCancel,
  onSaved,
}: Props) {
  const isEditing = Boolean(initial);
  const saveMutation = useGuardarAgresor(fichaId);
  const initialSnapshot = useMemo(() => buildInitialState(initial), [initial]);
  const [form, setForm] = useState<FormState>(() => initialSnapshot);
  const [saved, setSaved] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<AgresorValidationField, string>>>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const isDirty = useMemo(
    () => !saved && JSON.stringify(form) !== JSON.stringify(initialSnapshot),
    [saved, form, initialSnapshot],
  );
  const blocker = useUnsavedChangesGuard(isDirty);

  const patchForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const parentescoOptions = useMemo(
    () => [
      { value: '', label: 'Sin especificar' },
      ...parentescos.map((i) => ({ value: String(i.id), label: i.nombre })),
    ],
    [parentescos],
  );
  const ocupacionOptions = useMemo(
    () => [
      { value: '', label: 'Sin especificar' },
      ...ocupaciones.map((i) => ({ value: String(i.id), label: i.nombre })),
    ],
    [ocupaciones],
  );

  const selectedParentesco = parentescos.find((p) => p.id === form.parentescoId);
  const selectedOcupacion = ocupaciones.find((o) => o.id === form.ocupacionId);
  const mostrarParentescoOtro = selectedParentesco?.clave === 'otro';
  const mostrarOcupacionOtra = selectedOcupacion?.clave === 'otra';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitState === 'loading') return;

    const input: AgresorInput = {
      fichaId,
      ...form,
      parentescoOtro: mostrarParentescoOtro ? form.parentescoOtro : null,
      ocupacionOtra: mostrarOcupacionOtra ? form.ocupacionOtra : null,
      codigoPostal: form.asentamientoId !== null ? null : form.codigoPostal,
      drogas: form.tieneConsumoDroga === true ? form.drogas : null,
      especificacionDroga: form.tieneConsumoDroga === true ? form.especificacionDroga : null,
      utilizoArmaUObjeto: form.utilizoArmaUObjeto,
      especificacionArma: form.utilizoArmaUObjeto === true ? form.especificacionArma : null,
      actualizadoEnEsperado: initial?.actualizadoEn,
    };

    const validation = validarAgresor(input);
    if (!validation.valido) {
      setErrores(validation.errores);
      setSubmitState('error');
      toast('Revisa los campos marcados antes de guardar.', { tone: 'error' });
      return;
    }

    setErrores({});
    setSubmitState('loading');
    try {
      await saveMutation.mutateAsync({ id: initial?.id, input });
      setSaved(true);
      setSubmitState('success');
      toast(isEditing ? 'Persona agresora actualizada.' : 'Persona agresora registrada.', {
        tone: 'success',
      });
      const delay = prefersReducedMotion() ? 0 : 550;
      if (delay === 0) {
        onSaved();
      } else {
        savedTimerRef.current = window.setTimeout(() => onSaved(), delay);
      }
    } catch (err) {
      setSubmitState('error');
      toast(err instanceof Error ? err.message : 'No se pudo guardar el registro.', {
        tone: 'error',
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="contents" noValidate>
      <AgresorDialog.Body>
        <div className="grid gap-4">
          <fieldset className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Identificación y vínculo
            </legend>

            <div className="grid gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-on-surface-variant">Nombre(s) *</label>
              <label className="mk-field">
                <input
                  type="text"
                  maxLength={100}
                  required
                  autoFocus
                  value={form.nombres}
                  aria-invalid={errores.nombres ? true : undefined}
                  onChange={(e) => patchForm({ nombres: e.target.value })}
                  placeholder="Nombre(s) de la persona agresora"
                />
              </label>
              {errores.nombres ? (
                <p role="alert" className="text-xs text-status-danger">{errores.nombres}</p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium text-on-surface-variant">Apellido paterno</label>
              <label className="mk-field">
                <input
                  type="text"
                  maxLength={100}
                  value={form.apellidoPaterno}
                  onChange={(e) => patchForm({ apellidoPaterno: e.target.value })}
                />
              </label>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium text-on-surface-variant">Apellido materno</label>
              <label className="mk-field">
                <input
                  type="text"
                  maxLength={100}
                  value={form.apellidoMaterno}
                  onChange={(e) => patchForm({ apellidoMaterno: e.target.value })}
                />
              </label>
            </div>

            <div className="grid gap-1">
              <span className="text-xs font-medium text-on-surface-variant">
                Parentesco con la usuaria
              </span>
              <Select
                label="Parentesco"
                options={parentescoOptions}
                value={form.parentescoId ? String(form.parentescoId) : ''}
                onChange={(val) => patchForm({ parentescoId: val ? Number(val) : null })}
              />
            </div>

            <div className="grid gap-1">
              <span className="text-xs font-medium text-on-surface-variant">Ocupación</span>
              <Select
                label="Ocupación"
                options={ocupacionOptions}
                value={form.ocupacionId ? String(form.ocupacionId) : ''}
                onChange={(val) => patchForm({ ocupacionId: val ? Number(val) : null })}
              />
            </div>

            <AnimatedReveal show={mostrarParentescoOtro} className="sm:col-span-2">
              <div className="grid gap-1 pt-1">
                <label className="text-xs font-medium text-on-surface-variant">
                  Especifica el parentesco
                </label>
                <label className="mk-field">
                  <input
                    type="text"
                    maxLength={120}
                    value={form.parentescoOtro}
                    onChange={(e) => patchForm({ parentescoOtro: e.target.value })}
                  />
                </label>
              </div>
            </AnimatedReveal>

            <AnimatedReveal show={mostrarOcupacionOtra} className="sm:col-span-2">
              <div className="grid gap-1 pt-1">
                <label className="text-xs font-medium text-on-surface-variant">
                  Especifica la ocupación
                </label>
                <label className="mk-field">
                  <input
                    type="text"
                    maxLength={150}
                    value={form.ocupacionOtra}
                    onChange={(e) => patchForm({ ocupacionOtra: e.target.value })}
                  />
                </label>
              </div>
            </AnimatedReveal>
          </fieldset>

          <AgresorDomicilioFields
            asentamientos={asentamientos}
            values={form}
            errores={errores}
            onPatch={patchForm}
          />
          <AgresorConsumoArmaFields values={form} errores={errores} onPatch={patchForm} />
        </div>
      </AgresorDialog.Body>

      <AgresorDialog.Footer>
        <button
          type="button"
          className="mk-button mk-button--text"
          disabled={submitState === 'loading'}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <LoadingButton
          type="submit"
          state={submitState}
          compact={false}
          resetAfter={1600}
          labels={SUBMIT_LABELS}
          onStateChange={(next) => {
            if (next === 'idle') setSubmitState('idle');
          }}
          className="mk-button mk-button--primary"
        >
          <Icon name="save" />
          <span>{isEditing ? 'Guardar cambios' : 'Registrar persona agresora'}</span>
        </LoadingButton>
      </AgresorDialog.Footer>
      <UnsavedChangesDialog blocker={blocker} />
    </form>
  );
}
