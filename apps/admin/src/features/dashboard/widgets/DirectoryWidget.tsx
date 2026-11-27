import { CATEGORIA_LABELS, useDirectory, type CategoriaInstitucion, type DirectorioInstitucion } from '@/features/directory/api';
import { Icon } from '@/shared/ui/Icon';
import { useWidgetBox } from './box';
import { FitList } from './FitList';
import { WidgetCard, WidgetEmpty, WidgetSkeleton } from './shared';

interface DirectorySummary {
  total: number;
  emergency24h: number;
  byCategory: { categoria: CategoriaInstitucion; count: number }[];
}

function summarizeDirectory(entries: DirectorioInstitucion[]): DirectorySummary {
  let total = 0;
  let emergency24h = 0;
  const counts = new Map<CategoriaInstitucion, number>();
  for (const e of entries) {
    total++;
    if (e.es24Horas || e.categoria === 'emergencia') emergency24h++;
    counts.set(e.categoria, (counts.get(e.categoria) ?? 0) + 1);
  }
  const byCategory = [...counts]
    .map(([categoria, count]) => ({ categoria, count }))
    .sort((a, b) => b.count - a.count || a.categoria.localeCompare(b.categoria));
  return { total, emergency24h, byCategory };
}

const getKey = (c: DirectorySummary['byCategory'][number]) => c.categoria;
const MORE = { label: 'ver directorio', to: '/directorio' };

function Stat({ icon, value, label, big }: { icon: string; value: number; label: string; big: boolean }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-low p-3">
      <Icon name={icon} className="text-on-surface-variant" />
      <p className={`mt-1 leading-none font-medium text-on-surface tabular-nums ${big ? 'text-4xl' : 'text-3xl'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}

function DirectoryBody({ data }: { data: DirectorySummary }) {
  const { h } = useWidgetBox();
  const roomy = h >= 190;
  const max = Math.max(1, ...data.byCategory.map((c) => c.count));
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-3">
        <Stat icon="account_balance" value={data.total} label="Instancias activas" big={roomy} />
        <Stat icon="emergency" value={data.emergency24h} label="Atención 24 h" big={roomy} />
      </div>
      {roomy ? (
        <FitList
          label="Instancias por categoría"
          items={data.byCategory}
          getKey={getKey}
          rowHeight={32}
          gap={6}
          minColWidth={240}
          reserve={104}
          more={MORE}
          renderItem={(c) => (
            <div className="flex h-full items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate text-on-surface-variant" title={CATEGORIA_LABELS[c.categoria]}>
                {CATEGORIA_LABELS[c.categoria]}
              </span>
              <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.count / max) * 100}%` }} />
              </span>
              <span className="w-6 shrink-0 text-right font-medium text-on-surface tabular-nums">{c.count}</span>
            </div>
          )}
        />
      ) : null}
    </div>
  );
}

/** Resumen de instancias activas sincronizadas desde Supabase; las celdas altas añaden el desglose por categoría. */
export function DirectoryWidget() {
  const { data, isLoading, isError, refetch } = useDirectory(undefined, summarizeDirectory);

  return (
    <WidgetCard title="Directorio" icon="account_balance" action={{ label: 'Ver directorio', to: '/directorio' }}>
      {isLoading ? (
        <WidgetSkeleton variant="kpi" />
      ) : isError ? (
        <WidgetEmpty error title="" onRetry={() => void refetch()} />
      ) : !data || data.total === 0 ? (
        <WidgetEmpty icon="account_balance" title="Directorio vacío" description="Aún no hay instancias activas." />
      ) : (
        <DirectoryBody data={data} />
      )}
    </WidgetCard>
  );
}
