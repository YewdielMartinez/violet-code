import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { useAlerts, type AlertaItem, type EstadoAlerta, type OrigenAlerta } from '../api';
import { relativeTime } from './format';
import { FitList, type FitListRenderContext } from './FitList';
import { PriorityBadge, WidgetCard, WidgetEmpty, WidgetSkeleton } from './shared';

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

/** Alto fijo de cada fila (px): la capacidad de la lista se calcula con él. */
const ROW_HEIGHT = 56;
/** Alto de la fila de filtros + separación (px), para estimar antes de medir. */
const FILTERS_HEIGHT = 44;

const getKey = (a: AlertaItem) => a.id;
const MORE = { label: 'ver todas', to: '/solicitudes' };

function AlertRow({ a, ctx }: { a: AlertaItem; ctx: FitListRenderContext }) {
  const { compact } = ctx;
  return (
    <div className="flex h-full items-center gap-3 rounded-2xl bg-surface-container-low px-3">
      {compact ? null : (
        <span
          aria-hidden
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            a.prioridad === 'alta'
              ? 'bg-status-danger-bg text-status-danger'
              : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          <Icon name={CHANNEL_ICON[a.origen]} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-on-surface">
          <span className="truncate">Alerta #{a.id.slice(0, 8).toUpperCase()}</span>
          <PriorityBadge value={a.prioridad} short={compact} />
        </p>
        <p className="truncate text-xs text-on-surface-variant">
          {a.asentamiento ?? 'Ubicación reservada'} · {CHANNEL_LABEL[a.origen]}
          {compact ? '' : a.atendidaPorNombre ? ` · Atiende: ${a.atendidaPorNombre}` : ' · Sin asignar'}
        </p>
      </div>
      <span className="shrink-0 text-xs text-on-surface-variant">{relativeTime(a.creadoEn)}</span>
    </div>
  );
}

/**
 * Privacidad operacional (LGPDPPSO): la pantalla de inicio suele permanecer visible en
 * monitores de escritorio; por eso las alertas muestran ID, asentamiento, canal y quién
 * atiende, reservando el nombre completo de la usuaria para el detalle autorizado.
 * La lista muestra tantas filas/columnas como caben en la celda.
 */
export function AlertsWidget() {
  const [estado, setEstado] = useState<EstadoAlerta | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useAlerts(estado);

  return (
    <WidgetCard
      title="Alertas por atender"
      icon="notifications_active"
      subtitle={data ? `${data.length} en la bandeja` : undefined}
      action={{ label: 'Ver todas', to: '/solicitudes' }}
    >
      <div role="group" aria-label="Filtrar alertas" className="mb-3 flex shrink-0 flex-wrap gap-2">
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
        <WidgetSkeleton />
      ) : isError ? (
        <WidgetEmpty error title="" onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <WidgetEmpty icon="task_alt" title="Sin alertas pendientes" description="Todo al día en esta bandeja." />
      ) : (
        <FitList
          label="Alertas por atender"
          items={data}
          getKey={getKey}
          rowHeight={ROW_HEIGHT}
          reserve={FILTERS_HEIGHT}
          more={MORE}
          renderItem={(a, ctx) => <AlertRow a={a} ctx={ctx} />}
        />
      )}
    </WidgetCard>
  );
}
