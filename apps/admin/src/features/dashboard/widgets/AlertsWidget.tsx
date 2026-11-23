import { useRef, useState } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';
import { useAlerts, type AlertStatus } from '../api';
import { relativeTime } from './format';
import { PriorityBadge, WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const FILTERS: { value: AlertStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Activas' },
  { value: 'New', label: 'Nuevas' },
  { value: 'InProgress', label: 'En atención' },
];

const CHANNEL: Record<string, string> = { App: 'App móvil', Phone: 'Teléfono', WalkIn: 'Presencial' };

/** Bandeja de alertas: lo más urgente arriba (prioridad, luego antigüedad). */
export function AlertsWidget() {
  const [status, setStatus] = useState<AlertStatus | undefined>(undefined);
  const { data, isLoading, isError } = useAlerts(status);
  const listRef = useRef<HTMLUListElement>(null);
  // Cambia cuando cambia lo que se ve: FlipGroup (motion-kit) lleva cada fila a su nuevo lugar
  // y hace aparecer las nuevas.
  const signature = data?.map((a) => a.id).join(',') ?? '';

  return (
    <WidgetCard title="Alertas por atender" action={{ label: 'Ver todas', to: '/solicitudes' }}>
      <div role="group" aria-label="Filtrar alertas" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={`mk-chip mk-chip--filter ${status === f.value ? 'bg-secondary-container text-on-secondary-container' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <WidgetLoading />
      ) : isError || !data?.length ? (
        <WidgetEmpty error={isError} title="Sin alertas pendientes" />
      ) : (
        <FlipGroup root={listRef} signature={signature}>
        <ul ref={listRef} className="grid gap-2">
          {data.map((a) => (
            <li key={a.id} data-flip-id={a.id} className="flex items-center gap-4 rounded-2xl bg-surface-container-low px-4 py-3">
              <span
                aria-hidden
                className={`grid size-10 shrink-0 place-items-center rounded-full ${
                  a.priority === 'High' ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <Icon name={a.channel === 'App' ? 'sos' : a.channel === 'Phone' ? 'call' : 'directions_walk'} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
                  {a.folio}
                  <PriorityBadge value={a.priority} />
                </p>
                <p className="truncate text-sm text-on-surface-variant">
                  {a.colonia} · {CHANNEL[a.channel] ?? a.channel}
                  {a.assignedToName ? ` · ${a.assignedToName}` : ' · Sin asignar'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-on-surface-variant">{relativeTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
        </FlipGroup>
      )}
    </WidgetCard>
  );
}
