import { useMemo, useState } from 'react';
import { Calendar } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/calendar';
import { useAppointments } from '../api';
import { isoDate, timeOf } from './format';
import { WidgetCard, WidgetEmpty, WidgetLoading } from './shared';

function getAgendaRange() {
  const now = new Date();
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    today: isoDate(now),
  };
}

/** Calendario del mes (motion-kit Calendar) y lista de las citas de hoy. */
export function AgendaWidget() {
  const [{ from, to, today }] = useState(getAgendaRange);
  const { data, isLoading, isError } = useAppointments(from, to);

  const events = useMemo(
    () =>
      (data ?? [])
        .filter((c) => c.estado !== 'cancelada' && c.estado !== 'reagendada')
        .map((c) => ({
          id: c.id,
          title: `${c.areaNombre} · ${c.usuariaNombre}`,
          start: c.programadaEn,
          status: c.estado === 'asistio' ? ('done' as const) : ('pending' as const),
        })),
    [data],
  );

  const todays = (data ?? []).filter(
    (c) => isoDate(new Date(c.programadaEn)) === today && c.estado !== 'cancelada' && c.estado !== 'reagendada',
  );

  return (
    <WidgetCard title="Agenda" action={{ label: 'Abrir agenda', to: '/agenda' }}>
      <Calendar
        view="month"
        hideViews
        locale="es-MX"
        firstDay={1}
        maxEvents={1}
        events={events}
        className="vc-calendar-compact"
      />

      <h3 className="mt-5 mb-2 text-sm font-medium text-on-surface-variant">Citas de hoy</h3>
      {isLoading ? (
        <WidgetLoading rows={2} />
      ) : isError || todays.length === 0 ? (
        <WidgetEmpty error={isError} title="Sin citas hoy" />
      ) : (
        <ul className="grid gap-2">
          {todays.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-2.5">
              <span className="font-mono text-sm font-medium text-on-surface">{timeOf(c.programadaEn)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{c.usuariaNombre}</span>
              <span className="text-xs text-on-surface-variant">{c.areaNombre}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
