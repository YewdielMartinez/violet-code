import { useEffect, useRef, type RefObject } from 'react';
import { findScrollContainer, scrollContainerTo } from '@/shared/hooks/useScrollToTopOnStep';

/** Separación (px) entre el borde superior del contenedor y el encabezado de la sección al revelarla. */
const REVEAL_OFFSET = 16;
/** Diferencia (px) por debajo de la cual se considera que no hay nada que mover. */
const TOLERANCE = 2;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Geometry {
  /** Posición actual del scroll. */
  scrollTop: number;
  /** Alto visible del contenedor (o de la ventana). */
  viewport: number;
  /** Borde superior / inferior de la sección relativos al borde superior visible del contenedor. */
  top: number;
  bottom: number;
}

function measure(anchor: HTMLElement, container: HTMLElement | null): Geometry {
  const rect = anchor.getBoundingClientRect();
  const containerTop = container ? container.getBoundingClientRect().top : 0;
  return {
    scrollTop: container ? container.scrollTop : window.scrollY,
    viewport: container ? container.clientHeight : window.innerHeight,
    top: rect.top - containerTop,
    bottom: rect.bottom - containerTop,
  };
}

/**
 * Lleva la sección editada a la vista: si no cabe completa en el área visible, alinea su encabezado arriba
 * (con `REVEAL_OFFSET` de margen). Si el formulario es más alto que el viewport también alinea el encabezado.
 * Con `onlyIfHeaderHidden` solo actúa cuando el encabezado quedó fuera (retorno tras un cambio de altura).
 */
function revealSection(
  anchor: HTMLElement,
  container: HTMLElement | null,
  behavior: ScrollBehavior,
  onlyIfHeaderHidden = false,
) {
  const geo = measure(anchor, container);
  const headerHidden = geo.top < 0 || geo.top > geo.viewport - REVEAL_OFFSET;
  const fullyVisible = geo.top >= 0 && geo.bottom <= geo.viewport;
  if (onlyIfHeaderHidden ? !headerHidden : fullyVisible) return;
  const target = Math.max(0, geo.scrollTop + geo.top - REVEAL_OFFSET);
  if (Math.abs(target - geo.scrollTop) <= TOLERANCE) return;
  scrollContainerTo(container, target, behavior);
}

interface Origin {
  container: HTMLElement | null;
  /** Scroll del contenedor al abrir. */
  scrollTop: number;
  /** Posición del encabezado dentro del contenido desplazable al abrir (para detectar cambios por encima). */
  anchorOffset: number;
}

interface UseEditScrollOptions {
  /** Elemento raíz de la sección (su borde superior es el del encabezado). */
  anchorRef: RefObject<HTMLElement | null>;
  editing: boolean;
  /** El formulario ya terminó de expandirse y tiene su altura final: es seguro desplazar. */
  ready: boolean;
  /** Duración de la animación de colapso (ms) tras la que se verifica que el encabezado siga visible. */
  settleMs: number;
}

/**
 * Accesibilidad al editar una sección: al abrir el formulario, desplaza el contenedor desplazable más
 * cercano (`main.mk-shell__view` o el cuerpo del drawer, no la ventana) para que la sección quede a la
 * vista; al terminar (guardar, cancelar, Esc) devuelve el scroll exacto que tenía antes de abrir. Si el
 * contenido de arriba cambió de altura entre tanto, solo se asegura de que el encabezado siga visible.
 *
 * - Abrir: espera a `ready` para no pelear con la animación de altura (`grid-template-rows`).
 * - Cerrar: el retorno arranca de inmediato, en paralelo con el colapso.
 * - `prefers-reduced-motion`: scroll instantáneo (`behavior: 'auto'`).
 */
export function useEditScroll({ anchorRef, editing, ready, settleMs }: UseEditScrollOptions): void {
  const originRef = useRef<Origin | null>(null);
  const wasEditingRef = useRef(false);
  const revealedRef = useRef(false);

  // Memoriza dónde estaba el usuario en cuanto empieza la edición.
  useEffect(() => {
    if (!editing) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const container = findScrollContainer(anchor);
    const geo = measure(anchor, container);
    originRef.current = { container, scrollTop: geo.scrollTop, anchorOffset: geo.scrollTop + geo.top };
    revealedRef.current = false;
    wasEditingRef.current = true;
  }, [editing, anchorRef]);

  // Abrir: cuando el formulario ya tiene su altura final, lleva la sección a la vista.
  useEffect(() => {
    if (!editing || !ready || revealedRef.current) return;
    const anchor = anchorRef.current;
    const origin = originRef.current;
    if (!anchor || !origin) return;
    revealedRef.current = true;
    revealSection(anchor, origin.container, prefersReducedMotion() ? 'auto' : 'smooth');
  }, [editing, ready, anchorRef]);

  // Cerrar: devuelve el scroll previo en paralelo con el colapso.
  useEffect(() => {
    if (editing || !wasEditingRef.current) return;
    wasEditingRef.current = false;
    const anchor = anchorRef.current;
    const origin = originRef.current;
    originRef.current = null;
    if (!anchor || !origin) return;

    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const geo = measure(anchor, origin.container);
    const aboveChanged = Math.abs(geo.scrollTop + geo.top - origin.anchorOffset) > TOLERANCE;

    if (!aboveChanged && Math.abs(geo.scrollTop - origin.scrollTop) > TOLERANCE) {
      scrollContainerTo(origin.container, origin.scrollTop, behavior);
    }

    // Respaldo: ya colapsado, si el encabezado quedó fuera de la vista (contenido de arriba distinto) se trae.
    const delay = behavior === 'auto' ? 0 : settleMs + 40;
    const timer = window.setTimeout(() => {
      if (anchor.isConnected) revealSection(anchor, origin.container, behavior, true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [editing, anchorRef, settleMs]);
}
