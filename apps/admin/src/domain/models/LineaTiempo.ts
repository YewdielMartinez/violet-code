import { ESTADO_CITA_LABELS } from './Cita';
import { DESTINO_LABELS, ESTADO_DERIVACION_LABELS } from './Derivacion';
import { ESTADO_ORDEN_LABELS } from './OrdenProteccion';
import { ESTADO_FICHA_LABELS } from './Persona';
import {
  normalizarTipoEvento,
  type LineaTiempoEvento,
  type TipoEventoLineaTiempo,
} from './Seguimiento';

/** Estado visual de un evento (compatible con `TimelineStatus` de motion-kit). */
export type EstadoEventoVista = 'done' | 'current' | 'upcoming' | 'error';

/** Evento listo para pintar (forma compatible con `TimelineEvent` de motion-kit). */
export interface LineaTiempoVista {
  id: string;
  tipo: TipoEventoLineaTiempo;
  title: string;
  description?: string;
  time: string;
  status: EstadoEventoVista;
  icon: string;
  meta?: string;
}

/**
 * Tipos que puede devolver `get_linea_tiempo` (más `otro` para tipos futuros); nunca incluye notas
 * privadas ni historial clínico (`RF-25`). El orden es el de los chips de filtro.
 */
export const TIPOS_LINEA_TIEMPO: readonly TipoEventoLineaTiempo[] = [
  'cita',
  'atencion',
  'derivacion',
  'canalizacion_evento',
  'orden_proteccion',
  'alerta',
  'registro',
  'archivo',
  'reapertura',
  'otro',
];

export const TIPO_EVENTO_LABELS: Record<TipoEventoLineaTiempo, string> = {
  registro: 'Registro',
  archivo: 'Archivo',
  reapertura: 'Reaperturas',
  cita: 'Citas',
  atencion: 'Atenciones',
  derivacion: 'Derivaciones',
  canalizacion_evento: 'Canalizaciones',
  orden_proteccion: 'Órdenes de protección',
  alerta: 'Alertas',
  otro: 'Otros eventos',
};

/** Icono Material Symbols Rounded del punto de la línea de tiempo (el CSS le da la fuente de iconos). */
export const TIPO_ICON: Record<TipoEventoLineaTiempo, string> = {
  registro: 'description',
  archivo: 'archive',
  reapertura: 'autorenew',
  cita: 'event',
  atencion: 'clinical_notes',
  derivacion: 'alt_route',
  canalizacion_evento: 'alt_route',
  orden_proteccion: 'gavel',
  alerta: 'sos',
  otro: 'circle',
};

/** Estado visual por defecto (sin estado crudo en el título) de los tipos que no dependen de él. */
const ESTADO_POR_TIPO: Partial<Record<TipoEventoLineaTiempo, EstadoEventoVista>> = {
  atencion: 'done',
  archivo: 'done',
  reapertura: 'current',
};

/** Valores crudos de enums que el RPC concatena en `titulo` y su etiqueta legible. */
const TOKEN_LABELS: Record<string, string> = {
  ...ESTADO_CITA_LABELS,
  ...ESTADO_DERIVACION_LABELS,
  ...ESTADO_ORDEN_LABELS,
  ...ESTADO_FICHA_LABELS,
  ...DESTINO_LABELS,
  nueva: 'Nueva',
  tomada: 'Tomada',
  atendida: 'Atendida',
  app_movil: 'App móvil',
  telefono: 'Teléfono',
  presencial: 'Presencial',
  alta: 'prioridad alta',
  media: 'prioridad media',
  baja: 'prioridad baja',
};

const TOKEN_REGEX = /(?<!\p{L})[a-z_]+(?!\p{L})/gu;

/** Sustituye los valores crudos de enums (`asistio`, `en_proceso`, `app_movil`) por su etiqueta. */
export function humanizarTitulo(titulo: string): string {
  return titulo.replace(TOKEN_REGEX, (token) => TOKEN_LABELS[token] ?? token);
}

