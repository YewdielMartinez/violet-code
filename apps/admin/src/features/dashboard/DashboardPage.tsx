import { StatCard } from '@yewdiel21/motion-kit/react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useDirectory } from '@/features/directory/api';
import { ApiStatus } from './ApiStatus';

export function DashboardPage() {
  const { data = [], isLoading } = useDirectory();
  const institutions = data.filter((e) => e.kind === 'Institution').length;
  const violetPoints = data.filter((e) => e.kind === 'VioletPoint').length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Situación general de la atención. Los indicadores de casos se agregan cuando existan los módulos de Alertas y Expedientes."
        actions={<ApiStatus />}
      />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-3xl bg-surface-container" />
        ) : (
          <>
            <StatCard label="Instancias en el directorio" value={institutions} countOnView />
            <StatCard label="Puntos Violeta" value={violetPoints} countOnView />
          </>
        )}
      </section>
    </>
  );
}
