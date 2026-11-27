import {
  estadoActividad,
  type ActividadPreventivaFilters,
  type ActividadPreventivaItem,
  type EstadoActividad,
  type TipoInstitucionActividad,
} from '@/domain/models/ActividadPreventiva';

/** Tope del RPC `get_actividades_preventivas` (`p_limite` 1..200). */
export const ACTIVIDADES_LIMITE = 200;

export type ActividadTab = 'pendientes' | 'realizadas' | 'todas';

export interface ActividadListFilters {
  tab: ActividadTab;
  /** `YYYY-MM-DD` (día de Mazatlán) o vacío. */
  desde: string;
  hasta: string;
  busqueda: string;
  tipoInstitucion: TipoInstitucionActividad | '';
}

export const FILTROS_INICIALES: ActividadListFilters = {
  tab: 'pendientes',
  desde: '',
  hasta: '',
  busqueda: '',
  tipoInstitucion: '',
};

const TZ = 'America/Mazatlan';
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const LONG_DAY_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const LONG_DAY_YEAR_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const MONTH_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, month: 'short' });
const DAY_NUM_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric' });
const TIME_FMT = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function capitalizar(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Llave `YYYY-MM-DD` del día en hora de Mazatlán (no depende de la zona del navegador). */
export function diaMazatlan(iso: string | Date): string {
  return DAY_FMT.format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function diaNumero(iso: string): string {
  return DAY_NUM_FMT.format(new Date(iso));
}

export function mesCorto(iso: string): string {
  return MONTH_FMT.format(new Date(iso)).replace('.', '');
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
 * Parámetros del RPC según la pestaña y el rango. «Pendientes» pide desde ahora; «Realizadas» hasta ahora.
 * Devuelve `null` si el rango elegido no puede contener resultados (evita el error `p_desde > p_hasta` del RPC).
 */
export function construirFiltrosServidor(filtros: ActividadListFilters, ahora: Date): ActividadPreventivaFilters | null {
  const ahoraMs = ahora.getTime();
  let desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00-07:00`).getTime() : null;
  let hasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59.999-07:00`).getTime() : null;
  if (filtros.tab === 'pendientes') desde = desde === null ? ahoraMs : Math.max(desde, ahoraMs);
  if (filtros.tab === 'realizadas') hasta = hasta === null ? ahoraMs : Math.min(hasta, ahoraMs);
  if ((desde !== null && Number.isNaN(desde)) || (hasta !== null && Number.isNaN(hasta))) return null;
  if (desde !== null && hasta !== null && desde > hasta) return null;
  return {
    desde: desde === null ? null : new Date(desde).toISOString(),
    hasta: hasta === null ? null : new Date(hasta).toISOString(),
    limite: ACTIVIDADES_LIMITE,
  };
}

function normalizar(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function textoBusqueda(item: ActividadPreventivaItem): string {
  return normalizar(
    [item.titulo, item.sede, item.direccion, item.asentamientoNombre, item.municipio, item.tipoActividadNombre]
      .filter(Boolean)
      .join(' '),
  );
}

/** Búsqueda por institución/lugar, tipo de institución y coherencia con la pestaña (el reloj pudo cruzar el borde). */
export function filtrarActividades(
  items: readonly ActividadPreventivaItem[],
  filtros: ActividadListFilters,
  ahora: Date,
): ActividadPreventivaItem[] {
  const termino = normalizar(filtros.busqueda);
  const estadoBuscado: EstadoActividad | null =
    filtros.tab === 'pendientes' ? 'pendiente' : filtros.tab === 'realizadas' ? 'realizada' : null;
  return items.filter((item) => {
    if (estadoBuscado && estadoActividad(item, ahora) !== estadoBuscado) return false;
    if (filtros.tipoInstitucion && item.tipoInstitucion !== filtros.tipoInstitucion) return false;
    return !termino || textoBusqueda(item).includes(termino);
  });
}

export interface ActividadGrupoDia {
  key: string;
  estado: EstadoActividad;
  /** «Hoy», «Mañana» o fecha larga. */
  etiqueta: string;
  items: ActividadPreventivaItem[];
}

function etiquetaDia(dia: string, iso: string, ahora: Date): string {
  const hoy = diaMazatlan(ahora);
  if (dia === hoy) return 'Hoy';
  if (dia === diaMazatlan(new Date(ahora.getTime() + 24 * 3_600_000))) return 'Mañana';
  const mismoAnio = dia.slice(0, 4) === hoy.slice(0, 4);
  const texto = (mismoAnio ? LONG_DAY_FMT : LONG_DAY_YEAR_FMT).format(new Date(iso)).replace(',', '');
  return capitalizar(texto);
}

/**
 * Agrupa por día (Mazatlán): primero lo pendiente, de lo más próximo a lo más lejano; después lo realizado,
 * de lo más reciente a lo más antiguo. Dentro de cada día, por hora.
 */
export function agruparActividadesPorDia(items: readonly ActividadPreventivaItem[], ahora: Date): ActividadGrupoDia[] {
  const grupos = new Map<string, ActividadGrupoDia>();
  for (const item of items) {
    const dia = diaMazatlan(item.programadaEn);
    const estado = estadoActividad(item, ahora);
    const key = `${estado}:${dia}`;
    const grupo = grupos.get(key);
    if (grupo) grupo.items.push(item);
    else grupos.set(key, { key, estado, etiqueta: etiquetaDia(dia, item.programadaEn, ahora), items: [item] });
  }
  const lista = [...grupos.values()];
  for (const grupo of lista) {
    grupo.items.sort((a, b) => new Date(a.programadaEn).getTime() - new Date(b.programadaEn).getTime());
  }
  const inicio = (g: ActividadGrupoDia) => new Date(g.items[0].programadaEn).getTime();
  const pendientes = lista.filter((g) => g.estado === 'pendiente').sort((a, b) => inicio(a) - inicio(b));
  const realizadas = lista.filter((g) => g.estado === 'realizada').sort((a, b) => inicio(b) - inicio(a));
  return [...pendientes, ...realizadas];
}

/** «Colonia, Municipio» (lo que haya) de la actividad, o `null`. */
export function ubicacionActividad(item: Pick<ActividadPreventivaItem, 'asentamientoNombre' | 'municipio'>): string | null {
  const partes = [item.asentamientoNombre, item.municipio].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}
