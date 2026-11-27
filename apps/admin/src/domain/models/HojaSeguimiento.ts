import { type StaffRole, isAttentionRole } from './Auth';
import { areasCreablesPorRol, type AgendaItem, type EstadoCita } from './Cita';
import { type DomicilioDetalle, type DomicilioInput, validateDomicilio } from './Domicilio';
import type { EstadoCivil } from './FichaRegistro';

/** Asistencia que se marca sobre la cita al abrir la hoja de seguimiento (`cita.estado`, `RF-09`). */
export type AsistenciaCita = Extract<EstadoCita, 'asistio' | 'no_asistio'>;

export const ASISTENCIA_LABELS: Record<AsistenciaCita, string> = {
  asistio: 'Asistió',
  no_asistio: 'No asistió',
};

export interface TipoAtencion {
  id: number;
  areaId: number;
  clave: string;
  nombre: string;
}

/** Datos vigentes de la Ficha Única para precargar la copia histórica de la hoja. */
export interface ContextoHojaSeguimiento {
  fichaId: string;
  folio: string;
  personaId: string;
  estadoCivil: EstadoCivil | null;
  ocupacionId: number | null;
  ocupacionOtra: string | null;
  celular: string | null;
  domicilio: DomicilioDetalle | null;
}

/**
 * Copia por sesión de estado civil, ocupación, celular y domicilio (`atencion`):
 * es historial de cómo estaban los datos ese día, no un respaldo de la ficha.
 * `domicilio = null` conserva el domicilio vigente de la persona.
 */
export interface HojaSeguimientoCopia {
  personaId: string;
  estadoCivil: EstadoCivil | null;
  ocupacionId: number | null;
  ocupacionOtra: string | null;
  celular: string | null;
  domicilio: DomicilioInput | null;
}

const CELULAR_REGEX = /^[0-9]{10}$/;
const ESTADOS_PENDIENTES: readonly EstadoCita[] = ['agendada', 'confirmada'];

/** Solo citas agendadas o confirmadas admiten asistencia y hoja (regla de `registrar_seguimiento`). */
export function citaAdmiteHojaSeguimiento(estado: EstadoCita): boolean {
  return ESTADOS_PENDIENTES.includes(estado);
}

/** Trabajo Social, Psicología y Jurídico llenan la hoja; Dirección solo consulta. */
export function puedeRegistrarHojaSeguimiento(role: StaffRole | undefined): boolean {
  return isAttentionRole(role);
}

/**
 * La próxima cita sigue la regla de alta (`areasCreablesPorRol`): Jurídico y Psicología la agendan directo;
 * Trabajo Social no (la agenda Recepción).
 */
export function puedeAgendarProximaCita(role: StaffRole | undefined): boolean {
  return areasCreablesPorRol(role).length > 0;
}

export function domicilioInputDesdeDetalle(detalle: DomicilioDetalle | null): DomicilioInput {
  return {
    asentamientoId: detalle?.asentamientoId ?? null,
    codigoPostalForaneo: detalle?.asentamientoId ? '' : (detalle?.codigoPostal ?? ''),
    calle: detalle?.calle ?? '',
    numeroExterior: detalle?.numeroExterior ?? '',
    numeroInterior: detalle?.numeroInterior ?? '',
    referencias: detalle?.referencias ?? '',
    zona: detalle?.zona ?? 'urbana',
  };
}

export function domicilioModificado(original: DomicilioInput, actual: DomicilioInput): boolean {
  return (Object.keys(original) as (keyof DomicilioInput)[]).some((key) => {
    const a = original[key];
    const b = actual[key];
    return typeof a === 'string' && typeof b === 'string' ? a.trim() !== b.trim() : a !== b;
  });
}

/** Valida la copia histórica antes de guardarla (mismos `CHECK` que `atencion`). */
export function validateHojaCopia(copia: HojaSeguimientoCopia): string | null {
  const celular = copia.celular?.trim() ?? '';
  if (celular && !CELULAR_REGEX.test(celular)) {
    return 'El celular debe tener exactamente 10 dígitos.';
  }
  if ((copia.ocupacionOtra?.trim().length ?? 0) > 150) {
    return 'La especificación de ocupación no puede exceder 150 caracteres.';
  }
  return copia.domicilio ? validateDomicilio(copia.domicilio) : null;
}

const MAZATLAN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mazatlan',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function shiftIsoDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Rango de agenda de la pantalla: últimos `diasAtras` días hasta el fin de mañana (hora de Mazatlán). */
export function rangoAgendaIntervenciones(now: Date, diasAtras = 7, diasAdelante = 1) {
  const hoy = MAZATLAN_DATE_FMT.format(now);
  return {
    desde: `${shiftIsoDate(hoy, -diasAtras)}T00:00:00-07:00`,
    hasta: `${shiftIsoDate(hoy, diasAdelante)}T23:59:59-07:00`,
  };
}

/** Pendientes primero (más próximas arriba); luego las ya resueltas, de la más reciente a la más antigua. */
export function ordenarCitasIntervencion(items: readonly AgendaItem[]): AgendaItem[] {
  return [...items].sort((a, b) => {
    const pa = citaAdmiteHojaSeguimiento(a.estado);
    const pb = citaAdmiteHojaSeguimiento(b.estado);
    if (pa !== pb) return pa ? -1 : 1;
    const diff = Date.parse(a.programadaEn) - Date.parse(b.programadaEn);
    return pa ? diff : -diff;
  });
}