/** Extrae el estado crudo del título: tras el último « · », tras « → » o entre paréntesis al final (alertas). */
export function estadoCrudoDesdeTitulo(titulo: string): string | null {
  const paren = /\(([a-z_]+)\)\s*$/.exec(titulo);
  if (paren) return paren[1];
  // Cambios de estado: «Orden de protección: vigente → vencida» (estado nuevo tras la flecha).
  const flecha = /→\s*([a-z_]+)\s*$/.exec(titulo);
  if (flecha) return flecha[1];
  const idx = titulo.lastIndexOf(' · ');
  if (idx < 0) return null;
  const tail = titulo.slice(idx + 3).trim();
  return /^[a-z_]+$/.test(tail) ? tail : null;
}

const ESTADO_POR_VALOR: Record<string, EstadoEventoVista> = {
  asistio: 'done',
  reagendada: 'done',
  concluida: 'done',
  vencida: 'done',
  atendida: 'done',
  cerrado: 'done',
  archivado: 'done',
  no_asistio: 'error',
  cancelada: 'error',
  nueva: 'error',
  pendiente: 'current',
  en_proceso: 'current',
  vigente: 'current',
  en_tramite: 'current',
  tomada: 'current',
  abierto: 'current',
  en_seguimiento: 'current',
};

/** Deriva el color/estado del punto de la línea de tiempo según tipo, estado y fecha. */
export function estadoEventoVista(evento: LineaTiempoEvento, now: Date): EstadoEventoVista {
  const fijo = ESTADO_POR_TIPO[evento.tipo];
  if (fijo) return fijo;
  const estado = estadoCrudoDesdeTitulo(evento.titulo);
  if (evento.tipo === 'cita' && (estado === 'agendada' || estado === 'confirmada')) {
    return Date.parse(evento.fecha) > now.getTime() ? 'upcoming' : 'current';
  }
  return (estado && ESTADO_POR_VALOR[estado]) || 'done';
}

/** Ordena de la más reciente a la más antigua (desempate estable por tipo y referencia). */
export function ordenarLineaTiempo(eventos: readonly LineaTiempoEvento[]): LineaTiempoEvento[] {
  return [...eventos].sort((a, b) => {
    const diff = Date.parse(b.fecha) - Date.parse(a.fecha);
    if (diff !== 0) return diff;
    return a.tipo.localeCompare(b.tipo) || b.referenciaId.localeCompare(a.referenciaId);
  });
}

/**
 * Normaliza el tipo de cada evento: tipos conocidos intactos, tipos futuros → `otro` (render
 * genérico) y notas privadas descartadas por defensa en profundidad (`RN-09`).
 */
function normalizarEventos(eventos: readonly LineaTiempoEvento[]): LineaTiempoEvento[] {
  return eventos.flatMap((e) => {
    const tipo = normalizarTipoEvento(e.tipo);
    return tipo ? [tipo === e.tipo ? e : { ...e, tipo }] : [];
  });
}

/**
 * Mapper puro: normaliza tipos, filtra por los seleccionados, ordena del más reciente al más
 * antiguo y produce eventos legibles. Los tipos futuros se muestran genéricos; las notas privadas
 * nunca llegan a la línea de tiempo (`RN-09`).
 */
export function mapLineaTiempo(
  eventos: readonly LineaTiempoEvento[],
  tipos: ReadonlySet<TipoEventoLineaTiempo> | null,
  now: Date,
): LineaTiempoVista[] {
  return ordenarLineaTiempo(
    normalizarEventos(eventos).filter((e) => !tipos || tipos.size === 0 || tipos.has(e.tipo)),
  ).map((e) => ({
    id: `${e.tipo}-${e.referenciaId}`,
    tipo: e.tipo,
    // Las atenciones se titulan con nombres de catálogo: no se tocan.
    title: e.tipo === 'atencion' ? e.titulo : humanizarTitulo(e.titulo),
    description: e.detalle?.trim() || undefined,
    time: e.fecha,
    status: estadoEventoVista(e, now),
    icon: TIPO_ICON[e.tipo],
    meta: e.area ?? undefined,
  }));
}

/** Conteo por tipo para los chips de filtro. */
export function contarPorTipo(
  eventos: readonly LineaTiempoEvento[],
): Record<TipoEventoLineaTiempo, number> {
  const base = Object.fromEntries(TIPOS_LINEA_TIEMPO.map((t) => [t, 0])) as Record<
    TipoEventoLineaTiempo,
    number
  >;
  for (const e of normalizarEventos(eventos)) base[e.tipo] += 1;
  return base;
}
