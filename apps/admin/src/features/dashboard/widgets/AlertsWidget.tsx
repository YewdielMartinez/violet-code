import { useRef, useState } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { Icon } from '@/shared/ui/Icon';
import { useAlerts, type EstadoAlerta, type OrigenAlerta } from '../api';
import { relativeTime } from './format';
import { PriorityBadge, WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const FILTERS: { value: EstadoAlerta | undefined; label: string }[] = [
  { value: undefined, label: 'Activas' },
  { value: 'nueva', label: 'Nuevas' },
  { value: 'tomada', label: 'Tomadas' },
];

const CHANNEL_LABEL: Record<OrigenAlerta, string> = {
  app_movil: 'App móvil',
  telefono: 'Teléfono',
  presencial: 'Presencial',
};

const CHANNEL_ICON: Record<OrigenAlerta, string> = {
  app_movil: 'sos',
  telefono: 'call',
  presencial: 'directions_walk',
};

/** Bandeja de alertas: prioridad alta arriba, ordenadas por antigüedad reciente. */
export function AlertsWidget() {
  const [estado, setEstado] = useState<EstadoAlerta | undefined>(undefined);
  const { data, isLoading, isError } = useAlerts(estado);
  const listRef = useRef<HTMLUListElement>(null);
  const signature = data?.map((a) => a.id).join(',') ?? '';

  return (
    <WidgetCard title="Alertas por atender" action={{ label: 'Ver todas', to: '/solicitudes' }}>
      <div role="group" aria-label="Filtrar alertas" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={estado === f.value}
            onClick={() => setEstado(f.value)}
            className={`mk-chip mk-chip--filter ${estado === f.value ? 'bg-secondary-container text-on-secondary-container' : ''}`}
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
              <li
                key={a.id}
                data-flip-id={a.id}
                className="flex items-center gap-4 rounded-2xl bg-surface-container-low px-4 py-3"
              >
                <span
                  aria-hidden
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    a.prioridad === 'alta'
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <Icon name={CHANNEL_ICON[a.origen]} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
                    {a.usuariaNombre ?? 'Alerta registrada'}
                    <PriorityBadge value={a.prioridad} />
                  </p>
                  <p className="truncate text-sm text-on-surface-variant">
                    {a.asentamiento ?? 'Ubicación reservada'} · {CHANNEL_LABEL[a.origen]}
                    {a.atendidaPorNombre ? ` · ${a.atendidaPorNombre}` : ' · Sin asignar'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-on-surface-variant">{relativeTime(a.creadoEn)}</span>
              </li>
            ))}
          </ul>
        </FlipGroup>
      )}
    </WidgetCard>
  );
}
