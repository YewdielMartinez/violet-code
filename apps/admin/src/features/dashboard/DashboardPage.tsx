import { StatCard } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/stat-card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useDirectory, type DirectoryEntry } from '@/features/directory/api';
import { ApiStatus } from './ApiStatus';

/** Cuenta por tipo en un solo recorrido. */
function countByKind(entries: DirectoryEntry[]) {
  let institutions = 0;
  let violetPoints = 0;
  for (const e of entries) {
    if (e.kind === 'Institution') institutions++;
    else if (e.kind === 'VioletPoint') violetPoints++;
  }
  return { institutions, violetPoints };
}

export default function DashboardPage() {
  // `select` deriva los conteos dentro de React Query: el componente solo se re-renderiza
  // si cambian los números, no cada vez que llega el mismo directorio.
  const { data, isLoading } = useDirectory(undefined, countByKind);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Situación general de la atención. Los indicadores de casos se agregan cuando existan los módulos de Alertas y Expedientes."
        actions={<ApiStatus />}
      />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data ? (
          <div className="h-32 animate-pulse rounded-3xl bg-surface-container" />
        ) : (
          <>
            <StatCard label="Instancias en el directorio" value={data.institutions} />
            <StatCard label="Puntos Violeta" value={data.violetPoints} />
          </>
        )}
      </section>
    </>
  );
}
