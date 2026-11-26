import { useDirectory, type DirectorioInstitucion } from '@/features/directory/api';
import { Icon } from '@/shared/ui/Icon';
import { WidgetCard, WidgetLoading } from './shared';

function summarizeDirectory(entries: DirectorioInstitucion[]) {
  let total = 0;
  let emergency24h = 0;
  for (const e of entries) {
    total++;
    if (e.es24Horas || e.categoria === 'emergencia') emergency24h++;
  }
  return { total, emergency24h };
}

/** Resumen de instancias activas sincronizadas desde Supabase. */
export function DirectoryWidget() {
  const { data, isLoading } = useDirectory(undefined, summarizeDirectory);

  return (
    <WidgetCard title="Directorio" action={{ label: 'Ver', to: '/directorio' }}>
      {isLoading || !data ? (
        <WidgetLoading rows={2} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-container-low p-4">
            <Icon name="account_balance" className="text-on-surface-variant" />
            <p className="mt-2 text-3xl font-medium text-on-surface">{data.total}</p>
            <p className="text-sm text-on-surface-variant">Instancias activas</p>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-4">
            <Icon name="emergency" className="text-on-surface-variant" />
            <p className="mt-2 text-3xl font-medium text-on-surface">{data.emergency24h}</p>
            <p className="text-sm text-on-surface-variant">Atención 24 h</p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
