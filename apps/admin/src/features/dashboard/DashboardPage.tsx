import { useState, type ReactNode } from 'react';
import { isAttentionRole, useAuth, type StaffUser } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import './dashboard.css';
import { MOTION } from './flip';
import {
  moveItemBy,
  reorderVisible,
  resetLayout,
  setItemSize,
  setItemVisible,
  updateLayout,
  useDashboardLayout,
  visibleItems,
  widgetDef,
  type LayoutItem,
  type WidgetId,
  type WidgetSize,
} from './layout';
import { UmecaHomeView } from './UmecaHomeView';
import { usePresence } from './usePresence';
import { WidgetGrid } from './WidgetGrid';
import { AgendaWidget } from './widgets/AgendaWidget';
import { AlertsWidget } from './widgets/AlertsWidget';
import { CasesWidget } from './widgets/CasesWidget';
import { DirectoryWidget } from './widgets/DirectoryWidget';
import { KpiAlertsWidget, KpiCitasWidget, KpiExpedientesWidget, KpiUrgentesWidget } from './widgets/KpiWidgets';
import { SecurityWidget } from './widgets/SecurityWidget';
import { TrendWidget } from './widgets/TrendWidget';

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function capitalize(word: string): string {
  const clean = word.trim();
  if (!clean) return 'Personal';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

const today = () =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Renderiza un widget del tablero según el usuario autenticado. */
export function renderWidget(id: WidgetId, user: StaffUser): ReactNode {
  const mine = isAttentionRole(user.role);
  switch (id) {
    case 'kpi_alerts':
      return <KpiAlertsWidget />;
    case 'kpi_citas':
      return <KpiCitasWidget />;
    case 'kpi_expedientes':
      return <KpiExpedientesWidget userId={user.id} mine={mine} />;
    case 'kpi_prioritarios':
      return <KpiUrgentesWidget userId={user.id} />;
    case 'alerts':
      return <AlertsWidget />;
    case 'cases':
      return <CasesWidget userId={user.id} defaultMine={mine} />;
    case 'agenda':
      return <AgendaWidget />;
    case 'trend':
      return <TrendWidget />;
    case 'security':
      return <SecurityWidget />;
    case 'directory':
      return <DirectoryWidget />;
  }
}

function StaffDashboard({ user }: { user: StaffUser }) {
  const items = useDashboardLayout(user.id, user.role);
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // El panel de personalizar sale con fundido antes de desmontarse; mientras tanto la cuadrícula no se mueve.
  const panel = usePresence(editing, MOTION.presence);

  const visible = visibleItems(items);
  const hidden = items.filter((i) => !i.visible);
  const firstName = capitalize(user.displayName.split(/\s+/)[0] ?? '');

  const change = (fn: (current: LayoutItem[]) => LayoutItem[]) => updateLayout(user.id, user.role, fn);

  const announcePosition = (id: WidgetId, next: LayoutItem[]) => {
    const list = visibleItems(next);
    setAnnouncement(`${widgetDef(id).title}: posición ${list.findIndex((i) => i.id === id) + 1} de ${list.length}.`);
  };

  const onMove = (id: WidgetId, delta: -1 | 1) => {
    const next = moveItemBy(items, id, delta);
    change(() => next);
    announcePosition(id, next);
  };

  const onReorder = (id: WidgetId, toIndex: number) => {
    const next = reorderVisible(items, id, toIndex);
    change(() => next);
    announcePosition(id, next);
  };

  const onResize = (id: WidgetId, size: WidgetSize) => {
    change((current) => setItemSize(current, id, size));
    setAnnouncement(`${widgetDef(id).title}: tamaño ${size.toUpperCase()}.`);
  };

  const onHide = (id: WidgetId) => {
    change((current) => setItemVisible(current, id, false));
    setAnnouncement(`${widgetDef(id).title} oculto.`);
  };

  const onShow = (id: WidgetId) => {
    change((current) => setItemVisible(current, id, true));
    setAnnouncement(`${widgetDef(id).title} agregado al final del tablero.`);
  };

  const onReset = () => {
    resetLayout(user.id);
    setAnnouncement('Tablero restablecido según tu rol.');
  };

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        documentTitle="Tablero"
        subtitle={today()}
        actions={
          <button
            type="button"
            aria-pressed={editing}
            className={`mk-button ${editing ? '' : 'mk-button--tonal'}`}
            onClick={() => setEditing((on) => !on)}
          >
            <Icon name={editing ? 'check' : 'dashboard_customize'} />
            <span className="ml-2">{editing ? 'Listo' : 'Personalizar'}</span>
          </button>
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {panel.mounted ? (
        <section
          aria-label="Personalizar tablero"
          data-state={panel.state}
          inert={panel.state === 'out'}
          className="vc-edit-panel mb-4 grid gap-3 rounded-3xl border border-dashed border-primary/50 bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-sm text-on-surface-variant">
              Arrastra el asa <Icon name="drag_indicator" className="align-middle text-[18px]" /> o usa las flechas para
              reordenar; elige el tamaño de cada widget o escóndelo. Se guarda para ti en este navegador.
            </p>
            <button type="button" className="mk-button mk-button--text mk-button--sm" onClick={onReset}>
              <Icon name="restart_alt" />
              <span className="ml-2">Restablecer según mi rol</span>
            </button>
          </div>
          {hidden.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-on-surface-variant">Widgets ocultos · toca para agregar</p>
              <ul className="flex flex-wrap gap-2">
                {hidden.map((item) => {
                  const def = widgetDef(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        title={def.description}
                        onClick={() => onShow(item.id)}
                        className="mk-chip mk-chip--filter"
                      >
                        <Icon name="add" className="mr-1 text-[18px]" />
                        {def.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {visible.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-outline-variant p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="space_dashboard" />
          </span>
          <p className="font-medium text-on-surface">Tu tablero está vacío</p>
          <p className="max-w-md text-sm text-on-surface-variant">
            {editing
              ? 'Agrega widgets desde la lista de ocultos, o restablece la vista de tu rol.'
              : 'Usa «Personalizar» para elegir qué ver.'}
          </p>
          {editing ? null : (
            <button type="button" className="mk-button mk-button--tonal" onClick={() => setEditing(true)}>
              Personalizar
            </button>
          )}
        </div>
      ) : (
        <WidgetGrid
          items={visible}
          editing={editing}
          render={(id) => renderWidget(id, user)}
          onMove={onMove}
          onResize={onResize}
          onHide={onHide}
          onReorder={onReorder}
          onAnnounce={setAnnouncement}
          shiftKey={panel.mounted ? 'panel' : ''}
        />
      )}
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'umeca') return <UmecaHomeView displayName={user.displayName} />;
  return <StaffDashboard user={user} />;
}
