import { Popover } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/popover';
import { Icon } from './Icon';
import { toolbarPillClass } from './Toolbar';
import './vc-ui.css';

export interface ToolbarDateRangeProps {
  /** `YYYY-MM-DD` o vacío. */
  desde: string;
  hasta: string;
  onChange: (range: { desde: string; hasta: string }) => void;
  /** Nombre de la píldora y del panel («Fechas»). */
  label?: string;
}

const SHORT_FMT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function corto(day: string): string {
  // Mediodía local: el día no cambia aunque la zona del navegador difiera.
  return SHORT_FMT.format(new Date(`${day}T12:00:00`)).replace('.', '');
}

function resumen(desde: string, hasta: string): string | null {
  if (desde && hasta) return `${corto(desde)} – ${corto(hasta)}`;
  if (desde) return `Desde ${corto(desde)}`;
  if (hasta) return `Hasta ${corto(hasta)}`;
  return null;
}

/** Píldora «Fechas» de la barra: abre un popover del kit con dos campos de fecha (desde / hasta). */
export function ToolbarDateRange({ desde, hasta, onChange, label = 'Fechas' }: ToolbarDateRangeProps) {
  const summary = resumen(desde, hasta);
  const active = summary !== null;

  return (
    <Popover
      label={label}
      placement="bottom-end"
      trigger={
        <button
          type="button"
          className={toolbarPillClass(active)}
          aria-label={summary ? `${label}: ${summary}` : label}
          data-active={active || undefined}
        >
          <Icon name="event" className="text-[18px]" />
          <span>{summary ?? label}</span>
        </button>
      }
    >
      <div className="vc-daterange">
        <label className="vc-daterange__field">
          Desde
          <input
            type="date"
            className="vc-daterange__input"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => onChange({ desde: e.target.value, hasta })}
          />
        </label>
        <label className="vc-daterange__field">
          Hasta
          <input
            type="date"
            className="vc-daterange__input"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => onChange({ desde, hasta: e.target.value })}
          />
        </label>
        {active ? (
          <button type="button" className="mk-button mk-button--text vc-press" onClick={() => onChange({ desde: '', hasta: '' })}>
            Quitar fechas
          </button>
        ) : null}
      </div>
    </Popover>
  );
}
