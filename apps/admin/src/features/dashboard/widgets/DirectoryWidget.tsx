import { useDirectory, type DirectoryEntry } from '@/features/directory/api';
import { Icon } from '@/shared/ui/Icon';
import { WidgetCard, WidgetLoading } from './shared';

function countByKind(entries: DirectoryEntry[]) {
  let institutions = 0;
  let violetPoints = 0;
  for (const e of entries) {
    if (e.kind === 'Institution') institutions++;
    else if (e.kind === 'VioletPoint') violetPoints++;
  }
  return { institutions, violetPoints };
}

/** Lo que la app móvil ofrece a las usuarias sin conexión. */
export function DirectoryWidget() {
  const { data, isLoading } = useDirectory(undefined, countByKind);

  return (
    <WidgetCard title="Directorio" action={{ label: 'Ver', to: '/directorio' }}>
      {isLoading || !data ? (
        <WidgetLoading rows={2} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-container-low p-4">
            <Icon name="account_balance" className="text-on-surface-variant" />
            <p className="mt-2 text-3xl font-medium text-on-surface">{data.institutions}</p>
            <p className="text-sm text-on-surface-variant">Instancias</p>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-4">
            <Icon name="location_on" className="text-on-surface-variant" />
            <p className="mt-2 text-3xl font-medium text-on-surface">{data.violetPoints}</p>
            <p className="text-sm text-on-surface-variant">Puntos Violeta</p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
