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

/**
 * Agenda operativa:
 * - "Citas de hoy" va arriba del calendario compacto para priorizar la carga del día sin
 *   obligar a recorrer la cuadrícula mensual primero.
 * - Privacidad (LGPDPPSO): solo muestra hora, área y estado, sin nombres nominales.
 */
export function AgendaWidget() {
  const [{ from, to, today }] = useState(getAgendaRange);
  const { data, isLoading, isError } = useAppointments(from, to);

  const events = useMemo(
    () =>
      (data ?? [])
        .filter((c) => c.estado !== 'cancelada' && c.estado !== 'reagendada')
        .map((c) => ({
          id: c.id,
          title: `Cita · ${c.areaNombre}`,
          start: c.programadaEn,
          status: c.estado === 'asistio' ? ('done' as const) : ('pending' as const),
        })),
    [data],
  );

  const todays = (data ?? []).filter(
    (c) => isoDate(new Date(c.programadaEn)) === today && c.estado !== 'cancelada' && c.estado !== 'reagendada',
  );

  return (
    <WidgetCard title="Agenda de hoy" action={{ label: 'Abrir agenda', to: '/agenda' }}>
      {isLoading ? (
        <WidgetLoading rows={2} />
      ) : isError || todays.length === 0 ? (
        <WidgetEmpty
          error={isError}
          title="Sin citas programadas para hoy."
          action={{ label: 'Ver agenda', to: '/agenda' }}
        />
      ) : (
        <ul className="grid gap-2">
          {todays.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-2.5">
              <span className="font-mono text-sm font-medium text-on-surface">{timeOf(c.programadaEn)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-on-surface">Cita · {c.areaNombre}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.estado === 'asistio'
                    ? 'bg-status-success-bg text-status-success'
                    : c.estado === 'confirmada'
                      ? 'bg-status-info-bg text-status-info'
                      : 'bg-status-warning-bg text-status-warning'
                }`}
              >
                {c.estado}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-outline-variant pt-4">
        <Calendar
          view="month"
          hideViews
          locale="es-MX"
          firstDay={1}
          maxEvents={1}
          events={events}
          className="vc-calendar-compact"
        />
      </div>
    </WidgetCard>
  );
}
