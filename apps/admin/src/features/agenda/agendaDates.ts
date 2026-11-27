import type { AgendaItem } from '@/domain/models/Cita';

/**
 * Utilidades de calendario de la Agenda. Todo trabaja con la hora local del navegador
 * (el personal opera en Ahome, Sinaloa) y con `Date` a medianoche local como "día".
 * La cuadrícula mensual siempre arranca en domingo y tiene 6 semanas (42 días).
 */

export const GRID_WEEKS = 6;
export const GRID_DAYS = GRID_WEEKS * 7;
/** El RPC `get_agenda` rechaza rangos mayores a 31 días: la cuadrícula se pide en dos tramos de 21 días. */
export const CHUNK_DAYS = 21;

/** Primera y última hora (fila) visibles en la vista semanal. */
export const WEEK_START_HOUR = 6;
export const WEEK_END_HOUR = 20;
export const WEEK_HOURS: readonly number[] = Array.from(
  { length: WEEK_END_HOUR - WEEK_START_HOUR + 1 },
  (_, i) => WEEK_START_HOUR + i,
);

/** Duración visual asumida de una cita en la vista semanal (la BD no guarda duración). */
export const CITA_BLOCK_MINUTES = 60;

export interface DateRange {
  /** ISO 8601, inclusivo. */
  desde: string;
  /** ISO 8601, exclusivo. */
  hasta: string;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Suma días calendario (seguro ante cambios de horario). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Primer día del mes resultante de sumar `months` al mes de `date`. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Llave `YYYY-MM-DD` del día local. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Inverso de `dayKey` (sin pasar por UTC). */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Primer domingo de la cuadrícula mensual que contiene el mes de `anchor`. */
export function monthGridStart(anchor: Date): Date {
  return startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
}

/** Los 42 días (6 semanas, de domingo a sábado) de la cuadrícula del mes de `anchor`. */
export function monthGridDays(anchor: Date): Date[] {
  const start = monthGridStart(anchor);
  return Array.from({ length: GRID_DAYS }, (_, i) => addDays(start, i));
}

/** Los 7 días (domingo a sábado) de la semana de `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function toRange(start: Date, endExclusive: Date): DateRange {
  return { desde: start.toISOString(), hasta: endExclusive.toISOString() };
}

/** Rango de toda la cuadrícula mensual, partido en dos consultas de 21 días (límite de 31 del RPC). */
export function monthGridRanges(anchor: Date): [DateRange, DateRange] {
  const start = monthGridStart(anchor);
  const middle = addDays(start, CHUNK_DAYS);
  const end = addDays(start, GRID_DAYS);
  return [toRange(start, middle), toRange(middle, end)];
}

export function weekRange(anchor: Date): DateRange {
  const start = startOfWeek(anchor);
  return toRange(start, addDays(start, 7));
}

/** Citas que se dibujan: las reagendadas ya tienen una cita sucesora, no se duplican en el calendario. */
export function esCitaVisible(cita: AgendaItem): boolean {
  return cita.estado !== 'reagendada';
}

/** Agrupa por día local (`YYYY-MM-DD`) y ordena cada día por hora. */
export function groupCitasByDay(citas: readonly AgendaItem[]): Map<string, AgendaItem[]> {
  const groups = new Map<string, AgendaItem[]>();
  for (const cita of citas) {
    const key = dayKey(new Date(cita.programadaEn));
    const list = groups.get(key);
    if (list) list.push(cita);
    else groups.set(key, [cita]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => Date.parse(a.programadaEn) - Date.parse(b.programadaEn));
  }
  return groups;
}

/** Copia de `day` a la hora indicada (para precargar el formulario al tocar un hueco). */
export function withTime(day: Date, hour: number, minutes = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minutes);
}

