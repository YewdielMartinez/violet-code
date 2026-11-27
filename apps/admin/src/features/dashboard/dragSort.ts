/**
 * Lógica pura del arrastre de widgets (sin DOM): qué posición le toca a un widget según el puntero,
 * cómo se reordena una lista de ids, qué transformación FLIP lleva una caja a otra y a qué velocidad
 * se desplaza el scroll cerca del borde. Todo es testeable sin navegador.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Distancia² del punto a la caja (0 si el punto está dentro). */
export function distanceToBox(point: Point, box: Box): number {
  const dx = Math.max(box.left - point.x, 0, point.x - (box.left + box.width));
  const dy = Math.max(box.top - point.y, 0, point.y - (box.top + box.height));
  return dx * dx + dy * dy;
}

/**
 * Índice destino del widget arrastrado.
 *
 * `boxes` son las celdas del tablero MEDIDAS UNA SOLA VEZ al empezar el arrastre, en el orden original y
 * en coordenadas del tablero; `point` es el puntero en esas mismas coordenadas. El widget toma el lugar de
 * la celda sobre la que está el puntero (o de la más cercana si está en un hueco); por encima de la primera fila va al
 * principio y por debajo de la última, al final.
 * Como la decisión depende solo de la geometría inicial y del puntero, no hay realimentación con el
 * reacomodo (ni parpadeo) aunque los widgets midan distinto: una celda de 4×1 y una de 1×1 conviven.
 */
export function pickTargetIndex(boxes: readonly Box[], point: Point): number {
  if (boxes.length === 0) return 0;
  // Más allá de la primera o la última fila: principio y final de la lista.
  if (point.y < Math.min(...boxes.map((b) => b.top))) return 0;
  if (point.y > Math.max(...boxes.map((b) => b.top + b.height))) return boxes.length - 1;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < boxes.length; i++) {
    const distance = distanceToBox(point, boxes[i]);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
      if (distance === 0) break;
    }
  }
  return best;
}

/** Lleva `id` a la posición `toIndex` (acotada) sin mutar la lista. */
export function moveInOrder<T>(order: readonly T[], id: T, toIndex: number): T[] {
  const from = order.indexOf(id);
  if (from < 0) return [...order];
  const to = Math.max(0, Math.min(order.length - 1, Math.trunc(toIndex)));
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Ordena `items` según `order`; lo que no esté en `order` va al final, en su orden original. */
export function applyOrder<T extends { id: string }>(items: readonly T[], order: readonly string[] | null): T[] {
  if (!order) return [...items];
  const rank = new Map(order.map((id, index) => [id, index] as const));
  const last = order.length;
  return items
    .map((item, index) => ({ item, index, rank: rank.get(item.id) ?? last }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

export const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** Huella de lo que cambia la cuadrícula: orden y tamaño de cada widget (y lo que empuja el tablero). */
export const orderSignature = (items: readonly { id: string; size: string }[], extra = '') =>
  `${items.map((i) => `${i.id}:${i.size}`).join(',')}|${extra}`;

export interface FlipTransform {
  dx: number;
  dy: number;
  /** Escala inicial (primero ÷ último); 1 si el tamaño no cambió. */
  sx: number;
  sy: number;
  resized: boolean;
}

const EPSILON = 0.5;

/**
 * Transformación inicial FLIP para que `last` (ya en su lugar final) parezca seguir en `first`.
 * Devuelve null si no hubo cambio perceptible. Se anima de esta transformación a `none`, con el origen
 * de la transformación en la esquina superior izquierda.
 */
export function flipTransform(first: Box, last: Box): FlipTransform | null {
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const resized = Math.abs(first.width - last.width) > EPSILON || Math.abs(first.height - last.height) > EPSILON;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON && !resized) return null;
  return {
    dx,
    dy,
    sx: resized && last.width > 0 ? first.width / last.width : 1,
    sy: resized && last.height > 0 ? first.height / last.height : 1,
    resized,
  };
}

/** Posición del widget levantado respecto a su hueco: sigue al puntero conservando el punto de agarre. */
export function liftOffset(pointer: Point, grab: Point, slot: Pick<Box, 'left' | 'top'>): Point {
  return { x: pointer.x - grab.x - slot.left, y: pointer.y - grab.y - slot.top };
}

/**
 * Velocidad (px por cuadro, con signo) del scroll automático: 0 lejos de los bordes y creciente
 * (cuadrática, para que arranque suave) al acercarse a `start` (negativa) o `end` (positiva).
 */
export function edgeScrollSpeed(pos: number, start: number, end: number, edge = 72, max = 18): number {
  if (end - start < edge * 2) return 0;
  if (pos < start + edge) {
    const t = Math.min(1, (start + edge - pos) / edge);
    return -max * t * t;
  }
  if (pos > end - edge) {
    const t = Math.min(1, (pos - (end - edge)) / edge);
    return max * t * t;
  }
  return 0;
}

/** Inclinación (grados) según la velocidad horizontal del puntero; nunca pasa de `max` (≤ 1°). */
export function tiltFor(velocityX: number, max = 1, gain = 0.12): number {
  return Math.max(-max, Math.min(max, velocityX * gain));
}
