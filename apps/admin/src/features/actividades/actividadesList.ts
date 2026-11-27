import type {
  ActividadPreventivaFilters,
  ActividadPreventivaItem,
  EstadoActividad,
  TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';

/** Tope del RPC `get_actividades_preventivas` (`p_limite` 1..200). */
export const ACTIVIDADES_LIMITE = 200;

export type ActividadTab = 'pendientes' | 'realizadas' | 'canceladas' | 'todas';

/** Estado que pide cada pestaña al servidor (`p_estado`); «Todas» no filtra. */
export const TAB_ESTADO: Record<ActividadTab, EstadoActividad | null> = {
  pendientes: 'pendiente',
  realizadas: 'realizada',
  canceladas: 'cancelada',
  todas: null,
};

export interface ActividadListFilters {
  tab: ActividadTab;
  /** `YYYY-MM-DD` (día de Mazatlán) o vacío. */
  desde: string;
  hasta: string;
  tipoInstitucion: TipoInstitucionActividad | '';
}

export const FILTROS_INICIALES: ActividadListFilters = {
  tab: 'pendientes',
  desde: '',
  hasta: '',
  tipoInstitucion: '',
};

const TZ = 'America/Mazatlan';
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const LONG_DAY_YEAR_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const SHORT_DATE_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
const TIME_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function capitalizar(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Llave `YYYY-MM-DD` del día en hora de Mazatlán (no depende de la zona del navegador). */
export function diaMazatlan(iso: string | Date): string {
  return DAY_FMT.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** «04 dic 2026» (día de Mazatlán) para la tabla. */
export function fechaCortaActividad(iso: string): string {
  return SHORT_DATE_FMT.format(new Date(iso)).replace(/\./g, '');
}

/** Hora de pared de Mazatlán en 24 h («09:30»). */
export function horaActividad(iso: string): string {
  return TIME_FMT.format(new Date(iso));
}

/** «Jueves 26 de noviembre de 2026» para el detalle. */
export function fechaLargaActividad(iso: string): string {
  return capitalizar(LONG_DAY_YEAR_FMT.format(new Date(iso)).replace(',', ''));
}

/** Convierte la hora de pared elegida a ISO con el desfase fijo de Mazatlán (UTC-7, sin horario de verano). */
export function aIsoMazatlan(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00-07:00`
  );
}

/** Inversa de `aIsoMazatlan`: la fecha cuya hora de pared (del navegador) es la que marcaba el reloj de Mazatlán en `iso`. */
export function deIsoMazatlan(iso: string): Date {
  const wall = new Date(new Date(iso).getTime() - 7 * 60 * 60 * 1000);
  return new Date(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes());
}

/** Mensaje legible de un error de Supabase (los `RAISE` del backend ya vienen en español). */
export function mensajeError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: string; message?: unknown };
    if (code === '42501') return 'Tu rol no tiene permiso para esta acción.';
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/**
 * Parámetros del RPC: el estado de la pestaña (`p_estado`) y el rango de fechas elegido (día de Mazatlán).
 * Devuelve `null` si el rango no puede contener resultados (evita el error `p_desde > p_hasta` del RPC).
 */
export function construirFiltrosServidor(filtros: ActividadListFilters): ActividadPreventivaFilters | null {
  const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00-07:00`).getTime() : null;
  const hasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59.999-07:00`).getTime() : null;
  if ((desde !== null && Number.isNaN(desde)) || (hasta !== null && Number.isNaN(hasta))) return null;
  if (desde !== null && hasta !== null && desde > hasta) return null;
  return {
    desde: desde === null ? null : new Date(desde).toISOString(),
    hasta: hasta === null ? null : new Date(hasta).toISOString(),
    estado: TAB_ESTADO[filtros.tab],
    limite: ACTIVIDADES_LIMITE,
  };
}

/**
 * Tipo de institución y coherencia con la pestaña (un cambio de estado optimista
 * saca la actividad de la pestaña actual antes de que llegue la respuesta del servidor).
 */
export function filtrarActividades(
  items: readonly ActividadPreventivaItem[],
  filtros: ActividadListFilters,
): ActividadPreventivaItem[] {
  const estadoBuscado = TAB_ESTADO[filtros.tab];
  return items.filter((item) => {
    if (estadoBuscado && item.estado !== estadoBuscado) return false;
    if (filtros.tipoInstitucion && item.tipoInstitucion !== filtros.tipoInstitucion) return false;
    return true;
  });
}

const ORDEN_ESTADO: Record<EstadoActividad, number> = { pendiente: 0, realizada: 1, cancelada: 2 };

/**
 * Orden por defecto de la tabla: primero lo pendiente, de lo más próximo a lo más lejano (las vencidas, por cerrar,
 * quedan arriba); después lo realizado y lo cancelado, de lo más reciente a lo más antiguo.
 */
export function ordenarActividades(items: readonly ActividadPreventivaItem[]): ActividadPreventivaItem[] {
  const tiempo = (item: ActividadPreventivaItem) => new Date(item.programadaEn).getTime();
  return [...items].sort((x, y) => {
    if (x.estado !== y.estado) return ORDEN_ESTADO[x.estado] - ORDEN_ESTADO[y.estado];
    return x.estado === 'pendiente' ? tiempo(x) - tiempo(y) : tiempo(y) - tiempo(x);
  });
}

/** «Colonia, Municipio» (lo que haya) de la actividad, o `null`. */
export function ubicacionActividad(item: Pick<ActividadPreventivaItem, 'asentamientoNombre' | 'municipio'>): string | null {
  const partes = [item.asentamientoNombre, item.municipio].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}

/** ¿Hay algún filtro aparte de la pestaña (institución o rango de fechas)? */
export function hayFiltrosActivos(filtros: ActividadListFilters): boolean {
  return filtros.tipoInstitucion !== '' || filtros.desde !== '' || filtros.hasta !== '';
}
