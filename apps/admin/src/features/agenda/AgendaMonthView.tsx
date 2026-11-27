import { memo, useCallback, type MouseEvent } from 'react';
import type { AgendaItem } from '@/domain/models/Cita';
import { AgendaCitaChip } from './AgendaCitaChip';
import {
  dayKey,
  formatDayLong,
  isSameDay,
  WEEKDAY_HEADERS,
} from './agendaDates';

/** Cantidad máxima de citas dibujadas por recuadro; el resto se resume en «+N más». */
export const MAX_CHIPS_PER_DAY = 3;

const NO_CITAS: AgendaItem[] = [];

interface DayTileProps {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  citas: AgendaItem[];
  loading: boolean;
  /** Índice en la cuadrícula: reparte los marcadores de carga para que no parezca un patrón fijo. */
  index: number;
}

const DayTile = memo(function DayTile({ day, inMonth, isToday, citas, loading, index }: DayTileProps) {
  const visible = citas.slice(0, MAX_CHIPS_PER_DAY);
  const extra = citas.length - visible.length;
  const summary = citas.length === 0 ? 'sin citas' : citas.length === 1 ? '1 cita' : `${citas.length} citas`;

  return (
    <div
      className="ag-tile"
      data-day={dayKey(day)}
      data-out={inMonth ? undefined : ''}
      data-today={isToday ? '' : undefined}
    >
      <button
        type="button"
        className="ag-tile__hit"
        aria-label={`${formatDayLong(day)}, ${summary}${isToday ? ', hoy' : ''}`}
      />
      <span className="ag-tile__num" aria-hidden>
        {day.getDate()}
      </span>
      <div className="ag-tile__chips">
        {loading && citas.length === 0 && index % 3 !== 2 ? (
          <span aria-hidden className="ag-skel ag-skel--chip" />
        ) : (
          visible.map((cita) => <AgendaCitaChip key={cita.citaId} cita={cita} variant="month" />)
        )}
      </div>
      {extra > 0 ? (
        <span className="ag-tile__more" aria-hidden>
          +{extra} más
        </span>
      ) : null}
    </div>
  );
});

interface AgendaMonthViewProps {
  /** Los 42 días de la cuadrícula (referencia estable mientras no cambie el mes). */
  days: readonly Date[];
  /** Mes mostrado (0-11) para atenuar los días de fuera. */
  month: number;
  today: Date;
  byDay: ReadonlyMap<string, AgendaItem[]>;
  citasById: ReadonlyMap<string, AgendaItem>;
  loading: boolean;
  onOpenDay: (day: Date, citas: AgendaItem[], anchor: HTMLElement) => void;
  onOpenCita: (cita: AgendaItem, anchor: HTMLElement) => void;
}

/** Cuadrícula mensual: 7 columnas dom–sáb, 6 filas, recuadros redondeados con el número arriba a la derecha. */
export function AgendaMonthView({
  days,
  month,
  today,
  byDay,
  citasById,
  loading,
  onOpenDay,
  onOpenCita,
}: AgendaMonthViewProps) {
  // Un solo manejador para toda la cuadrícula (delegación): los recuadros no reciben funciones nuevas.
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
      const tile = target.closest<HTMLElement>('[data-day]');
      if (!tile) return;
      const key = tile.dataset.day ?? '';
      const day = days.find((d) => dayKey(d) === key);
      if (day) onOpenDay(day, byDay.get(key) ?? NO_CITAS, tile);
    },
    [byDay, citasById, days, onOpenCita, onOpenDay],
  );

  return (
    <div className="ag-month" aria-busy={loading || undefined}>
      <div className="ag-month__head" aria-hidden>
        {WEEKDAY_HEADERS.map((weekday) => (
          <span key={weekday.long}>{weekday.short}</span>
        ))}
      </div>
      {/* El clic se atiende por delegación; los botones internos son los elementos accesibles. */}
      <div className="ag-month__grid" role="group" aria-label="Días del mes" onClick={handleClick}>
        {days.map((day, index) => (
          <DayTile
            key={day.getTime()}
            day={day}
            inMonth={day.getMonth() === month}
            isToday={isSameDay(day, today)}
            citas={byDay.get(dayKey(day)) ?? NO_CITAS}
            loading={loading}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
