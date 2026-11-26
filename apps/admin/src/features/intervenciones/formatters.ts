const DATE_TIME_FMT = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mazatlan',
});

const TIME_FMT = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Mazatlan',
});

const DAY_FMT = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Mazatlan',
});

function safe(iso: string, fmt: Intl.DateTimeFormat): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : fmt.format(date);
}

export const formatFechaHora = (iso: string) => safe(iso, DATE_TIME_FMT);
export const formatHora = (iso: string) => safe(iso, TIME_FMT);
export const formatDia = (iso: string) => safe(iso, DAY_FMT);
