import { ESTADO_CITA_LABELS } from './Cita';
import { DESTINO_LABELS, ESTADO_DERIVACION_LABELS } from './Derivacion';
import { ESTADO_ORDEN_LABELS } from './OrdenProteccion';
import { ESTADO_FICHA_LABELS } from './Persona';
import type { LineaTiempoEvento, TipoEventoLineaTiempo } from './Seguimiento';

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

/** Tipos que puede devolver `get_linea_tiempo`; nunca incluye notas privadas ni historial clínico (`RF-25`). */
export const TIPOS_LINEA_TIEMPO: readonly TipoEventoLineaTiempo[] = [
  'cita',
  'atencion',
  'derivacion',
  'orden_proteccion',
  'alerta',
  'registro',
];

export const TIPO_EVENTO_LABELS: Record<TipoEventoLineaTiempo, string> = {
  registro: 'Registro',
  cita: 'Citas',
  atencion: 'Atenciones',
  derivacion: 'Derivaciones',
  orden_proteccion: 'Órdenes de protección',
  alerta: 'Alertas',
};

const TIPO_ICON: Record<TipoEventoLineaTiempo, string> = {
  registro: 'R',
  cita: 'C',
  atencion: 'A',
  derivacion: 'D',
  orden_proteccion: 'OP',
  alerta: '!',
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

/** Extrae el estado crudo del título: tras el último « · » o entre paréntesis al final (alertas). */
export function estadoCrudoDesdeTitulo(titulo: string): string | null {
  const paren = /\(([a-z_]+)\)\s*$/.exec(titulo);
  if (paren) return paren[1];
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
  if (evento.tipo === 'atencion') return 'done';
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
 * Mapper puro: filtra por tipos permitidos (y por los seleccionados), ordena del más reciente
 * al más antiguo y produce eventos legibles. Descarta cualquier tipo desconocido por defensa
 * en profundidad: las notas privadas nunca llegan a la línea de tiempo (`RN-09`).
 */
export function mapLineaTiempo(
  eventos: readonly LineaTiempoEvento[],
  tipos: ReadonlySet<TipoEventoLineaTiempo> | null,
  now: Date,
): LineaTiempoVista[] {
  return ordenarLineaTiempo(
    eventos.filter(
      (e) => TIPOS_LINEA_TIEMPO.includes(e.tipo) && (!tipos || tipos.size === 0 || tipos.has(e.tipo)),
    ),
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
  for (const e of eventos) {
    if (e.tipo in base) base[e.tipo] += 1;
  }
  return base;
}
