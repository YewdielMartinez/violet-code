import { useState } from 'react';
import { useCasesToReview, type CaseItem, type EstadoFicha } from '../api';
import { relativeTime } from './format';
import { FitList } from './FitList';
import { WidgetCard, WidgetEmpty, WidgetSkeleton } from './shared';

const ESTADO_META: Record<EstadoFicha, { label: string; className: string }> = {
  abierto: { label: 'Abierto', className: 'bg-status-info-bg text-status-info' },
  en_seguimiento: { label: 'En seguimiento', className: 'bg-status-warning-bg text-status-warning' },
  cerrado: { label: 'Cerrado', className: 'bg-status-success-bg text-status-success' },
  archivado: { label: 'Archivado', className: 'bg-surface-container-high text-on-surface-variant' },
};

const ROW_HEIGHT = 52;
/** Alto del interruptor «Solo los creados por mí» + separación (px). */
const SWITCH_HEIGHT = 36;
const getKey = (c: CaseItem) => c.id;
const MORE = { label: 'ver expedientes', to: '/expedientes' };

function CaseRow({ c }: { c: CaseItem }) {
  const estado = ESTADO_META[c.estado];
  return (
    <div className="flex h-full items-center gap-3 rounded-2xl bg-surface-container-low px-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-on-surface">
          <span className="truncate font-mono">{c.folio}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${estado.className}`}>
            {estado.label}
          </span>
        </p>
        <p className="truncate text-xs text-on-surface-variant">Actualizado {relativeTime(c.actualizadoEn)}</p>
      </div>
      {c.enListaUrgencias && (
        <span className="rounded-full bg-status-danger-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-status-danger">
          Urgente
        </span>
      )}
    </div>
  );
}

/**
 * Privacidad operacional (LGPDPPSO): en el Dashboard los expedientes se identifican
 * únicamente por folio, estado y urgencia para no exponer nombres en pantallas abiertas;
 * los datos nominales se consultan al abrir el expediente autorizado.
 */
export function CasesWidget({ userId, defaultMine }: { userId: string; defaultMine: boolean }) {
  const [mine, setMine] = useState(defaultMine);
  const { data, isLoading, isError, refetch } = useCasesToReview(mine, userId);

  return (
    <WidgetCard
      title="Expedientes en curso"
      icon="folder_shared"
      subtitle={data ? `${data.length} en la lista` : undefined}
      action={{ label: 'Ver expedientes', to: '/expedientes' }}
    >
      <label className="mb-3 flex w-fit shrink-0 items-center gap-3 text-sm text-on-surface-variant">
        <input
          type="checkbox"
          role="switch"
          className="mk-switch"
          checked={mine}
          onChange={(e) => setMine(e.target.checked)}
        />
        Solo los creados por mí
      </label>

      {isLoading ? (
        <WidgetSkeleton />
      ) : isError ? (
        <WidgetEmpty error title="" onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <WidgetEmpty
          icon="folder_open"
          title="Sin expedientes pendientes"
          description="Los casos abiertos o en seguimiento aparecerán aquí."
          action={{ label: 'Ir a expedientes', to: '/expedientes' }}
        />
      ) : (
        <FitList
          label="Expedientes en curso"
          items={data}
          getKey={getKey}
          rowHeight={ROW_HEIGHT}
          reserve={SWITCH_HEIGHT}
          more={MORE}
          renderItem={(c) => <CaseRow c={c} />}
        />
      )}
    </WidgetCard>
  );
}
