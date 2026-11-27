import { useId, type FormEvent } from 'react';
import { ASISTENTES_MAX, MOTIVO_CANCELACION_MAX, OBSERVACIONES_CIERRE_MAX } from '@/domain/models/ActividadEstado';
import { Icon } from '@/shared/ui/Icon';

const TEXTAREA_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60';
const INPUT_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-status-danger sm:max-w-48';

interface PanelBase {
  /** Id del `<form>`: el botón de envío del pie del diálogo lo referencia con el atributo `form`. */
  formId: string;
  onSubmit: () => void;
  disabled?: boolean;
  error?: string | null;
}

function submitHandler(onSubmit: () => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
}

function ErrorLine({ error }: { error?: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-status-danger">
      {error}
    </p>
  ) : null;
}

export interface RealizarPanelProps extends PanelBase {
  asistentes: string;
  onAsistentesChange: (value: string) => void;
  observaciones: string;
  onObservacionesChange: (value: string) => void;
}

/** Marcar como realizada: asistentes reales y observaciones de cierre (ambos opcionales). */
export function RealizarPanel({
  formId,
  onSubmit,
  disabled,
  error,
  asistentes,
  onAsistentesChange,
  observaciones,
  onObservacionesChange,
}: RealizarPanelProps) {
  const asistentesId = useId();
  const observacionesId = useId();
  return (
    <form id={formId} noValidate onSubmit={submitHandler(onSubmit)} className="vc-panel grid gap-4" aria-label="Marcar actividad como realizada">
      <p className="flex items-start gap-2 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        <Icon name="task_alt" className="mt-0.5 shrink-0 text-primary" />
        <span>La actividad quedará como «Realizada». Puedes reabrirla si fue un error.</span>
      </p>
      <div className="grid gap-1.5">
        <label htmlFor={asistentesId} className="text-sm font-medium text-on-surface">
          Asistentes (opcional)
        </label>
        <input
          id={asistentesId}
          type="number"
          inputMode="numeric"
          min={0}
          max={ASISTENTES_MAX}
          step={1}
          disabled={disabled}
          value={asistentes}
          onChange={(e) => onAsistentesChange(e.target.value)}
          className={INPUT_CLASS}
        />
        <p className="text-xs text-on-surface-variant">Cuántas personas asistieron realmente.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={observacionesId} className="text-sm font-medium text-on-surface">
          Observaciones de cierre (opcional)
        </label>
        <textarea
          id={observacionesId}
          rows={3}
          maxLength={OBSERVACIONES_CIERRE_MAX}
          disabled={disabled}
          value={observaciones}
          onChange={(e) => onObservacionesChange(e.target.value)}
          placeholder="Cómo salió, acuerdos, pendientes…"
          className={TEXTAREA_CLASS}
        />
      </div>
      <ErrorLine error={error} />
    </form>
  );
}

export interface CancelarActividadPanelProps extends PanelBase {
  motivo: string;
  onMotivoChange: (value: string) => void;
}

/** Cancelar: el motivo es opcional; la cancelación nunca se bloquea por dejarlo vacío y se puede reabrir. */
export function CancelarActividadPanel({ formId, onSubmit, disabled, error, motivo, onMotivoChange }: CancelarActividadPanelProps) {
  const motivoId = useId();
  return (
    <form id={formId} noValidate onSubmit={submitHandler(onSubmit)} className="vc-panel grid gap-3" aria-label="Cancelar actividad">
      <p className="flex items-start gap-2 rounded-2xl bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
        <Icon name="cancel" className="mt-0.5 shrink-0" />
        <span>La actividad quedará cancelada. Podrás reabrirla si se reprograma.</span>
      </p>
      <div className="grid gap-1.5">
        <label htmlFor={motivoId} className="text-sm font-medium text-on-surface">
          Motivo de cancelación (opcional)
        </label>
        <textarea
          id={motivoId}
          rows={3}
          maxLength={MOTIVO_CANCELACION_MAX}
          disabled={disabled}
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          placeholder="¿Por qué se cancela? Puedes dejarlo vacío."
          className={TEXTAREA_CLASS}
        />
      </div>
      <ErrorLine error={error} />
    </form>
  );
}
