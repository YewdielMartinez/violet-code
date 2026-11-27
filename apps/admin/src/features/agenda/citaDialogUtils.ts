import type { StaffRole } from '@/domain/models/Auth';
import { isSupervisor } from '@/domain/models/Auth';
import {
  validarTransicionCita,
  type AgendaItem,
  type EstadoCita,
  type EstadoCitaGestionable,
  type PrioridadNivel,
} from '@/domain/models/Cita';
import { citaAdmiteHojaSeguimiento, puedeRegistrarHojaSeguimiento } from '@/domain/models/HojaSeguimiento';
import type { CatalogoItem } from '@/domain/models/FichaRegistro';
import { areasCreablesPorRol, puedeCrearEnArea } from './agendaPermisos';
import { RECEPCION_CLAVES } from './agendaScope';

/** Vista interna del diálogo (superconjunto de `CitaDialogState`: añade la hoja y la precarga de persona). */
export type CitaView =
  | { kind: 'dia'; fecha: Date; citas: AgendaItem[] }
  | { kind: 'crear'; fecha: Date; areaId?: number | null; persona?: PersonaSeleccion | null }
  | { kind: 'detalle'; cita: AgendaItem }
  | { kind: 'seguimiento'; cita: AgendaItem };

export interface PersonaSeleccion {
  id: string;
  nombre: string;
}

export const AREA_LABELS: Record<string, string> = {
  trabajo_social: 'Trabajo Social',
  psicologia: 'Psicología',
  juridico: 'Jurídico',
};

export function areaNombre(clave: string): string {
  const known = AREA_LABELS[clave];
  if (known) return known;
  const text = clave.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
}

export const ORIGEN_LABELS: Record<AgendaItem['origen'], string> = {
  regular: 'Regular',
  umeca: 'UMECA (asistencia obligatoria)',
};

/** Texto de la insignia UMECA (mujeres con asistencia ordenada por un juzgado). */
export const UMECA_BADGE_LABEL = 'UMECA · asistencia obligatoria';

/** `true` si la cita es de origen UMECA (asistencia obligatoria). */
export function esCitaUmeca(cita: Pick<AgendaItem, 'origen'>): boolean {
  return cita.origen === 'umeca';
}

export const PRIORIDADES: readonly PrioridadNivel[] = ['alta', 'media', 'baja'];

const DIA_FMT = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const FECHA_LARGA_FMT = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Mazatlan',
});

function capitalizar(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** «Jueves 26 de noviembre» a partir del día local de la agenda. */
export function tituloDia(fecha: Date): string {
  const parts = DIA_FMT.formatToParts(fecha);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${capitalizar(pick('weekday'))} ${pick('day')} de ${pick('month')}`;
}

/** «Jueves 26 de noviembre de 2026» para una fecha ISO de cita (hora de Mazatlán). */
export function fechaLargaCita(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return capitalizar(FECHA_LARGA_FMT.format(date).replace(',', ''));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Convierte la hora de pared elegida en el selector a ISO con el desfase fijo de Mazatlán (UTC-7, sin horario
 * de verano), igual que la hoja de seguimiento. Evita depender de la zona horaria del navegador.
 */
export function aIsoMazatlan(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00-07:00`
  );
}

/** Fecha de pared inicial del formulario: conserva la hora si el recuadro la traía; si no, 09:00. */
export function fechaInicialCita(fecha: Date): Date {
  const hasTime = fecha.getHours() !== 0 || fecha.getMinutes() !== 0;
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hasTime ? fecha.getHours() : 9, hasTime ? fecha.getMinutes() : 0);
}

/** Mensaje legible de un error de Supabase/PostgREST (los `RAISE` del backend ya vienen en español). */
export function mensajeError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: string; message?: unknown };
    if (code === '42501') return 'Tu rol o área no tiene permiso para esta acción.';
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/**
 * Áreas en las que el rol puede agendar (regla única en `agendaPermisos`): Recepción en Trabajo Social, Psicología y
 * Jurídico; Jurídico solo en Jurídico; el resto de los roles, ninguna.
 */
export function areasPermitidas(role: StaffRole | undefined, catalogo: readonly CatalogoItem[]): CatalogoItem[] {
  const claves = areasCreablesPorRol(role);
  return catalogo.filter((a) => claves.includes(a.clave));
}

/** Espejo de `cambiar_estado_cita` / `reagendar_cita`: qué citas puede gestionar cada rol. */
export function puedeGestionarCita(
  role: StaffRole | undefined,
  userAreaId: number | null | undefined,
  cita: Pick<AgendaItem, 'areaId' | 'areaClave'>,
): boolean {
  if (!role) return false;
  if (isSupervisor(role)) return true;
  if (role === 'recepcion') return (RECEPCION_CLAVES as readonly string[]).includes(cita.areaClave);
  if (role === 'trabajo_social' || role === 'psicologia' || role === 'juridico') {
    return cita.areaId === userAreaId;
  }
  return false;
}

