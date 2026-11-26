import type { EstadoFicha, SexoBiologico } from '@/domain/models/Persona';

const BIRTH_DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const ESTADO_BADGE_STYLES: Record<EstadoFicha, { pill: string; dot: string }> = {
  abierto: {
    pill: 'bg-primary text-on-primary',
    dot: 'bg-on-primary',
  },
  en_seguimiento: {
    pill: 'bg-status-info-bg text-status-info',
    dot: 'bg-status-info',
  },
  cerrado: {
    pill: 'bg-surface-container-high text-on-surface-variant',
    dot: 'bg-on-surface-variant',
  },
  archivado: {
    pill: 'bg-status-warning-bg text-status-warning',
    dot: 'bg-status-warning',
  },
};

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
