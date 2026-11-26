import { useRef, useState } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { useCasesToReview, type EstadoFicha } from '../api';
import { relativeTime } from './format';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const ESTADO_LABELS: Record<EstadoFicha, string> = {
  abierto: 'Abierto',
  en_seguimiento: 'En seguimiento',
  cerrado: 'Cerrado',
  archivado: 'Archivado',
};

/** Expedientes recientes en estado abierto o en seguimiento. */
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
        <WidgetEmpty error={isError} title="Sin expedientes pendientes" />
      ) : (
        <FlipGroup root={listRef} signature={signature}>
          <ul ref={listRef} className="grid gap-2">
            {data.map((c) => (
              <li
                key={c.id}
                data-flip-id={c.id}
                className="flex items-center gap-4 rounded-2xl bg-surface-container-low px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-on-surface">
                    {c.folio} <span className="font-normal text-on-surface-variant">· {c.usuariaNombre}</span>
                  </p>
                  <p className="truncate text-sm text-on-surface-variant">
                    {ESTADO_LABELS[c.estado]} · actualizado {relativeTime(c.actualizadoEn)}
                  </p>
                </div>
                {c.enListaUrgencias && (
                  <span className="rounded-full bg-error-container px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-on-error-container">
                    Urgencia
                  </span>
                )}
              </li>
            ))}
          </ul>
        </FlipGroup>
      )}
    </WidgetCard>
  );
}
