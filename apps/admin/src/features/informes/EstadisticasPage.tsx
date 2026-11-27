import { PageHeader } from '@/shared/ui/PageHeader';
import { useAuth, type StaffRole } from '@/shared/auth/useAuth';
import { availableWidgets, type LayoutItem, type WidgetId } from '@/features/dashboard/layout';
import { WidgetGrid } from '@/features/dashboard/WidgetGrid';
import { renderWidget } from '@/features/dashboard/DashboardPage';
import '@/features/dashboard/dashboard.css';

const EXCLUDED_WIDGETS = new Set<WidgetId>(['alerts', 'cases', 'directory']);
const noop = () => {};

/** Devuelve los widgets de estadísticas visibles para un rol dado, con su tamaño por defecto. */
export function estadisticasWidgetsForRole(role: StaffRole): LayoutItem[] {
  if (role === 'umeca') return [];
  return availableWidgets(role)
    .filter((w) => !EXCLUDED_WIDGETS.has(w.id) && (w.id !== 'agenda' || role === 'recepcion'))
    .map((w) => ({ id: w.id, visible: true, size: w.defaultSize }));
}

export default function EstadisticasPage() {
  const { user } = useAuth();
  if (!user || user.role === 'umeca') return null;

  const items = estadisticasWidgetsForRole(user.role);

  return (
    <section className="vc-dash" aria-label="Estadísticas">
      <PageHeader
        title="Estadísticas"
        subtitle="Indicadores y resumen operativo según tu rol"
      />
      <WidgetGrid
        items={items}
        editing={false}
        render={(id) => renderWidget(id, user)}
        onMove={noop}
        onResize={noop}
        onHide={noop}
        onReorder={noop}
        onAnnounce={noop}
      />
      {user.role !== 'recepcion' ? (
        /* Espacio reservado para <InformesPanel /> cuando esté implementado */
        <div className="vc-estadisticas__informes-slot" aria-hidden="true" />
      ) : null}
    </section>
  );
}
