import type { CanalizacionEvento, DerivacionItem } from '@/domain/models/Derivacion';

const TZ = 'America/Mazatlan';
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const DATE_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...DATE_OPTS });
const DATE_UTC_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', ...DATE_OPTS });
const TIME_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Fecha sin hora (YYYY-MM-DD, tipo date de Postgres), sin desfase por zona horaria. */
export function formatDiaCalendario(value: string): string {
  if (!value) return '—';
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? value : DATE_UTC_FMT.format(d);
}

/** Marca de tiempo ISO con fecha y hora locales de Mazatlán. */
export function formatMomento(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${DATE_FMT.format(d)}, ${TIME_FMT.format(d)} h`;
}

/** Título de la tarjeta: área o institución de destino; si no hay, la etiqueta del destino. */
export function nombreDestino(d: DerivacionItem, fallback: string): string {
  return d.areaDestinoNombre ?? d.institucionNombre ?? d.institucionOtra ?? fallback;
}

/** Eventos de estado ordenados del más antiguo al más reciente. */
export function ordenarEventos(eventos: readonly CanalizacionEvento[]): CanalizacionEvento[] {
  return [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
