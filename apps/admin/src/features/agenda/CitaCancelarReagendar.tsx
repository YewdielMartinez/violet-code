import { useId, type FormEvent } from 'react';
import { DateTimePicker } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/date-time-picker';
import '@yewdiel21/motion-kit/css/components/range-calendar';
import '@yewdiel21/motion-kit/css/components/time-field';
import '@yewdiel21/motion-kit/css/components/popover';
import { Icon } from '@/shared/ui/Icon';

const TEXTAREA_CLASS =
  'w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60';

interface PanelBase {
  /** Id del `<form>`: el botón de envío del pie del diálogo lo referencia con el atributo `form`. */
  formId: string;
  motivo: string;
  onMotivoChange: (value: string) => void;
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

/** Cancelar: el motivo es opcional (decisión de negocio), la cancelación nunca se bloquea por dejarlo vacío. */
export function CancelarPanel({ formId, motivo, onMotivoChange, onSubmit, disabled, error }: PanelBase) {
  const motivoId = useId();
  return (
    <form id={formId} noValidate onSubmit={submitHandler(onSubmit)} className="vc-cita-panel grid gap-3" aria-label="Cancelar cita">
      <p className="flex items-start gap-2 rounded-2xl bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
        <Icon name="cancel" className="mt-0.5 shrink-0" />
        <span>La cita quedará cancelada. Esta acción no se puede deshacer.</span>
      </p>
      <div className="grid gap-1.5">
        <label htmlFor={motivoId} className="text-sm font-medium text-on-surface">
          Motivo de cancelación (opcional)
        </label>
        <textarea
          id={motivoId}
          rows={3}
          maxLength={500}
          disabled={disabled}
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          placeholder="¿Por qué se cancela? Puedes dejarlo vacío."
          className={TEXTAREA_CLASS}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-status-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

interface ReagendarPanelProps extends PanelBase {
  cuando: Date | null;
  onCuandoChange: (value: Date | null) => void;
}

/** Reagendar: crea una cita nueva ligada a la original (`reagendada_de`); el motivo es opcional. */
export function ReagendarPanel({
  formId,
  motivo,
  onMotivoChange,
  onSubmit,
  disabled,
  error,
  cuando,
  onCuandoChange,
}: ReagendarPanelProps) {
  const motivoId = useId();
  return (
    <form id={formId} noValidate onSubmit={submitHandler(onSubmit)} className="vc-cita-panel grid gap-4" aria-label="Reagendar cita">
      <p className="flex items-start gap-2 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        <Icon name="event_repeat" className="mt-0.5 shrink-0 text-primary" />
        <span>La cita actual quedará como «Reagendada» y se creará una nueva con la persona, área y prioridad actuales.</span>
      </p>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-on-surface">Nueva fecha y hora *</span>
        <DateTimePicker
          label="Nueva fecha y hora"
          value={cuando}
          minuteStep={15}
          hourCycle={24}
          locale="es-MX"
          disabled={disabled}
          onChange={onCuandoChange}
        />
        <p className="text-xs text-on-surface-variant">Hora de Mazatlán.</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={motivoId} className="text-sm font-medium text-on-surface">
          Motivo (opcional)
        </label>
        <textarea
          id={motivoId}
          rows={2}
          maxLength={500}
          disabled={disabled}
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          className={TEXTAREA_CLASS}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-status-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
