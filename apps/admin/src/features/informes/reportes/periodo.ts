/** Periodos de Estadísticas: mensual, anual o rango de fechas. Todo en fechas locales `YYYY-MM-DD` (sin zonas horarias). */

export type PeriodoModo = 'mensual' | 'anual' | 'rango';

export interface Periodo {
  modo: PeriodoModo;
  anio: number;
  /** 1-12 (solo se usa en modo mensual). */
  mes: number;
  /** `YYYY-MM-DD` (solo en modo rango). */
  desde: string;
  hasta: string;
}

export interface Rango {
  desde: string;
  hasta: string;
}

/** Máximo que acepta `get_reporte` (1830 días ≈ 5 años). */
export const MAX_DIAS_RANGO = 1830;

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function utcDay(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUtcDay(ms: number): string {
  const date = new Date(ms);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

const DAY_MS = 86_400_000;

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Número de días del rango, ambos extremos incluidos. */
export function diasEnRango(rango: Rango): number {
  return Math.round((utcDay(rango.hasta) - utcDay(rango.desde)) / DAY_MS) + 1;
}

export function esFecha(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(utcDay(value));
}

/** Rango listo para consultar: fechas completas, `desde <= hasta` y no más de 5 años. */
export function rangoValido(rango: Rango): boolean {
  if (!esFecha(rango.desde) || !esFecha(rango.hasta)) return false;
  const dias = diasEnRango(rango);
  return dias >= 1 && dias <= MAX_DIAS_RANGO;
}

function mesDe(year: number, month: number): Rango {
  return { desde: isoDate(year, month, 1), hasta: isoDate(year, month, lastDayOfMonth(year, month)) };
}

/** Periodo inicial: el mes de `now` (en modo rango, del día 1 a hoy). */
export function periodoInicial(now: Date): Periodo {
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;
  return {
    modo: 'mensual',
    anio,
    mes,
    desde: isoDate(anio, mes, 1),
    hasta: isoDate(anio, mes, now.getDate()),
  };
}

/** Rango de fechas que cubre el periodo elegido. */
export function rangoDePeriodo(p: Periodo): Rango {
  if (p.modo === 'anual') return { desde: isoDate(p.anio, 1, 1), hasta: isoDate(p.anio, 12, 31) };
  if (p.modo === 'rango') return { desde: p.desde, hasta: p.hasta };
  return mesDe(p.anio, p.mes);
}

/** Periodo inmediato anterior de la misma duración (mes anterior, año anterior o los mismos días antes del rango). */
export function rangoAnterior(p: Periodo): Rango {
  if (p.modo === 'anual') return { desde: isoDate(p.anio - 1, 1, 1), hasta: isoDate(p.anio - 1, 12, 31) };
  if (p.modo === 'mensual') {
    const mes = p.mes === 1 ? 12 : p.mes - 1;
    return mesDe(p.mes === 1 ? p.anio - 1 : p.anio, mes);
  }
  const dias = diasEnRango({ desde: p.desde, hasta: p.hasta });
  const hasta = utcDay(p.desde) - DAY_MS;
  return { desde: fromUtcDay(hasta - (dias - 1) * DAY_MS), hasta: fromUtcDay(hasta) };
}

/** Ventana de la tendencia mensual: 12 meses que terminan en el mes elegido, el año completo, o el rango. */
export function rangoTendencia(p: Periodo): Rango {
  if (p.modo === 'mensual') {
    const inicioAnio = p.mes === 12 ? p.anio : p.anio - 1;
    const inicioMes = p.mes === 12 ? 1 : p.mes + 1;
    return { desde: isoDate(inicioAnio, inicioMes, 1), hasta: mesDe(p.anio, p.mes).hasta };
  }
  return rangoDePeriodo(p);
}

/** Meses (`YYYY-MM-01`) que toca el rango, en orden. */
export function mesesEnRango(rango: Rango): string[] {
  const [y0, m0] = parts(rango.desde);
  const [y1, m1] = parts(rango.hasta);
  const total = (y1 - y0) * 12 + (m1 - m0) + 1;
  return Array.from({ length: Math.max(total, 0) }, (_, i) => {
    const index = m0 - 1 + i;
    return isoDate(y0 + Math.floor(index / 12), (index % 12) + 1, 1);
  });
}

/** `YYYY-MM-01` de la fecha (inicio del mes). */
export function inicioDeMes(iso: string): string {
  const [y, m] = parts(iso);
  return isoDate(y, m, 1);
}

function fechaLarga(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** «Marzo 2026», «Año 2026» o «1 mar 2026 – 15 mar 2026». */
export function etiquetaPeriodo(p: Periodo): string {
  if (p.modo === 'anual') return `Año ${p.anio}`;
  if (p.modo === 'rango') {
    return rangoValido(p) ? `${fechaLarga(p.desde)} – ${fechaLarga(p.hasta)}` : 'Rango sin definir';
  }
  return `${MESES[p.mes - 1]} ${p.anio}`;
}

/** Fragmento para nombres de archivo: `2026-03`, `2026` o `2026-03-01_a_2026-03-15`. */
export function periodoParaArchivo(p: Periodo): string {
  if (p.modo === 'anual') return String(p.anio);
  if (p.modo === 'rango') return `${p.desde}_a_${p.hasta}`;
  return `${p.anio}-${pad(p.mes)}`;
}

/** Etiqueta corta de un mes del eje X: «mar» o «mar 25» si la serie cruza de año. */
export function etiquetaMes(mesIso: string, conAnio: boolean): string {
  const [y, m] = parts(mesIso);
  return conAnio ? `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}` : MESES_CORTOS[m - 1];
}

/** Nombre largo de un mes: «marzo de 2026». */
export function nombreMes(mesIso: string): string {
  const [y, m] = parts(mesIso);
  return `${MESES[m - 1].toLowerCase()} de ${y}`;
}
