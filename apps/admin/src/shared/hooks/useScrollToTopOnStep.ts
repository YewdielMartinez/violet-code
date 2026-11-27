import { useEffect, useRef, type RefObject } from 'react';

export interface ScrollToTopOnStepOptions {
  /** Margen (px) que queda entre el borde superior del contenedor y el inicio del formulario. */
  offset?: number;
  /** Mueve el foco al encabezado del paso nuevo sin provocar otro salto de scroll. Por defecto `true`. */
  focusHeading?: boolean;
  /** Selector del encabezado del paso. Por defecto el de motion-kit (`[data-mk-step-title]`) o el primer `h1`-`h6`. */
  headingSelector?: string;
}

const SCROLLABLE_OVERFLOW = /(auto|scroll|overlay)/;
const DEFAULT_HEADING = '[data-mk-step-title], h1, h2, h3, h4, h5, h6';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Ancestro desplazable más cercano de `el` (cuerpo del `Drawer`, `<main class="mk-shell__view">`, un
 * `[data-mk-scroll-viewport]`…) o `null` cuando el que se desplaza es la propia ventana.
 *
 * En la app el documento no se desplaza: el shell mide `h-dvh` y el scroll vive en `main.mk-shell__view`, así que
 * `window.scrollTo` no tiene efecto y hay que localizar el contenedor real.
 */
export function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (SCROLLABLE_OVERFLOW.test(getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

export function scrollContainerTo(container: HTMLElement | null, top: number, behavior: ScrollBehavior) {
  if (container) {
    if (typeof container.scrollTo === 'function') container.scrollTo({ top, behavior });
    else container.scrollTop = top;
    return;
  }
  if (typeof window.scrollTo === 'function') window.scrollTo({ top, behavior });
}

/**
 * Lleva al inicio del formulario (`anchor`) cuando el contenedor desplazable lo dejó por encima del viewport.
 * Nunca desplaza hacia abajo: si el inicio ya es visible no hace nada.
 */
export function scrollAnchorIntoView(anchor: HTMLElement, offset = 16): void {
  const container = findScrollContainer(anchor);
  const containerTop = container ? container.getBoundingClientRect().top : 0;
  const currentTop = container ? container.scrollTop : window.scrollY;
  const delta = anchor.getBoundingClientRect().top - containerTop;
  const target = Math.max(0, currentTop + delta - offset);
  if (target >= currentTop - 1) return;
  scrollContainerTo(container, target, prefersReducedMotion() ? 'auto' : 'smooth');
}

function focusStepHeading(anchor: HTMLElement, selector: string) {
  const current = anchor.querySelector<HTMLElement>('[data-mk-current]');
  const heading =
    (current ?? anchor).querySelector<HTMLElement>(selector) ??
    Array.from(anchor.querySelectorAll<HTMLElement>(selector)).find((h) => !h.closest('[hidden]'));
  if (!heading || heading.closest('[hidden]')) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/**
 * Al cambiar de paso (Siguiente **y** Atrás) devuelve la vista al inicio del formulario en lugar de dejarla donde
 * estaba el botón (abajo), y pasa el foco al encabezado del paso sin mover el scroll (`preventScroll`).
 *
 * - `stepKey`: índice o clave del paso; no actúa en el primer render, solo cuando cambia.
 * - `anchorRef`: elemento cuyo borde superior debe quedar visible (el `<form>` o la tarjeta que lo contiene).
 *
 * Con `Steps` de motion-kit el paso nuevo sigue oculto hasta terminar la animación de salida: el scroll se lanza al
 * instante (se ve mientras sale el paso anterior) y el foco se mueve al recibir `mk:step`, cuando ya es visible.
 * Respeta `prefers-reduced-motion` (sin scroll suave).
 */
export function useScrollToTopOnStep(
  stepKey: string | number,
  anchorRef: RefObject<HTMLElement | null>,
  { offset = 16, focusHeading = true, headingSelector = DEFAULT_HEADING }: ScrollToTopOnStepOptions = {},
): void {
  const previousKey = useRef(stepKey);

  useEffect(() => {
    if (previousKey.current === stepKey) return;
    previousKey.current = stepKey;
    const anchor = anchorRef.current;
    if (!anchor) return;

    scrollAnchorIntoView(anchor, offset);
    if (!focusHeading) return;

    // Sin `Steps` de motion-kit el encabezado ya es visible: se enfoca de inmediato.
    if (!anchor.querySelector('[data-mk-step]')) {
      focusStepHeading(anchor, headingSelector);
      return;
    }
    function onStep() {
      if (!anchor) return;
      // Reafirma el scroll por si el contenido se encogió al ocultar el paso anterior y luego enfoca el título.
      scrollAnchorIntoView(anchor, offset);
      focusStepHeading(anchor, headingSelector);
    }
    anchor.addEventListener('mk:step', onStep, { once: true });
    return () => anchor.removeEventListener('mk:step', onStep);
  }, [stepKey, anchorRef, offset, focusHeading, headingSelector]);
}
