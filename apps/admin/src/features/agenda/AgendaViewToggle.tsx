import { useEffect, useRef } from 'react';
import { useTabs } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';

export type AgendaView = 'mes' | 'semana';

const VIEWS = [
  { value: 'mes', label: 'Mes', icon: 'calendar_view_month' },
  { value: 'semana', label: 'Semana', icon: 'calendar_view_week' },
] as const satisfies readonly { value: AgendaView; label: string; icon: string }[];

interface AgendaViewToggleProps {
  value: AgendaView;
  onChange: (view: AgendaView) => void;
}

/** Control segmentado Mes / Semana solo con íconos (cuadrícula / columnas); el indicador del kit se desliza. */
export function AgendaViewToggle({ value, onChange }: AgendaViewToggleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tabs = useTabs(ref, { onSelect: (index) => onChange(VIEWS[index].value) });

  useEffect(() => {
    const index = VIEWS.findIndex((view) => view.value === value);
    if (tabs.current && index >= 0 && tabs.current.index !== index) tabs.current.select(index);
  }, [value, tabs]);

  return (
    <div ref={ref} className="mk-segmented ag-view-toggle" role="tablist" aria-label="Vista de la agenda">
      {VIEWS.map((view) => (
        <button
          key={view.value}
          type="button"
          role="tab"
          data-mk-tab
          aria-selected={view.value === value}
          title={view.label}
          aria-label={view.label}
        >
          <Icon name={view.icon} className="text-[20px]" />
        </button>
      ))}
      <span data-mk-indicator="" />
    </div>
  );
}
