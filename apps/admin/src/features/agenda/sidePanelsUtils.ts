import type { AgendaItem } from '@/domain/models/Cita';

const LOCALE = 'es-MX';

const AREA_LABELS: Record<string, string> = {
  trabajo_social: 'Trabajo social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
};

/** Etiqueta legible de un área a partir de su `clave` (cae a la clave capitalizada si es desconocida). */
export function areaLabel(clave: string): string {
  const known = AREA_LABELS[clave];
  if (known) return known;
  const text = clave.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
}

export interface DiaRango {
  /** Inicio del día (inclusive) en ISO UTC. */
  desde: string;
  /** Inicio del día siguiente (exclusivo) en ISO UTC. */
  hasta: string;
  /** Clave estable `YYYY-MM-DD` (fecha local) para memoizar. */
  key: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Rango [00:00, 24:00) de mañana en hora local del navegador. */
export function tomorrowRange(now: Date = new Date()): DiaRango {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  return {
    desde: start.toISOString(),
    hasta: end.toISOString(),
    key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
  };
}

/** `true` si la fecha ISO cae mañana (hora local). */
export function isTomorrow(iso: string, now: Date = new Date()): boolean {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return false;
  const { desde, hasta } = tomorrowRange(now);
  return time >= Date.parse(desde) && time < Date.parse(hasta);
}

/**
 * Citas de mañana pendientes de confirmar, ordenadas por hora.
 * `AgendaItem` no expone `confirmada_en`: el estado `agendada` es la señal (el RPC
 * `cambiar_estado_cita` lo pasa a `confirmada` y llena `confirmada_en` en el mismo paso).
 */
export function filtrarCitasPorConfirmar(items: readonly AgendaItem[], now: Date = new Date()): AgendaItem[] {
  return items
    .filter((c) => c.estado === 'agendada' && isTomorrow(c.programadaEn, now))
    .sort((a, b) => Date.parse(a.programadaEn) - Date.parse(b.programadaEn));
}

/** Hora local 24 h (`09:30`). */
export function formatHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Etiqueta del día de mañana, p. ej. `mié, 27 nov`. */
export function formatDiaCorto(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}

/** Parsea `YYYY-MM-DD` (o ISO) como fecha local, sin desfase por zona horaria. */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Fecha corta (`12 nov`) de la última prioridad. */
export function formatFechaCorta(value: string): string {
  const d = parseLocalDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Días transcurridos desde la fecha (0 = hoy). */
export function diasDeEspera(value: string, now: Date = new Date()): number | null {
  const d = parseLocalDate(value);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000));
}

export function etiquetaEspera(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'Hoy';
  return days === 1 ? 'Hace 1 día' : `Hace ${days} días`;
}

/** Valor `tel:` o `null` si el celular no tiene dígitos. */
export function telHref(celular: string | null | undefined): string | null {
  if (!celular) return null;
  const clean = celular.replace(/[^\d+]/g, '');
  return clean.replace(/\D/g, '').length >= 7 ? `tel:${clean}` : null;
}
