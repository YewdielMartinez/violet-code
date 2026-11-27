import { memo, useCallback, useMemo, type CSSProperties, type MouseEvent } from 'react';
import type { AgendaItem } from '@/domain/models/Cita';
import { AgendaCitaChip } from './AgendaCitaChip';
import {
  dayKey,
  formatDayLong,
  formatWeekdayShort,
  isSameDay,
  layoutWeekDay,
  parseDayKey,
  withTime,
  WEEK_HOURS,
} from './agendaDates';

const NO_CITAS: AgendaItem[] = [];

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

interface WeekColumnProps {
  day: Date;
  isToday: boolean;
  citas: AgendaItem[];
  loading: boolean;
  /** Sin permiso para agendar: los huecos no son botones (la rejilla solo muestra las citas). */
  puedeCrear: boolean;
}

const WeekColumn = memo(function WeekColumn({ day, isToday, citas, loading, puedeCrear }: WeekColumnProps) {
  const key = dayKey(day);
  const long = formatDayLong(day);
  const layout = useMemo(() => layoutWeekDay(citas), [citas]);

  return (
    <div className="ag-wcol" data-today={isToday ? '' : undefined} aria-busy={loading || undefined}>
      {WEEK_HOURS.map((hour) =>
        puedeCrear ? (
          // tabIndex -1: 105 huecos no deben ser paradas de teclado; el encabezado del día abre «nueva cita».
          <button
            key={hour}
            type="button"
            tabIndex={-1}
            className="ag-slot"
            data-slot={`${key}|${hour}`}
            aria-label={`Nueva cita, ${long}, ${hourLabel(hour)}`}
          />
        ) : (
          <div key={hour} aria-hidden className="ag-slot ag-slot--static" />
        ),
      )}
      {layout.map(({ cita, topMinutes, lane, lanes }) => (
        <div
          key={cita.citaId}
          className="ag-wblock"
          style={
            {
              '--ag-top': topMinutes / 60,
              '--ag-lane': lane,
              '--ag-lanes': lanes,
            } as CSSProperties
          }
        >
          <AgendaCitaChip cita={cita} variant="week" />
        </div>
      ))}
    </div>
  );
});

interface AgendaWeekViewProps {
  days: readonly Date[];
  today: Date;
  byDay: ReadonlyMap<string, AgendaItem[]>;
  citasById: ReadonlyMap<string, AgendaItem>;
  loading: boolean;
  onOpenDay: (day: Date, citas: AgendaItem[], anchor: HTMLElement) => void;
  onOpenCita: (cita: AgendaItem, anchor: HTMLElement) => void;
  /** `false` si el rol no puede agendar: los huecos vacíos no se pueden pulsar. */
  puedeCrear: boolean;
  onOpenSlot: (fecha: Date, anchor: HTMLElement) => void;
}

/** Semana dom–sáb con filas de 06:00 a 20:00; las citas son bloques posicionados por hora. */
export function AgendaWeekView({
  days,
  today,
  byDay,
  citasById,
  loading,
  puedeCrear,
  onOpenDay,
  onOpenCita,
  onOpenSlot,
}: AgendaWeekViewProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const chip = target.closest<HTMLElement>('[data-cita-id]');
      if (chip) {
        event.stopPropagation();
        const cita = citasById.get(chip.dataset.citaId ?? '');
        if (cita) onOpenCita(cita, chip);
        return;
      }
      const head = target.closest<HTMLElement>('[data-day-head]');
      if (head) {
        const key = head.dataset.dayHead ?? '';
        onOpenDay(parseDayKey(key), byDay.get(key) ?? NO_CITAS, head);
        return;
      }
      const slot = puedeCrear ? target.closest<HTMLElement>('[data-slot]') : null;
      if (slot) {
        const [key, hour] = (slot.dataset.slot ?? '').split('|');
        onOpenSlot(withTime(parseDayKey(key), Number(hour)), slot);
      }
    },
    [byDay, citasById, onOpenCita, onOpenDay, onOpenSlot, puedeCrear],
  );

  return (
    // El clic se atiende por delegación; los botones internos son los elementos accesibles.
    <div className="ag-week" role="group" aria-label="Semana por horas" onClick={handleClick}>
      <div className="ag-week__head">
        <span aria-hidden />
        {days.map((day) => {
          const key = dayKey(day);
          const citas = byDay.get(key) ?? NO_CITAS;
          return (
            <button
              key={key}
              type="button"
              className="ag-week__day"
              data-day-head={key}
              data-today={isSameDay(day, today) ? '' : undefined}
              aria-label={`${formatDayLong(day)}, ${citas.length === 1 ? '1 cita' : `${citas.length} citas`}`}
            >
              <span className="ag-week__dow">{formatWeekdayShort(day)}</span>
              <span className="ag-week__date">
                {day.getDate()}/{day.getMonth() + 1}
              </span>
            </button>
          );
        })}
      </div>
      <div className="ag-week__body">
        <div className="ag-week__hours" aria-hidden>
          {WEEK_HOURS.map((hour) => (
            <span key={hour}>{hourLabel(hour)}</span>
          ))}
        </div>
        {days.map((day) => (
          <WeekColumn
            key={day.getTime()}
            day={day}
            isToday={isSameDay(day, today)}
            citas={byDay.get(dayKey(day)) ?? NO_CITAS}
            loading={loading}
            puedeCrear={puedeCrear}
          />
        ))}
      </div>
    </div>
  );
}
