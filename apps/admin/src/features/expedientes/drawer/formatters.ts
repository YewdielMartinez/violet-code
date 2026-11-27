import type { SexoBiologico } from '@/domain/models/Persona';

const BIRTH_DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const FECHA_CORTA_FMT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const RELATIVE_FMT = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

const RELATIVE_UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 86_400_000 },
  { unit: 'month', ms: 30 * 86_400_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
];

/** Fecha legible (`20 nov 2026`) a partir de un instante ISO; `null` si no es válida. */
export function formatFechaCorta(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : FECHA_CORTA_FMT.format(date).replace(/\./g, '');
}

/** Tiempo transcurrido en español («hace 3 días», «ayer»); `null` si la fecha no es válida. */
export function formatTiempoRelativo(iso: string, now = Date.now()): string | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;

  const diff = time - now;
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return RELATIVE_FMT.format(Math.round(diff / ms), unit);
  }
  return 'hace un momento';
}

function parseIsoCalendarDate(raw: string): { year: number; month: number; day: number } | null {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);

  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/** Calcula edad cumplida en años a partir de `YYYY-MM-DD` sin desfase por zona horaria. */
export function calculateAge(fechaNacimiento: string, now = new Date()): number | null {
  const parts = parseIsoCalendarDate(fechaNacimiento);
  if (!parts) return null;

  let age = now.getFullYear() - parts.year;
  const currentMonth = now.getMonth() + 1;
  if (
    currentMonth < parts.month ||
    (currentMonth === parts.month && now.getDate() < parts.day)
  ) {
    age -= 1;
  }

  if (age < 0 || age > 130) return null;
  return age;
}

export function formatFechaNacimiento(fechaNacimiento: string): string {
  const parts = parseIsoCalendarDate(fechaNacimiento);
  if (!parts) return 'Sin registrar';

  return BIRTH_DATE_FMT.format(new Date(parts.year, parts.month - 1, parts.day));
}

export function formatSexo(sexo: SexoBiologico): string {
  return sexo === 'M' ? 'Femenino' : 'Masculino';
}

export function formatPhoneDisplay(celular: string | null): string | null {
  const trimmed = celular?.trim() ?? '';
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return trimmed;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
