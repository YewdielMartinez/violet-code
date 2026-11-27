import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, toast } from '@yewdiel21/motion-kit/react';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import { useAsentamientosSepomex } from '@/features/expedientes/api';
import type { DialogDir } from '@/shared/ui/DialogHeader';
import { Icon } from '@/shared/ui/Icon';
import { ActividadWizardStepper, ActividadWizardSteps } from './ActividadWizard';
import { mensajeError } from './actividadesList';
import { focusActividadField, useActividadForm } from './useActividadForm';

export interface ActividadEditarProps {
  actividad: ActividadPreventivaItem;
  dir: DialogDir;
  /** «Cancelar»: vuelve al detalle sin guardar (el diálogo pide confirmación si hay cambios). */
  onCancel: () => void;
  /** Cambios guardados: recibe la actividad ya actualizada para volver al detalle. */
  onSaved: (actividad: ActividadPreventivaItem) => void;
  /** Avisa al diálogo si hay cambios sin guardar (para confirmar antes de cerrarlo o volver). */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * Vista «Editar» del diálogo de Actividades: el mismo asistente del alta (`ActividadWizard`) precargado con los
 * valores actuales, dentro del diálogo de detalle. «Guardar cambios» está disponible en cualquier paso y valida
 * todos (las mismas reglas que el alta); si el servidor la rechaza se queda aquí con lo capturado.
 */
export function ActividadEditar({ actividad, dir, onCancel, onSaved, onDirtyChange }: ActividadEditarProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const pendingFocusFieldRef = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useActividadForm({ actividad });
  const { step, goToStep, goNext, goBack, submit, isDirty, isSubmitting } = form;

  const asentamientosQuery = useAsentamientosSepomex(undefined, step >= 1);
  const asentamientos = useMemo(() => asentamientosQuery.data ?? [], [asentamientosQuery.data]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function handleNext() {
    goNext((field) => focusActividadField(formRef.current, field));
  }

  function handleStepSelect(next: number) {
    if (next < step) goToStep(next);
    else if (next === step + 1) handleNext();
  }

  async function handleSave() {
    setSaveError(null);
    try {
      const saved = await submit((field, invalidStep) => {
        if (invalidStep === step) focusActividadField(formRef.current, field);
        else pendingFocusFieldRef.current = field;
      });
      if (!saved?.actualizada) return;
      toast('Cambios de la actividad guardados.', { tone: 'success' });
      onSaved(saved.actualizada);
    } catch (err) {
      const message = mensajeError(err, 'No se pudieron guardar los cambios.');
      setSaveError(message);
      toast(message, { tone: 'error' });
    }
  }

  return (
    <>
      <Dialog.Body className="vc-dlg-view" data-dir={dir}>
        <div ref={anchorRef} className="grid gap-5">
          <ActividadWizardStepper editing step={step} onSelectStep={handleStepSelect} />
          <ActividadWizardSteps
            editing
            formId={formId}
            formRef={formRef}
            scrollAnchorRef={anchorRef}
            step={step}
            stepError={form.stepError}
            invalidField={form.invalidField}
            value={form.value}
            onChange={form.setValue}
            asentamientos={asentamientos}
            asentamientosLoading={asentamientosQuery.isLoading}
            onNext={handleNext}
            onSubmit={() => {
              void handleSave();
            }}
            onStepAnimated={() => {
              if (!pendingFocusFieldRef.current) return;
              const target = pendingFocusFieldRef.current;
              pendingFocusFieldRef.current = null;
              focusActividadField(formRef.current, target);
            }}
          />
          {saveError ? (
            <p role="alert" className="vc-error">
              {saveError}
            </p>
          ) : null}
        </div>
      </Dialog.Body>

      <Dialog.Footer key="editar">
        <button key="cancelar" type="button" className="mk-button mk-button--text vc-press" disabled={isSubmitting} onClick={onCancel}>
          Cancelar
        </button>
        {step > 0 ? (
          <button key="atras" type="button" className="mk-button mk-button--tonal vc-press" disabled={isSubmitting} onClick={goBack}>
            <Icon name="arrow_back" />
            <span className="ml-1.5">Atrás</span>
          </button>
        ) : (
          <button key="siguiente" type="button" className="mk-button mk-button--tonal vc-press" disabled={isSubmitting} onClick={handleNext}>
            <span>Siguiente</span>
            <Icon name="arrow_forward" />
          </button>
        )}
        <button key="guardar" type="submit" form={formId} className="mk-button mk-button--filled vc-press" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </Dialog.Footer>
    </>
  );
}
