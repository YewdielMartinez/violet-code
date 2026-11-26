import { useRef, useState } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { useCasesToReview, type EstadoFicha } from '../api';
import { relativeTime } from './format';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const ESTADO_META: Record<EstadoFicha, { label: string; className: string }> = {
  abierto: { label: 'Abierto', className: 'bg-status-info-bg text-status-info' },
  en_seguimiento: { label: 'En seguimiento', className: 'bg-status-warning-bg text-status-warning' },
  cerrado: { label: 'Cerrado', className: 'bg-status-success-bg text-status-success' },
  archivado: { label: 'Archivado', className: 'bg-surface-container-high text-on-surface-variant' },
};

/**
 * Privacidad operacional (LGPDPPSO): en el Dashboard los expedientes se identifican
 * únicamente por folio, estado y prioridad para no exponer nombres en pantallas abiertas;
 * los datos nominales se consultan al abrir el expediente autorizado.
 */
export function CasesWidget({ userId, defaultMine }: { userId: string; defaultMine: boolean }) {
  const [mine, setMine] = useState(defaultMine);
  const { data, isLoading, isError } = useCasesToReview(mine, userId);
  const listRef = useRef<HTMLUListElement>(null);
  const signature = data?.map((c) => c.id).join(',') ?? '';

  return (
    <WidgetCard title="Expedientes en curso" action={{ label: 'Ver expedientes', to: '/expedientes' }}>
      <label className="mb-4 flex w-fit items-center gap-3 text-sm text-on-surface-variant">
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
        <WidgetLoading />
      ) : isError || !data?.length ? (
        <WidgetEmpty
          error={isError}
          title="Sin expedientes pendientes por ahora."
          action={{ label: 'Ir a expedientes', to: '/expedientes' }}
        />
      ) : (
        <FlipGroup root={listRef} signature={signature}>
          <ul ref={listRef} className="grid gap-2">
            {data.map((c) => {
              const estado = ESTADO_META[c.estado];
              return (
                <li
                  key={c.id}
                  data-flip-id={c.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
                      <span className="font-mono">{c.folio}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.className}`}>
                        {estado.label}
                      </span>
                    </p>
                    <p className="truncate text-sm text-on-surface-variant">
                      Actualizado {relativeTime(c.actualizadoEn)}
                    </p>
                  </div>
                  {c.enListaUrgencias && (
                    <span className="rounded-full bg-status-danger-bg px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-status-danger">
                      Prioritario
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </FlipGroup>
      )}
    </WidgetCard>
  );
}
