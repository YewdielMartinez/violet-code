import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Calendar } from '@yewdiel21/motion-kit/react';
import '@yewdiel21/motion-kit/css/components/calendar';
import { useAppointments, type CitaItem, type EstadoCita } from '../api';
import { clamp, useWidgetBox } from './box';
import { dayAndTime, isoDate, timeOf } from './format';
import { FitList } from './FitList';
import { WidgetCard, WidgetEmpty, WidgetSkeleton } from './shared';

function getAgendaRange() {
  const now = new Date();
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    today: isoDate(now),
  };
}

const ESTADO_LABEL: Record<EstadoCita, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  asistio: 'Asistió',
  no_asistio: 'No asistió',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
};

const estadoClass = (estado: EstadoCita) =>
  estado === 'asistio'
    ? 'bg-status-success-bg text-status-success'
    : estado === 'confirmada'
      ? 'bg-status-info-bg text-status-info'
      : 'bg-status-warning-bg text-status-warning';

const ROW_HEIGHT = 44;
const getKey = (c: CitaItem) => c.id;
const MORE = { label: 'abrir agenda', to: '/agenda' };
const isActive = (c: CitaItem) => c.estado !== 'cancelada' && c.estado !== 'reagendada';

/** Fila: hora (o día y hora para próximas), área y estado. Privacidad (LGPDPPSO): sin nombres nominales. */
function CitaRow({ c, showDay }: { c: CitaItem; showDay: boolean }) {
  return (
    <div className="flex h-full items-center gap-3 rounded-2xl bg-surface-container-low px-3">
      <span className={`shrink-0 font-mono text-sm font-medium text-on-surface ${showDay ? 'w-24 text-xs' : ''}`}>
        {showDay ? dayAndTime(c.programadaEn).replace(' a las ', ' · ') : timeOf(c.programadaEn)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">Cita · {c.areaNombre}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${estadoClass(c.estado)}`}>
        {ESTADO_LABEL[c.estado]}
      </span>
    </div>
  );
}

function ColumnLabel({ children }: { children: string }) {
  return <p className="mb-2 shrink-0 text-xs font-medium text-on-surface-variant">{children}</p>;
}

interface BodyProps {
  events: { id: string; title: string; start: string; status: 'done' | 'pending' }[];
  todays: CitaItem[];
  upcoming: CitaItem[];
}

/**
 * Según la celda:
 * - Baja (1×1, 2×1, 4×1): lista de las citas de hoy, en 1–3 columnas.
 * - Alta y angosta (1×2): calendario del mes (el conteo de hoy va en el subtítulo).
 * - Alta y ancha (2×2): lista de hoy + calendario.
 * - Muy ancha (4×2): hoy + calendario + próximas citas.
 */
function AgendaBody({ events, todays, upcoming }: BodyProps) {
  const { w, h } = useWidgetBox();
  const calendar = h >= 300 && w >= 250;
  const side = calendar && w >= 520;
  const three = side && w >= 900;
  const dayHeight = clamp(Math.floor((h - 100) / 6), 30, 60);
  const calendarStyle = { '--mk-calendar-day-height': `${dayHeight}px` } as CSSProperties;

  const todayList = todays.length ? (
    <FitList
      label="Citas de hoy"
      items={todays}
      getKey={getKey}
      rowHeight={ROW_HEIGHT}
      minColWidth={side ? 240 : 300}
      maxCols={side ? 1 : 3}
      reserve={side ? 24 : 0}
      more={MORE}
      renderItem={(c) => <CitaRow c={c} showDay={false} />}
    />
  ) : upcoming.length && !side ? (
    <FitList
      label="Próximas citas"
      items={upcoming}
      getKey={getKey}
      rowHeight={ROW_HEIGHT}
      minColWidth={300}
      more={MORE}
      renderItem={(c) => <CitaRow c={c} showDay />}
    />
  ) : (
    <WidgetEmpty
      icon="event_available"
      title="Sin citas hoy"
      description="No hay citas programadas para hoy."
      action={{ label: 'Ver agenda', to: '/agenda' }}
    />
  );

  return (
    <div className={`flex h-full min-h-0 gap-4 ${side ? 'flex-row' : 'flex-col'}`}>
      {!calendar || side ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {side ? <ColumnLabel>{`Hoy · ${todays.length} ${todays.length === 1 ? 'cita' : 'citas'}`}</ColumnLabel> : null}
          {todayList}
        </div>
      ) : null}
      {calendar ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Calendar
            view="month"
            hideViews
            locale="es-MX"
            firstDay={1}
            maxEvents={1}
            events={events}
            className="vc-calendar-compact"
            style={calendarStyle}
          />
        </div>
      ) : null}
      {three ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ColumnLabel>Próximas citas</ColumnLabel>
          {upcoming.length ? (
            <FitList
              label="Próximas citas"
              items={upcoming}
              getKey={getKey}
              rowHeight={ROW_HEIGHT}
              minColWidth={240}
              maxCols={1}
              reserve={24}
              more={MORE}
              renderItem={(c) => <CitaRow c={c} showDay />}
            />
          ) : (
            <WidgetEmpty icon="event_available" title="Sin próximas citas" description="No hay más citas este mes." />
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Agenda operativa. «Citas de hoy» tiene prioridad sobre la cuadrícula mensual, que solo aparece
 * cuando la celda es lo bastante alta. Privacidad (LGPDPPSO): solo hora, área y estado.
 */
export function AgendaWidget() {
  const [{ from, to, today }] = useState(getAgendaRange);
  const { data, isLoading, isError, refetch } = useAppointments(from, to);

  const { events, todays, upcoming } = useMemo(() => {
    const active = (data ?? []).filter(isActive).sort((a, b) => a.programadaEn.localeCompare(b.programadaEn));
    return {
      events: active.map((c) => ({
        id: c.id,
        title: `Cita · ${c.areaNombre}`,
        start: c.programadaEn,
        status: c.estado === 'asistio' ? ('done' as const) : ('pending' as const),
      })),
      todays: active.filter((c) => isoDate(new Date(c.programadaEn)) === today),
      upcoming: active.filter((c) => isoDate(new Date(c.programadaEn)) > today),
    };
  }, [data, today]);

  return (
    <WidgetCard
      title="Agenda"
      icon="event"
      subtitle={data ? `${todays.length} ${todays.length === 1 ? 'cita' : 'citas'} hoy` : undefined}
      action={{ label: 'Abrir agenda', to: '/agenda' }}
    >
      {isLoading ? (
        <WidgetSkeleton />
      ) : isError ? (
        <WidgetEmpty error title="" onRetry={() => void refetch()} />
      ) : (
        <AgendaBody events={events} todays={todays} upcoming={upcoming} />
      )}
    </WidgetCard>
  );
}
