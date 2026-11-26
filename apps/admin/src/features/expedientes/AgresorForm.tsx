import { useMemo, useState, type FormEvent } from 'react';
import { LoadingButton, Select, toast } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/loading-button';
import '@yewdiel21/motion-kit/css/components/select';
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
    tipoArma: initial?.tipoArma ?? null,
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

  const isDirty = useMemo(
    () => !saved && JSON.stringify(form) !== JSON.stringify(initialSnapshot),
    [saved, form, initialSnapshot],
  );
  const blocker = useUnsavedChangesGuard(isDirty);

  const patchForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const parentescoOptions = useMemo(
    () => [{ value: '', label: 'Sin especificar' }, ...parentescos.map((i) => ({ value: String(i.id), label: i.nombre }))],
    [parentescos],
  );
  const ocupacionOptions = useMemo(
    () => [{ value: '', label: 'Sin especificar' }, ...ocupaciones.map((i) => ({ value: String(i.id), label: i.nombre }))],
    [ocupaciones],
  );

  const selectedParentesco = parentescos.find((p) => p.id === form.parentescoId);
  const selectedOcupacion = ocupaciones.find((o) => o.id === form.ocupacionId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: AgresorInput = {
      fichaId,
      ...form,
      parentescoOtro: selectedParentesco?.clave === 'otro' ? form.parentescoOtro : null,
      ocupacionOtra: selectedOcupacion?.clave === 'otra' ? form.ocupacionOtra : null,
      codigoPostal: form.asentamientoId !== null ? null : form.codigoPostal,
      drogas: form.tieneConsumoDroga === true ? form.drogas : null,
      especificacionDroga: form.tieneConsumoDroga === true ? form.especificacionDroga : null,
      tipoArma: form.utilizoArmaUObjeto === true ? form.tipoArma : null,
      especificacionArma: form.utilizoArmaUObjeto === true ? form.especificacionArma : null,
      actualizadoEnEsperado: initial?.actualizadoEn,
    };

    const validation = validarAgresor(input);
    if (!validation.valido) {
      setErrores(validation.errores);
      toast('Revisa los campos marcados antes de guardar.', { tone: 'error' });
      return;
    }

    setErrores({});
    try {
      await saveMutation.mutateAsync({ id: initial?.id, input });
      setSaved(true);
      toast(isEditing ? 'Persona agresora actualizada.' : 'Persona agresora registrada.', { tone: 'success' });
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar el registro.', { tone: 'error' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-on-surface">
          {isEditing ? 'Editar persona agresora' : 'Agregar persona agresora'}
        </h3>
        <button type="button" className="mk-button mk-button--text mk-button--sm" onClick={onCancel}>
          Volver al listado
        </button>
      </div>

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
              value={form.nombres}
              onChange={(e) => patchForm({ nombres: e.target.value })}
              placeholder="Nombre(s) de la persona agresora"
            />
          </label>
          {errores.nombres ? <p role="alert" className="text-xs text-status-danger">{errores.nombres}</p> : null}
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-on-surface-variant">Apellido paterno</label>
          <label className="mk-field">
            <input type="text" maxLength={100} value={form.apellidoPaterno} onChange={(e) => patchForm({ apellidoPaterno: e.target.value })} />
          </label>
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-on-surface-variant">Apellido materno</label>
          <label className="mk-field">
            <input type="text" maxLength={100} value={form.apellidoMaterno} onChange={(e) => patchForm({ apellidoMaterno: e.target.value })} />
          </label>
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-medium text-on-surface-variant">Parentesco con la usuaria</span>
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

        {selectedParentesco?.clave === 'otro' ? (
          <div className="grid gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-on-surface-variant">Especifica el parentesco</label>
            <label className="mk-field">
              <input type="text" maxLength={120} value={form.parentescoOtro} onChange={(e) => patchForm({ parentescoOtro: e.target.value })} />
            </label>
          </div>
        ) : null}

        {selectedOcupacion?.clave === 'otra' ? (
          <div className="grid gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-on-surface-variant">Especifica la ocupación</label>
            <label className="mk-field">
              <input type="text" maxLength={150} value={form.ocupacionOtra} onChange={(e) => patchForm({ ocupacionOtra: e.target.value })} />
            </label>
          </div>
        ) : null}
      </fieldset>

      <AgresorDomicilioFields asentamientos={asentamientos} values={form} errores={errores} onPatch={patchForm} />
      <AgresorConsumoArmaFields values={form} errores={errores} onPatch={patchForm} />

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" className="mk-button mk-button--text" onClick={onCancel}>Cancelar</button>
        <LoadingButton type="submit" state={saveMutation.isPending ? 'loading' : 'idle'} className="mk-button mk-button--filled">
          {isEditing ? 'Guardar cambios' : 'Registrar persona agresora'}
        </LoadingButton>
      </div>
      <UnsavedChangesDialog blocker={blocker} />
    </form>
  );
}
