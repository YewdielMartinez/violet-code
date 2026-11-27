import type { Database } from '@/infrastructure/supabase/database.types';
import { isAttentionRole, isSupervisor, type StaffRole } from './Auth';

export type EstadoOrdenProteccion = Database['public']['Enums']['estado_orden_proteccion'];

export const ESTADOS_ORDEN_PROTECCION: readonly EstadoOrdenProteccion[] = [
  'vigente',
  'en_tramite',
  'vencida',
  'cancelada',
];

export const ESTADO_ORDEN_LABELS: Record<EstadoOrdenProteccion, string> = {
  vigente: 'Vigente',
  en_tramite: 'En trámite',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

export const NUMERO_OFICIO_MAX_LENGTH = 80;
export const AUTORIDAD_EMISORA_MAX_LENGTH = 150;

const ESTADO_SET = new Set<string>(ESTADOS_ORDEN_PROTECCION);
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const WRITE_ROLES: readonly StaffRole[] = [
  'titular',
  'subdireccion',
  'juridico',
  'trabajo_social',
];

export interface OrdenProteccion {
  id: string;
  fichaId: string;
  agresorId: string | null;
  numeroOficio: string | null;
  autoridadEmisora: string | null;
  fechaEmision: string;
  fechaVigencia: string | null;
  estado: EstadoOrdenProteccion;
  /** Calculado a partir de `activo`, `estado === 'vigente'` y `fechaVigencia`. */
  vigente: boolean;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface OrdenProteccionInput {
  fichaId: string;
  agresorId?: string | null;
  numeroOficio: string;
  autoridadEmisora: string;
  fechaEmision: string;
  fechaVigencia?: string | null;
  estado: EstadoOrdenProteccion;
  /** Marca temporal leída al abrir el registro para bloqueo optimista en actualizaciones. */
  actualizadoEnEsperado?: string;
}

export type OrdenProteccionValidationField =
  | 'fichaId'
  | 'numeroOficio'
  | 'autoridadEmisora'
  | 'fechaEmision'
  | 'fechaVigencia'
  | 'estado';

export interface ValidacionOrdenProteccionResult {
  valido: boolean;
  errores: Partial<Record<OrdenProteccionValidationField, string>>;
}

/**
 * Permiso `expediente.ver` (`07_rls.sql`): Dirección y áreas de atención pueden consultar órdenes.
 * `recepcion` y `umeca` NO tienen acceso.
 */
export function puedeVerOrdenesProteccion(rol: StaffRole | undefined | null): boolean {
  if (!rol) return false;
  return isSupervisor(rol) || isAttentionRole(rol);
}

/**
 * Permiso `orden_proteccion.escribir` (`07_rls.sql` / `15_permisos_rbac_abac.sql`):
 * Dirección (`titular`, `subdireccion`), `juridico` y `trabajo_social`.
 */
export function puedeEscribirOrdenesProteccion(rol: StaffRole | undefined | null): boolean {
  return rol !== undefined && rol !== null && WRITE_ROLES.includes(rol);
}

/**
 * Devuelve la fecha operativa actual (`YYYY-MM-DD`) en la zona horaria de Ahome, Sinaloa
 * (`America/Mazatlan`), evitando desfases por UTC.
 */
export function fechaHoyLocalMazatlan(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mazatlan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Determina si una orden de protección está vigente hoy (`RF-17`, `RN-17`),
 * replicando la lógica de `public.tiene_orden_vigente()` en PostgreSQL:
 * `activo && estado === 'vigente' && (!fechaVigencia || fechaVigencia >= fechaReferencia)`.
 */
export function esOrdenVigente(
  orden: Pick<OrdenProteccion, 'estado' | 'fechaVigencia' | 'activo'>,
  fechaReferencia: string = fechaHoyLocalMazatlan(),
): boolean {
  if (!orden.activo || orden.estado !== 'vigente') {
    return false;
  }
  if (!orden.fechaVigencia) {
    return true;
  }
  return orden.fechaVigencia >= fechaReferencia;
}

function esFechaIsoValida(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Validaciones puras de Orden de Protección (`RF-17`, `04_ficha.sql`). */
export function validarOrdenProteccion(
  input: OrdenProteccionInput,
): ValidacionOrdenProteccionResult {
  const errores: Partial<Record<OrdenProteccionValidationField, string>> = {};

  if (!input.fichaId?.trim()) {
    errores.fichaId = 'La ficha del expediente es obligatoria.';
  }

  const oficio = input.numeroOficio?.trim() ?? '';
  if (!oficio) {
    errores.numeroOficio = 'El número de oficio es obligatorio.';
  } else if (oficio.length > NUMERO_OFICIO_MAX_LENGTH) {
    errores.numeroOficio = `El número de oficio no puede exceder ${NUMERO_OFICIO_MAX_LENGTH} caracteres.`;
  }

  const autoridad = input.autoridadEmisora?.trim() ?? '';
  if (!autoridad) {
    errores.autoridadEmisora = 'La autoridad emisora es obligatoria.';
  } else if (autoridad.length > AUTORIDAD_EMISORA_MAX_LENGTH) {
    errores.autoridadEmisora = `La autoridad emisora no puede exceder ${AUTORIDAD_EMISORA_MAX_LENGTH} caracteres.`;
  }

  const fechaEmision = input.fechaEmision?.trim() ?? '';
  const emisionValida = esFechaIsoValida(fechaEmision);
  if (!fechaEmision) {
    errores.fechaEmision = 'La fecha de emisión es obligatoria.';
  } else if (!emisionValida) {
    errores.fechaEmision = 'La fecha de emisión debe tener formato AAAA-MM-DD válido.';
  }

  const fechaVigencia = input.fechaVigencia?.trim() ?? '';
  if (fechaVigencia) {
    if (!esFechaIsoValida(fechaVigencia)) {
      errores.fechaVigencia = 'La fecha de vigencia debe tener formato AAAA-MM-DD válido.';
    } else if (emisionValida && fechaVigencia < fechaEmision) {
      errores.fechaVigencia = 'La fecha de vigencia no puede ser anterior a la fecha de emisión.';
    }
  }

  if (!ESTADO_SET.has(input.estado)) {
    errores.estado = 'Selecciona un estado válido para la orden de protección.';
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
  };
}
