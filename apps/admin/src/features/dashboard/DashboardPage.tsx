import { FadeContent, StatCard } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/stat-card';
import '@yewdiel21/motion-kit/css/components/fade-content';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useDirectory, type DirectoryEntry } from '@/features/directory/api';
import { isSupervisor, useAuth } from '@/shared/auth/useAuth';
import { ApiStatus } from './ApiStatus';
import { RecentActivity } from './RecentActivity';

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

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function DashboardPage() {
  const { user } = useAuth();
  // `select` deriva los conteos dentro de React Query: solo se vuelve a pintar si cambian.
  const { data, isLoading } = useDirectory(undefined, countByKind);
  const firstName = user?.displayName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Situación general de la atención. Los indicadores de alertas y expedientes aparecen cuando esos módulos estén listos."
        actions={<ApiStatus />}
      />

      <FadeContent as="section" aria-label="Indicadores" stagger={70} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data ? (
          <div className="h-36 animate-pulse rounded-3xl bg-surface-container sm:col-span-2" />
        ) : (
          <>
            <div data-mk-fade-item>
              <StatCard label="Instancias en el directorio" value={data.institutions} />
            </div>
            <div data-mk-fade-item>
              <StatCard label="Puntos Violeta activos" value={data.violetPoints} />
            </div>
          </>
        )}
      </FadeContent>

      {isSupervisor(user?.role) && (
        <section aria-labelledby="actividad" className="mt-10 rounded-3xl bg-surface-container-low p-6">
          <h2 id="actividad" className="mb-4 text-lg font-semibold text-on-surface">
            Actividad de seguridad reciente
          </h2>
          <RecentActivity />
        </section>
      )}
    </>
  );
}