export function formatHora(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Posición de una cita dentro de la columna de un día en la vista semanal. */
export interface WeekCitaLayout {
  cita: AgendaItem;
  /** Minutos desde `WEEK_START_HOUR`, acotados a la rejilla visible. */
  topMinutes: number;
  /** Carril (0..lanes-1) cuando varias citas se traslapan. */
  lane: number;
  lanes: number;
}

const GRID_MINUTES = WEEK_HOURS.length * 60;

/**
 * Coloca las citas de un día en carriles para que las simultáneas queden lado a lado.
 * Una cita antes de las 06:00 se pega arriba y una posterior a las 21:00 abajo.
 */
export function layoutWeekDay(citas: readonly AgendaItem[]): WeekCitaLayout[] {
  const items = citas
    .map((cita) => {
      const date = new Date(cita.programadaEn);
      const minutes = (date.getHours() - WEEK_START_HOUR) * 60 + date.getMinutes();
      const topMinutes = Math.min(Math.max(minutes, 0), GRID_MINUTES - CITA_BLOCK_MINUTES);
      return { cita, topMinutes };
    })
    .sort((a, b) => a.topMinutes - b.topMinutes);

  const result: WeekCitaLayout[] = [];
  let cluster: WeekCitaLayout[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    for (const entry of cluster) entry.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const { cita, topMinutes } of items) {
    if (cluster.length > 0 && topMinutes >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= topMinutes);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = topMinutes + CITA_BLOCK_MINUTES;
    clusterEnd = Math.max(clusterEnd, topMinutes + CITA_BLOCK_MINUTES);
    cluster.push({ cita, topMinutes, lane, lanes: 1 });
  }
  flush();
  return result;
}

const MONTH_TITLE = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
const DAY_MONTH_SHORT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const WEEKDAY_SHORT = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
const WEEKDAY_LONG = new Intl.DateTimeFormat('es-MX', { weekday: 'long' });
const DAY_LONG = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

function cleanShort(text: string): string {
  return text.replace('.', '');
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es-MX') + text.slice(1);
}

/** «Noviembre de 2026». */
export function formatMonthTitle(date: Date): string {
  return capitalize(MONTH_TITLE.format(date));
}

/** «27 sept – 3 oct 2026» (con año en ambos extremos si cruza de año). */
export function formatWeekTitle(days: readonly Date[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  const start = cleanShort(DAY_MONTH_SHORT.format(first));
  const end = cleanShort(DAY_MONTH_SHORT.format(last));
  if (first.getFullYear() !== last.getFullYear()) {
    return `${start} ${first.getFullYear()} – ${end} ${last.getFullYear()}`;
  }
  return `${start} – ${end} ${last.getFullYear()}`;
}

/** «dom» */
export function formatWeekdayShort(date: Date): string {
  return cleanShort(WEEKDAY_SHORT.format(date));
}

/** «domingo 27 de septiembre» (para nombres accesibles). */
export function formatDayLong(date: Date): string {
  return DAY_LONG.format(date);
}

/** Encabezados dom..sáb de la cuadrícula mensual. */
export const WEEKDAY_HEADERS: readonly { short: string; long: string }[] = weekDays(
  new Date(2026, 0, 4),
).map((day) => ({ short: cleanShort(WEEKDAY_SHORT.format(day)), long: WEEKDAY_LONG.format(day) }));

export type CitaTone = 'urgent' | 'confirmed' | 'pending' | 'done' | 'muted';

/** Color semántico de una cita: canceladas/no asistió apagadas, prioridad alta destacada, luego por estado. */
export function citaTone(cita: Pick<AgendaItem, 'estado' | 'prioridad'>): CitaTone {
  if (cita.estado === 'cancelada' || cita.estado === 'no_asistio' || cita.estado === 'reagendada') {
    return 'muted';
  }
  if (cita.estado === 'asistio') return 'done';
  if (cita.prioridad === 'alta') return 'urgent';
  return cita.estado === 'confirmada' ? 'confirmed' : 'pending';
}
