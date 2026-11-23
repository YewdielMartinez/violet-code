import { useRef, useState } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { useCasesToReview } from '../api';
import { relativeTime } from './format';
import { PriorityBadge, WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const AREA: Record<string, string> = {
  Psicologia: 'Psicología',
  Juridico: 'Jurídico',
  TrabajoSocial: 'Trabajo social',
  Coordinacion: 'Coordinación',
};

/** Expedientes que necesitan revisión. Las profesionales ven primero los suyos. */
export function CasesWidget({ defaultMine }: { defaultMine: boolean }) {
  const [mine, setMine] = useState(defaultMine);
  const { data, isLoading, isError } = useCasesToReview(mine);
  const listRef = useRef<HTMLUListElement>(null);
  const signature = data?.map((c) => c.id).join(',') ?? '';

  return (
    <WidgetCard title="Expedientes por revisar" action={{ label: 'Ver expedientes', to: '/expedientes' }}>
      <label className="mb-4 flex w-fit items-center gap-3 text-sm text-on-surface-variant">
        <input type="checkbox" role="switch" className="mk-switch" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        Solo los asignados a mí
      </label>

      {isLoading ? (
        <WidgetLoading />
      ) : isError || !data?.length ? (
        <WidgetEmpty error={isError} title="Nada por revisar" />
      ) : (
        <FlipGroup root={listRef} signature={signature}>
        <ul ref={listRef} className="grid gap-2">
          {data.map((c) => (
            <li key={c.id} data-flip-id={c.id} className="flex items-center gap-4 rounded-2xl bg-surface-container-low px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-on-surface">
                  {c.folio} <span className="font-normal text-on-surface-variant">· {c.alias}</span>
                </p>
                <p className="truncate text-sm text-on-surface-variant">
                  {AREA[c.area] ?? c.area}
                  {c.assignedToName ? ` · ${c.assignedToName}` : ''} · actualizado {relativeTime(c.updatedAt)}
                </p>
              </div>
              <PriorityBadge value={c.riskLevel} risk />
            </li>
          ))}
        </ul>
        </FlipGroup>
      )}
    </WidgetCard>
  );
}
