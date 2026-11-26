import { useRef, useState, type ReactNode } from 'react';
import { FlipGroup } from '@yewdiel21/motion-kit/react';
import { isAttentionRole, useAuth } from '@/shared/auth/useAuth';
import { Icon } from '@/shared/ui/Icon';
import { PageHeader } from '@/shared/ui/PageHeader';
import { CustomizeDialog } from './CustomizeDialog';
import { useVisibleWidgets, WIDGETS, type WidgetId } from './layout';
import { UmecaHomeView } from './UmecaHomeView';
import { AgendaWidget } from './widgets/AgendaWidget';
import { AlertsWidget } from './widgets/AlertsWidget';
import { CasesWidget } from './widgets/CasesWidget';
import { DirectoryWidget } from './widgets/DirectoryWidget';
import { KpisWidget } from './widgets/KpisWidget';
import { SecurityWidget } from './widgets/SecurityWidget';
import { TrendWidget } from './widgets/TrendWidget';

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const today = () =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function DashboardPage() {
  const { user } = useAuth();
  const [customizing, setCustomizing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleWidgets(user?.id ?? 'anon', user?.role ?? 'recepcion');

  if (!user) return null;
  if (user.role === 'umeca') return <UmecaHomeView displayName={user.displayName} />;

  const mine = isAttentionRole(user.role);
  const canViewClinical = user.role !== 'recepcion';

  const render: Record<WidgetId, ReactNode> = {
    kpis: (
      <KpisWidget
        userId={user.id}
        mine={mine}
        canViewAlerts={canViewClinical}
        canViewCases={canViewClinical}
      />
    ),
    alerts: <AlertsWidget />,
    cases: <CasesWidget userId={user.id} defaultMine={mine} />,
    agenda: <AgendaWidget />,
    trend: <TrendWidget />,
    security: <SecurityWidget />,
    directory: <DirectoryWidget />,
  };

  const shown = WIDGETS.filter((w) => visible.includes(w.id));
  const full = shown.filter((w) => w.id === 'kpis');
  const main = shown.filter((w) => w.column === 'main' && w.id !== 'kpis');
  const side = shown.filter((w) => w.column === 'side');
  const firstName = user.displayName.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={today()}
        actions={
          <button type="button" className="mk-button mk-button--tonal" onClick={() => setCustomizing(true)}>
            <Icon name="dashboard_customize" />
            <span className="ml-2">Personalizar</span>
          </button>
        }
      />

      {shown.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-outline-variant p-10 text-center text-on-surface-variant">
          No hay widgets visibles. Usa «Personalizar» para elegir qué ver.
        </p>
      ) : (
        <FlipGroup root={gridRef} signature={visible.join(',')}>
          <div ref={gridRef} className="grid gap-6">
            {full.map((w) => (
              <div key={w.id} data-flip-id={w.id}>
                {render[w.id]}
              </div>
            ))}
            <div className={`grid gap-6 ${main.length && side.length ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
              {main.length > 0 && (
                <div className="grid content-start gap-6">
                  {main.map((w) => (
                    <div key={w.id} data-flip-id={w.id}>
                      {render[w.id]}
                    </div>
                  ))}
                </div>
              )}
              {side.length > 0 && (
                <div className={`grid content-start gap-6 ${main.length ? '' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                  {side.map((w) => (
                    <div key={w.id} data-flip-id={w.id}>
                      {render[w.id]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FlipGroup>
      )}

      <CustomizeDialog
        open={customizing}
        onOpenChange={setCustomizing}
        userId={user.id}
        role={user.role}
        visible={visible}
      />
    </>
  );
}
