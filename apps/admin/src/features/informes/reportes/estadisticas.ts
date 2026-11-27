import type { ReporteRow } from '@/domain/models/Reporte';
import { etiquetaMes, inicioDeMes, nombreMes, type Rango } from './periodo';

/** Mapeadores puros de las filas de `get_reporte('atenciones', …)` a lo que dibujan los KPI y las gráficas. */

export interface Punto {
  label: string;
  value: number;
}

export type DeltaDireccion = 'sube' | 'baja' | 'igual' | 'sin_dato';

export interface Delta {
  /** Diferencia absoluta contra el periodo anterior. */
  diff: number;
  /** Variación porcentual (entera); `null` si el periodo anterior fue 0 o no hay dato. */
  pct: number | null;
  direccion: DeltaDireccion;
}

export function calcularDelta(actual: number, previo: number | null): Delta {
  if (previo === null) return { diff: 0, pct: null, direccion: 'sin_dato' };
  const diff = actual - previo;
  if (diff === 0) return { diff: 0, pct: previo === 0 ? null : 0, direccion: 'igual' };
  return {
    diff,
    pct: previo === 0 ? null : Math.round((diff / previo) * 100),
    direccion: diff > 0 ? 'sube' : 'baja',
  };
}

export interface ResumenAtenciones {
  atenciones: number;
  personas: number;
  primeraVez: number;
  seguimiento: number;
  mujeres: number;
  hombres: number;
}

export const RESUMEN_VACIO: ResumenAtenciones = {
  atenciones: 0,
  personas: 0,
  primeraVez: 0,
  seguimiento: 0,
  mujeres: 0,
  hombres: 0,
};

/** La fila única de `agrupar = 'total'`: atenciones, personas distintas y `metrica` = atenciones de primera vez. */
export function resumenDeTotal(rows: readonly ReporteRow[] | undefined): ResumenAtenciones {
  const row = rows?.[0];
  if (!row) return RESUMEN_VACIO;
  const primeraVez = Math.min(row.metrica ?? 0, row.total);
  return {
    atenciones: row.total,
    personas: row.personas ?? 0,
    primeraVez,
    seguimiento: row.total - primeraVez,
    mujeres: row.mujeres ?? 0,
    hombres: row.hombres ?? 0,
  };
}

export type KpiId = 'atenciones' | 'personas' | 'primeraVez' | 'seguimiento';

export interface Kpi {
  id: KpiId;
  label: string;
  value: number;
  previo: number | null;
  delta: Delta;
}

const KPI_LABELS: Record<KpiId, string> = {
  atenciones: 'Atenciones',
  personas: 'Personas atendidas',
  primeraVez: 'Primera vez',
  seguimiento: 'Seguimiento',
};

/** KPI del periodo con su variación contra el anterior (`previo` en `null` mientras carga o si falla). */
export function kpisAtenciones(actual: ResumenAtenciones, previo: ResumenAtenciones | null): Kpi[] {
  return (Object.keys(KPI_LABELS) as KpiId[]).map((id) => ({
    id,
    label: KPI_LABELS[id],
    value: actual[id],
    previo: previo ? previo[id] : null,
    delta: calcularDelta(actual[id], previo ? previo[id] : null),
  }));
}

const numero = (n: number) => n.toLocaleString('es-MX');

/** Texto accesible del KPI: «Atenciones: 18, 20 % más que el periodo anterior (15)». */
export function kpiTexto(kpi: Kpi): string {
  const base = `${kpi.label}: ${numero(kpi.value)}`;
  const { direccion, pct, diff } = kpi.delta;
  if (direccion === 'sin_dato') return base;
  if (direccion === 'igual') return `${base}, igual que el periodo anterior`;
  const cuanto = pct === null ? numero(Math.abs(diff)) : `${Math.abs(pct)} %`;
  return `${base}, ${cuanto} ${direccion === 'sube' ? 'más' : 'menos'} que el periodo anterior (${numero(kpi.previo ?? 0)})`;
}

/** Filas de la ventana de tendencia que caen dentro del periodo elegido (a partir del mes de `desde`). */
export function filasDelPeriodo(serie: readonly ReporteRow[], rango: Rango): ReporteRow[] {
  const inicio = inicioDeMes(rango.desde);
  return serie.filter((row) => row.mes !== null && row.mes >= inicio);
}

function etiquetasMeses(meses: readonly string[]) {
  const conAnio = new Set(meses.map((m) => m.slice(0, 4))).size > 1;
  return {
    cortas: meses.map((m) => etiquetaMes(m, conAnio)),
    largas: meses.map(nombreMes),
  };
}

export interface SerieMensual {
  labels: string[];
  largas: string[];
  values: number[];
}

/** Atenciones por mes (los meses sin atenciones valen 0). */
export function serieAtenciones(serie: readonly ReporteRow[], meses: readonly string[]): SerieMensual {
  const porMes = new Map<string, number>();
  for (const row of serie) if (row.mes) porMes.set(row.mes, (porMes.get(row.mes) ?? 0) + row.total);
  const { cortas, largas } = etiquetasMeses(meses);
  return { labels: cortas, largas, values: meses.map((m) => porMes.get(m) ?? 0) };
}

export interface SerieSeguimiento {
  labels: string[];
  largas: string[];
  primeraVez: number[];
  seguimiento: number[];
}