export interface AccionesCita {
  confirmar: boolean;
  /** Abre la hoja de seguimiento: `registrar_seguimiento` marca la cita como «asistió» (no se llama dos veces). */
  asistio: boolean;
  noAsistio: boolean;
  cancelar: boolean;
  reagendar: boolean;
  /** Tras la sesión: solo Jurídico agenda directo la siguiente cita (`RN-04`). */
  agendarSiguiente: boolean;
}

/** Botones visibles de una cita según su estado, el rol y el área de la persona usuaria. */
export function accionesDisponibles(
  cita: Pick<AgendaItem, 'estado' | 'areaId' | 'areaClave'>,
  role: StaffRole | undefined,
  userAreaId: number | null | undefined,
): AccionesCita {
  const gestiona = puedeGestionarCita(role, userAreaId, cita);
  const valida = (siguiente: EstadoCitaGestionable) => gestiona && validarTransicionCita(cita.estado, siguiente) === null;
  const registraHoja =
    gestiona &&
    puedeRegistrarHojaSeguimiento(role) &&
    cita.areaId === userAreaId &&
    citaAdmiteHojaSeguimiento(cita.estado);

  return {
    confirmar: valida('confirmada'),
    asistio: registraHoja,
    noAsistio: valida('no_asistio'),
    cancelar: valida('cancelada'),
    // Reagendar crea una cita nueva: sigue la misma regla de alta (solo Recepción y Jurídico, en sus áreas).
    reagendar: gestiona && citaAdmiteHojaSeguimiento(cita.estado) && puedeCrearEnArea(role, cita.areaClave),
    agendarSiguiente:
      role === 'juridico' &&
      cita.estado === 'asistio' &&
      cita.areaId === userAreaId &&
      puedeCrearEnArea(role, cita.areaClave),
  };
}

export const ESTADO_CHIP_CLASS: Record<EstadoCita, string> = {
  agendada: 'bg-surface-container-high text-on-surface-variant',
  confirmada: 'bg-status-info-bg text-status-info',
  asistio: 'bg-status-success-bg text-status-success',
  no_asistio: 'bg-status-warning-bg text-status-warning',
  cancelada: 'bg-status-danger-bg text-status-danger',
  reagendada: 'bg-secondary-container text-on-secondary-container',
};

/** Ordena las citas de un día por hora. */
export function ordenarPorHora(citas: readonly AgendaItem[]): AgendaItem[] {
  return [...citas].sort((a, b) => Date.parse(a.programadaEn) - Date.parse(b.programadaEn));
}

/** Firma estable del estado de entrada: el diálogo reinicia su navegación solo cuando cambia (no por identidad). */
export function firmaEstado(state: { kind: string; fecha?: Date; cita?: AgendaItem }): string {
  return `${state.kind}|${state.fecha?.getTime() ?? ''}|${state.cita?.citaId ?? ''}`;
}

const PARTES_MAZATLAN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mazatlan',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Hora de pared en Mazatlán de un instante ISO, como `Date` «local» (lo que espera el selector de fecha y hora). */
export function fechaPared(iso: string): Date | null {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  const parts = PARTES_MAZATLAN.formatToParts(instante);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
}

/** Propuesta para reagendar: la misma hora de la cita, una semana después (o el primer día futuro). */
export function propuestaReagendar(iso: string, ahora: Date = new Date()): Date {
  const base = fechaPared(iso) ?? ahora;
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7, base.getHours(), base.getMinutes());
  while (next.getTime() <= ahora.getTime()) next.setDate(next.getDate() + 7);
  return next;
}

/** Dirección de la animación de entrada de una vista: `none` en la primera (la apertura ya es el morph del kit). */
export type CitaDir = 'forward' | 'back' | 'none';

const HORA_PARTES_FMT = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Mazatlan',
});

/** Hora compacta para la insignia de la lista: «08:02» y, aparte, «a.m.» / «p.m.» (hora de Mazatlán). */
export function partesHora(iso: string): { hora: string; periodo: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { hora: iso, periodo: '' };
  const parts = HORA_PARTES_FMT.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const periodo = pick('dayPeriod')
    .toLowerCase()
    .replace(/[\s  ]/g, '');
  return { hora: `${pick('hour')}:${pick('minute')}`, periodo };
}

/** Inicial para el avatar de la persona («Ana López» → «A»). */
export function inicialNombre(nombre: string): string {
  const first = nombre.trim().charAt(0);
  return first ? first.toLocaleUpperCase('es-MX') : '?';
}
