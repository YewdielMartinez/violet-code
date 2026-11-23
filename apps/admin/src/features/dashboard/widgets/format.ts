/** Formato de fechas y horas del dashboard (es-MX). */
const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

/** "hace 5 minutos", "ayer"… */
export function relativeTime(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

/** Fecha local yyyy-MM-dd. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Hoy a las 10:00", "Mañana a las 9:30" o "mié 18 a las 11:00". */
export function dayAndTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  const day =
    days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
  return `${day} a las ${timeOf(iso)}`;
}