/** Primera vez vs seguimiento por mes. */
export function serieSeguimiento(serie: readonly ReporteRow[], meses: readonly string[]): SerieSeguimiento {
  const primera = new Map<string, number>();
  const seguimiento = new Map<string, number>();
  for (const row of serie) {
    if (!row.mes) continue;
    const target = row.estado === 'seguimiento' ? seguimiento : primera;
    target.set(row.mes, (target.get(row.mes) ?? 0) + row.total);
  }
  const { cortas, largas } = etiquetasMeses(meses);
  return {
    labels: cortas,
    largas,
    primeraVez: meses.map((m) => primera.get(m) ?? 0),
    seguimiento: meses.map((m) => seguimiento.get(m) ?? 0),
  };
}

function sumarPor(rows: readonly ReporteRow[], clave: (row: ReporteRow) => string | null, sinClave: string): Punto[] {
  const acumulado = new Map<string, number>();
  for (const row of rows) {
    const label = clave(row) ?? sinClave;
    acumulado.set(label, (acumulado.get(label) ?? 0) + row.total);
  }
  return [...acumulado.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
}

/** Atenciones por tipo de atención, de mayor a menor; lo que pasa de `max` se agrupa en «Otros». */
export function distribucionPorTipo(rows: readonly ReporteRow[], max = 8): Punto[] {
  const todos = sumarPor(rows, (row) => row.categoria, 'Sin tipo');
  if (todos.length <= max) return todos;
  const visibles = todos.slice(0, max - 1);
  const resto = todos.slice(max - 1).reduce((sum, punto) => sum + punto.value, 0);
  return [...visibles, { label: 'Otros', value: resto }];
}

/** Atenciones por área, de mayor a menor. */
export function distribucionPorArea(rows: readonly ReporteRow[]): Punto[] {
  return sumarPor(rows, (row) => row.area, 'Sin área');
}

/** Personas atendidas por sexo. */
export function distribucionPorSexo(resumen: ResumenAtenciones): Punto[] {
  return [
    { label: 'Mujeres', value: resumen.mujeres },
    { label: 'Hombres', value: resumen.hombres },
  ];
}

/**
 * Una línea de lectura para el encabezado de una gráfica de serie: variación del último punto contra el anterior
 * («▲ 12 % vs. mes anterior»). La dirección va en la flecha y en el texto, no solo en el color. `null` si no hay datos o
 * solo hay un punto.
 */
export function insightSerie(values: readonly number[], anterior = 'mes anterior'): string | null {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const delta = calcularDelta(values[values.length - 1], values[values.length - 2]);
  if (delta.direccion === 'igual') return `= Igual que el ${anterior}`;
  if (delta.direccion === 'sin_dato') return null;
  const flecha = delta.direccion === 'sube' ? '▲' : '▼';
  const signo = delta.pct === null ? (delta.direccion === 'sube' ? '+' : '−') : '';
  const cuanto = delta.pct === null ? numero(Math.abs(delta.diff)) : `${Math.abs(delta.pct)} %`;
  return `${flecha} ${signo}${cuanto} vs. ${anterior}`;
}

/** Línea de lectura de una distribución: el mayor y su parte del total («Mayor: Psicología · 45 %»). */
export function insightPuntos(puntos: readonly Punto[]): string | null {
  const total = puntos.reduce((sum, p) => sum + p.value, 0);
  if (puntos.length === 0 || total === 0) return null;
  const top = puntos.reduce((best, p) => (p.value > best.value ? p : best), puntos[0]);
  return `Mayor: ${top.label} · ${Math.round((top.value / total) * 100)} %`;
}

/** Línea de lectura de primera vez vs seguimiento: qué parte de las atenciones del periodo son seguimiento. */
export function insightSeguimiento(primeraVez: readonly number[], seguimiento: readonly number[]): string | null {
  const sum = (list: readonly number[]) => list.reduce((acc, v) => acc + v, 0);
  const total = sum(primeraVez) + sum(seguimiento);
  if (total === 0) return null;
  return `Seguimiento: ${Math.round((sum(seguimiento) / total) * 100)} % de las atenciones`;
}

/** Resumen en una frase de una serie (para `aria-label`): total y mes pico. */
export function resumenSerie(titulo: string, largas: readonly string[], values: readonly number[]): string {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (values.length === 0 || total === 0) return `${titulo}: sin datos en el periodo.`;
  let pico = 0;
  values.forEach((v, i) => {
    if (v > values[pico]) pico = i;
  });
  return `${titulo}: ${numero(total)} en total de ${largas[0]} a ${largas[largas.length - 1]}; el mes con más fue ${largas[pico]} con ${numero(values[pico])}.`;
}

/** Resumen en una frase de una distribución (para `aria-label`). */
export function resumenPuntos(titulo: string, puntos: readonly Punto[]): string {
  const total = puntos.reduce((sum, p) => sum + p.value, 0);
  if (puntos.length === 0 || total === 0) return `${titulo}: sin datos en el periodo.`;
  const top = puntos.reduce((best, p) => (p.value > best.value ? p : best), puntos[0]);
  return `${titulo}: ${numero(total)} en total; ${top.label} es el mayor con ${numero(top.value)}.`;
}
