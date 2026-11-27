import { EmptyState } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/empty-state';
import { useAuth } from '@/shared/auth/useAuth';
import { PageHeader } from '@/shared/ui/PageHeader';
import { InformesPanel } from './InformesPanel';
import { puedeVerInformes } from './informesPermisos';

/** Estadísticas: informe mensual/anual con descarga. Recepción y UMECA no tienen `informe.ver`, así que no lo montan. */
export default function EstadisticasPage() {
  const { user } = useAuth();
  const permitido = puedeVerInformes(user?.role);

  return (
    <>
      <PageHeader
        title="Estadísticas"
        description="Atenciones por área, tipo de atención y primera vez o seguimiento. Dirección ve todas las áreas; cada área de atención ve solo la suya."
      />
      {permitido ? (
        <div className="grid gap-4">
          <InformesPanel />
        </div>
      ) : (
        <div className="rounded-3xl bg-surface-container-low p-10">
          <EmptyState
            illustration="folder"
            title="Sin acceso a los informes"
            description="Tu rol no incluye la consulta de informes estadísticos."
          />
        </div>
      )}
    </>
  );
}
