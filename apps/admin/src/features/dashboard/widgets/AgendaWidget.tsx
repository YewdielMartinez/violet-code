import { useMemo } from 'react';
import { Calendar } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/calendar';
import { useAppointments } from '../api';
import { isoDate, timeOf } from './format';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

const KIND: Record<string, string> = {
  Psicologica: 'Psicológica',
  Juridica: 'Jurídica',
  Seguimiento: 'Seguimiento',
  Visita: 'Visita',
};

/** Calendario del mes (motion-kit Calendar) y lista de las citas de hoy. */
export function AgendaWidget({ mine }: { mine: boolean }) {
  const { from, to, today } = useMemo(() => {
    const now = new Date();
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      today: isoDate(now),
    };
  }, []);
  const { data, isLoading, isError } = useAppointments(from, to, mine);

  const events = useMemo(
    () =>
      (data ?? [])
        .filter((a) => a.status !== 'Cancelled')
        .map((a) => ({
          id: a.id,
          title: `${a.caseFolio} · ${KIND[a.kind] ?? a.kind}`,
          start: a.startsAt,
          status: a.status === 'Done' ? ('done' as const) : ('pending' as const),
        })),
    [data],
  );
  const todays = (data ?? []).filter((a) => isoDate(new Date(a.startsAt)) === today && a.status !== 'Cancelled');

  return (
    <WidgetCard title="Agenda" action={{ label: 'Abrir agenda', to: '/agenda' }}>
      <Calendar view="month" hideViews locale="es-MX" firstDay={1} maxEvents={1} events={events} className="vc-calendar-compact" />

      <h3 className="mt-5 mb-2 text-sm font-medium text-on-surface-variant">Citas de hoy</h3>
      {isLoading ? (
        <WidgetLoading rows={2} />
      ) : isError || todays.length === 0 ? (
        <WidgetEmpty error={isError} title="Sin citas hoy" />
      ) : (
        <ul className="grid gap-2">
          {todays.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-2.5">
              <span className="font-mono text-sm font-medium text-on-surface">{timeOf(a.startsAt)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                {a.caseFolio} · {KIND[a.kind] ?? a.kind}
              </span>
              <span className="text-xs text-on-surface-variant">{a.professionalName}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
