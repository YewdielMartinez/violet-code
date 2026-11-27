/**
 * Estado de asistencia que ve la dependencia UMECA. `get_umeca_citas()` ya lo traduce a cuatro valores
 * (`asistio`, `no_asistio`, `cancelo`, `pendiente`); se aceptan también los estados internos de la cita por si el
 * RPC cambia, para que nunca se muestre una clave cruda al usuario.
 */
import type { PillTone } from '@/shared/ui/table/tableDecorate';

export type AsistenciaUmeca = 'asistio' | 'no_asistio' | 'pendiente' | 'cancelo';

export interface AsistenciaInfo {
  clave: AsistenciaUmeca;
  label: string;
  /** Ícono de Material Symbols (debe estar en `icon_names` de `index.html`). */
  icon: string;
  /** Clases de Tailwind con tokens del tema (claro y oscuro). */
  chipClass: string;
  /** Tono de la cápsula de la tabla (`vc-dt-pill`), el mismo que `chipClass`. */
  tone: PillTone;
}

const INFO: Record<AsistenciaUmeca, AsistenciaInfo> = {
  asistio: {
    clave: 'asistio',
    label: 'Asistió',
    icon: 'event_available',
    chipClass: 'bg-status-success-bg text-status-success',
    tone: 'success',
  },
  no_asistio: {
    clave: 'no_asistio',
    label: 'No asistió',
    icon: 'event_busy',
    chipClass: 'bg-status-danger-bg text-status-danger',
    tone: 'danger',
  },
  pendiente: {
    clave: 'pendiente',
    label: 'Pendiente',
    icon: 'event_upcoming',
    chipClass: 'bg-secondary-container text-on-secondary-container',
    tone: 'info',
  },
  cancelo: {
    clave: 'cancelo',
    label: 'Canceló',
    icon: 'cancel',
    chipClass: 'bg-surface-container-high text-on-surface-variant',
    tone: 'neutral',
  },
};

const ALIAS: Record<string, AsistenciaUmeca> = {
  asistio: 'asistio',
  no_asistio: 'no_asistio',
  pendiente: 'pendiente',
  cancelo: 'cancelo',
  // Estados internos de la cita.
  agendada: 'pendiente',
  confirmada: 'pendiente',
  reagendada: 'pendiente',
  cancelada: 'cancelo',
};

/** Información de presentación de un estado del RPC; lo desconocido se trata como pendiente. */
export function asistenciaInfo(estado: string): AsistenciaInfo {
  return INFO[ALIAS[estado] ?? 'pendiente'];
}

export interface ResumenAsistencia {
  total: number;
  asistio: number;
  no_asistio: number;
  pendiente: number;
  cancelo: number;
}

export function resumenAsistencia(estados: readonly string[]): ResumenAsistencia {
  const resumen: ResumenAsistencia = { total: estados.length, asistio: 0, no_asistio: 0, pendiente: 0, cancelo: 0 };
  for (const estado of estados) resumen[asistenciaInfo(estado).clave] += 1;
  return resumen;
}

export const ASISTENCIA_OPCIONES = Object.values(INFO).map((i) => ({ value: i.clave, label: i.label }));

const FECHA_FMT = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mazatlan',
});

/** «mié, 26 nov 2026, 10:00» (hora de Mazatlán, como el resto de la agenda). */
export function fechaCitaUmeca(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return FECHA_FMT.format(date).replace(/\./g, '');
}

/** Etiqueta del área cuando el RPC no la devuelve (citas anteriores al cambio o dato ausente). */
export const AREA_SIN_DATO = 'Sin área';

const AREA_NOMBRES: Record<string, string> = {
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
};

/** Nombre del área de la cita UMECA: el del RPC; si falta, el de la clave conocida; si no hay nada, «Sin área». */
export function areaUmecaLabel(areaClave: string | null | undefined, areaNombre: string | null | undefined): string {
  const nombre = areaNombre?.trim();
  if (nombre) return nombre;
  if (areaClave) {
    const known = AREA_NOMBRES[areaClave];
    if (known) return known;
    const text = areaClave.replace(/_/g, ' ').trim();
    if (text) return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return AREA_SIN_DATO;
}

/** Opciones del filtro «Área»: las áreas presentes en las citas, sin repetir y en orden alfabético (es-MX). */
export function opcionesArea(areas: readonly string[]): { value: string; label: string }[] {
  return [...new Set(areas)]
    .sort((a, b) => a.localeCompare(b, 'es-MX'))
    .map((area) => ({ value: area, label: area }));
}
