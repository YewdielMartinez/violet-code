import { flipTransform, type Box } from './dragSort';

/** Duraciones (ms) de las animaciones del tablero. Todas animan solo transform/opacity. */
export const MOTION = {
  /** Vecinos que se acomodan al soltar/mover. */
  move: 260,
  /** Widget que cambia de tamaño (la tarjeta se transforma de una medida a otra). */
  resize: 300,
  enter: 240,
  leave: 180,
  /** Widget levantado que se asienta en su hueco. */
  settle: 280,
  /** Controles y panel de personalizar al salir del modo edición. */
  presence: 200,
} as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const supportsWaapi = () => typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

/** Curva del kit (`--mk-ease-quint`: arranque ágil y llegada suave, sin rebote que descuadre la cuadrícula). */
function easingOf(root: Element): string {
  const token = getComputedStyle(root).getPropertyValue('--mk-ease-quint').trim();
  return token || 'cubic-bezier(0.23, 1, 0.32, 1)';
}

const FLIP_ID = 'vc-flip';
const CELL = '[data-cell-id]';
const SLOT = '[data-cell-slot]';

export interface FlipSnapshot {
  rects: Map<string, Box>;
  /** Elemento enfocado dentro del tablero (React puede soltarlo al mover nodos). */
  focus: HTMLElement | null;
}

const toBox = (rect: DOMRect): Box => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });

const cellsOf = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(`:scope > ${CELL}`)];

/** Lo que se anima de cada celda: la celda, o solo su hueco si la celda lleva un widget en vuelo. */
const targetOf = (cell: HTMLElement, pinnedId: string | null): HTMLElement =>
  pinnedId !== null && cell.dataset.cellId === pinnedId ? (cell.querySelector<HTMLElement>(SLOT) ?? cell) : cell;

/**
 * Foto del estado VISUAL actual (incluye animaciones a medias). Se toma justo antes de que React
 * actualice el DOM; es una sola lectura por celda.
 */
export function captureFlip(root: HTMLElement, pinnedId: string | null): FlipSnapshot {
  const rects = new Map<string, Box>();
  for (const cell of cellsOf(root)) {
    const id = cell.dataset.cellId;
    if (id) rects.set(id, toBox(targetOf(cell, pinnedId).getBoundingClientRect()));
  }
  const active = document.activeElement;
  return { rects, focus: active instanceof HTMLElement && root.contains(active) ? active : null };
}

function restoreFocus(snapshot: FlipSnapshot) {
  const { focus } = snapshot;
  if (focus && focus.isConnected && document.activeElement !== focus) focus.focus({ preventScroll: true });
}

/**
 * Anima del estado de `snapshot` al actual (FLIP). En tres pasos para no forzar layout en bucle:
 * 1) cancela las animaciones previas, 2) lee todas las cajas finales, 3) lanza las animaciones.
 * Mover un vecino = traslación; cambiar de tamaño = traslación + escala con un leve fundido;
 * un widget nuevo = aparece con fundido y escala. Con «reducir movimiento» no anima nada.
 */
export function playFlip(root: HTMLElement, snapshot: FlipSnapshot, pinnedId: string | null) {
  restoreFocus(snapshot);
  if (prefersReducedMotion() || !supportsWaapi()) return;

  const entries = cellsOf(root).flatMap((cell) => {
    const id = cell.dataset.cellId;
    return id ? [{ id, target: targetOf(cell, pinnedId) }] : [];
  });

  for (const { target } of entries) {
    for (const animation of target.getAnimations()) if (animation.id === FLIP_ID) animation.cancel();
  }
  const lasts = entries.map(({ target }) => toBox(target.getBoundingClientRect()));
  const easing = easingOf(root);

  entries.forEach(({ id, target }, index) => {
    const first = snapshot.rects.get(id);
    if (!first) {
      target.animate(
        [
          { opacity: 0, transform: 'scale(0.94)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: MOTION.enter, easing, id: FLIP_ID },
      );
      return;
    }
    const flip = flipTransform(first, lasts[index]);
    if (!flip) return;
    const from = `translate(${flip.dx}px, ${flip.dy}px)${flip.resized ? ` scale(${flip.sx}, ${flip.sy})` : ''}`;
    target.animate(
      [
        { transform: from, transformOrigin: '0 0', ...(flip.resized ? { opacity: 0.7 } : {}) },
        { transform: 'none', transformOrigin: '0 0', opacity: 1 },
      ],
      { duration: flip.resized ? MOTION.resize : MOTION.move, easing, id: FLIP_ID },
    );
  });
}
