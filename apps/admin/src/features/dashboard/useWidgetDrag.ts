import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import {
  applyOrder,
  edgeScrollSpeed,
  liftOffset,
  moveInOrder,
  pickTargetIndex,
  tiltFor,
  type Box,
  type Point,
} from './dragSort';
import { MOTION, prefersReducedMotion } from './flip';
import { widgetDef, type LayoutItem, type WidgetId } from './layout';

/** pointer: arrastre con puntero · keyboard: levantado con teclado · settling: asentándose tras soltar. */
export type DragMode = 'pointer' | 'keyboard' | 'settling';

export interface ActiveDrag {
  id: WidgetId;
  mode: DragMode;
}

interface Options {
  /** Widgets visibles en su orden guardado. */
  items: readonly LayoutItem[];
  gridRef: RefObject<HTMLElement | null>;
  onReorder: (id: WidgetId, toIndex: number) => void;
  onAnnounce: (text: string) => void;
}

/** Datos medidos UNA vez al empezar el arrastre (nada de esto se vuelve a medir por cuadro). */
interface Run {
  from: number;
  order0: WidgetId[];
  boxes: Box[];
  grab: Point;
  slot: Pick<Box, 'left' | 'top'>;
  gridLeft: number;
  gridTop: number;
  scroller: HTMLElement;
  scrollLeft0: number;
  scrollTop0: number;
  view: { top: number; bottom: number };
  cell: HTMLElement;
  lift: HTMLElement;
  target: number;
  raf: number;
  tilt: number;
  prevX: number;
}

interface Session {
  id: WidgetId;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  run: Run | null;
  settleTimer: ReturnType<typeof setTimeout> | null;
}

/** Distancia (px) que hay que mover el puntero para que un clic en el asa se convierta en arrastre. */
const THRESHOLD = 4;

function findScroller(el: HTMLElement): HTMLElement {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

const isPage = (el: HTMLElement) => el === document.documentElement || el === document.body || el === document.scrollingElement;

const localAt = (run: Run, x: number, y: number): Point => ({
  x: x - run.gridLeft + (run.scroller.scrollLeft - run.scrollLeft0),
  y: y - run.gridTop + (run.scroller.scrollTop - run.scrollTop0),
});

/**
 * Arrastre y reordenado de widgets con puntero y teclado, pensado para tamaños mixtos.
 *
 * - El orden se simula en un borrador (`order`) mientras dura el gesto: la cuadrícula se reacomoda en vivo
 *   (los vecinos se animan con FLIP) y solo al soltar se guarda, así que cancelar (Escape) no deja rastro.
 * - El widget levantado es la capa `.vc-cell__lift` de su celda: sigue al puntero con `translate`/`rotate`
 *   (compositor, sin layout) y su hueco (`.vc-cell__slot`) muestra dónde caerá con el tamaño real.
 * - Las cajas se miden una vez al empezar y otra vez tras cada reacomodo confirmado (solo la del hueco);
 *   por cuadro solo se escriben dos propiedades de estilo.
 */
export function useWidgetDrag({ items, gridRef, onReorder, onAnnounce }: Options) {
  const [draft, setDraft] = useState<WidgetId[] | null>(null);
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const session = useRef<Session | null>(null);

  const live = useRef({ items, draft, active, onReorder, onAnnounce });
  useLayoutEffect(() => {
    live.current = { items, draft, active, onReorder, onAnnounce };
  });

  const controller = useMemo(() => {
    const applyLift = (se: Session, run: Run) => {
      const offset = liftOffset(localAt(run, se.x, se.y), run.grab, run.slot);
      run.lift.style.translate = `${offset.x}px ${offset.y}px`;
      run.lift.style.rotate = prefersReducedMotion() ? '' : `${run.tilt.toFixed(2)}deg`;
    };

    const evaluate = (se: Session, run: Run) => {
      const to = pickTargetIndex(run.boxes, localAt(run, se.x, se.y));
      if (to === run.target) return;
      run.target = to;
      setDraft(moveInOrder(run.order0, se.id, to));
    };

    const frame = () => {
      const se = session.current;
      const run = se?.run;
      if (!se || !run) return;
      run.raf = requestAnimationFrame(frame);
      const speed = edgeScrollSpeed(se.y, run.view.top, run.view.bottom);
      if (speed) {
        const before = run.scroller.scrollTop;
        run.scroller.scrollTop = before + speed;
        if (run.scroller.scrollTop !== before) evaluate(se, run);
      }
      run.tilt += (tiltFor(se.x - run.prevX) - run.tilt) * 0.2;
      run.prevX = se.x;
      applyLift(se, run);
    };

    const begin = (se: Session): boolean => {
      const grid = gridRef.current;
      if (!grid) return false;
      const cells = [...grid.querySelectorAll<HTMLElement>(':scope > [data-cell-id]')];
      const order0 = cells.map((cell) => cell.dataset.cellId as WidgetId);
      const from = order0.indexOf(se.id);
      const cell = cells[from];
      const lift = cell?.querySelector<HTMLElement>('.vc-cell__lift');
      if (!cell || !lift) return false;

      const boxes = cells.map((c) => ({ left: c.offsetLeft, top: c.offsetTop, width: c.offsetWidth, height: c.offsetHeight }));
      const rect = grid.getBoundingClientRect();
      const scroller = findScroller(grid);
      const view = isPage(scroller)
        ? { top: 0, bottom: window.innerHeight }
        : { top: scroller.getBoundingClientRect().top, bottom: scroller.getBoundingClientRect().bottom };
      const run: Run = {
        from,
        order0,
        boxes,
        grab: { x: 0, y: 0 },
        slot: { left: boxes[from].left, top: boxes[from].top },
        gridLeft: rect.left,
        gridTop: rect.top,
        scroller,
        scrollLeft0: scroller.scrollLeft,
        scrollTop0: scroller.scrollTop,
        view,
        cell,
        lift,
        target: from,
        raf: 0,
        tilt: 0,
        prevX: se.x,
      };
      const press = localAt(run, se.startX, se.startY);
      run.grab = { x: press.x - run.slot.left, y: press.y - run.slot.top };
      se.run = run;
      setActive({ id: se.id, mode: 'pointer' });
      run.raf = requestAnimationFrame(frame);
      return true;
    };

    const onMove = (event: globalThis.PointerEvent) => {
      const se = session.current;
      if (!se || event.pointerId !== se.pointerId) return;
      se.x = event.clientX;
      se.y = event.clientY;
      if (!se.run) {
        if (Math.hypot(se.x - se.startX, se.y - se.startY) < THRESHOLD) return;
        if (!begin(se)) {
          stopListening();
          session.current = null;
          return;
        }
      }
      if (se.run) evaluate(se, se.run);
    };

    const onUp = (event: globalThis.PointerEvent) => {
      if (session.current && event.pointerId === session.current.pointerId) finish(true);
    };
    const onCancel = (event: globalThis.PointerEvent) => {
      if (session.current && event.pointerId === session.current.pointerId) finish(false);
    };
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !session.current?.run) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };

    function stopListening() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onEscape, true);
    }

    /** Suelta: guarda el orden (o lo descarta) y asienta el widget en su hueco con una transición. */
    function finish(commit: boolean) {
      const se = session.current;
      if (!se) return;
      stopListening();
      const run = se.run;
      if (!run) {
        session.current = null;
        return;
      }
      cancelAnimationFrame(run.raf);
      const toIndex = commit ? run.target : run.from;
      // flushSync: el DOM ya refleja el orden final antes de soltar la capa (así no se anima dos veces).
      flushSync(() => {
        if (toIndex !== run.from) live.current.onReorder(se.id, toIndex);
        setDraft(null);
        setActive({ id: se.id, mode: 'settling' });
      });
      const end = () => {
        run.lift.style.translate = '';
        run.lift.style.rotate = '';
        session.current = null;
        setActive(null);
      };
      if (prefersReducedMotion()) {
        end();
        return;
      }
      // Con [data-settling] ya aplicado, quitar el desplazamiento dispara la transición hacia el hueco.
      run.lift.style.translate = '';
      run.lift.style.rotate = '';
      se.settleTimer = setTimeout(end, MOTION.settle + 60);
    }

    /** Aborta sin animación (salir de edición, desmontar). */
    function reset() {
      stopListening();
      const se = session.current;
      if (se?.run) {
        cancelAnimationFrame(se.run.raf);
        se.run.lift.style.translate = '';
        se.run.lift.style.rotate = '';
      }
      if (se?.settleTimer) clearTimeout(se.settleTimer);
      session.current = null;
    }

    const pointerDown = (id: WidgetId, event: PointerEvent<HTMLElement>) => {
      if (session.current || live.current.active) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      session.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        run: null,
        settleTimer: null,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onEscape, true);
    };

    const place = (id: WidgetId, order: readonly WidgetId[]) =>
      `${widgetDef(id).title}: posición ${order.indexOf(id) + 1} de ${order.length}.`;

    /** Teclado en el asa: Espacio/Enter levanta y suelta, flechas mueven (animado igual que con puntero), Escape cancela. */
    const keyDown = (id: WidgetId, event: KeyboardEvent<HTMLElement>) => {
      const { items: base, draft: current, active: grabbed, onReorder: commit, onAnnounce: say } = live.current;
      if (session.current) return;
      const order = current ?? base.map((i) => i.id);
      const isGrabbed = grabbed?.mode === 'keyboard' && grabbed.id === id;
      const toggle = event.key === ' ' || event.key === 'Enter';

      if (!isGrabbed) {
        if (!toggle || grabbed) return;
        event.preventDefault();
        setActive({ id, mode: 'keyboard' });
        say(
          `${widgetDef(id).title} levantado, posición ${order.indexOf(id) + 1} de ${order.length}. Flechas para mover, Espacio para soltar, Escape para cancelar.`,
        );
        return;
      }

      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0;
      if (step) {
        event.preventDefault();
        const at = order.indexOf(id);
        const to = at + step;
        if (to < 0 || to >= order.length) return;
        const next = moveInOrder(order, id, to);
        setDraft(next);
        say(place(id, next));
      } else if (toggle) {
        event.preventDefault();
        const to = order.indexOf(id);
        const from = base.findIndex((i) => i.id === id);
        setDraft(null);
        setActive(null);
        if (to !== from) commit(id, to);
        else say(`${widgetDef(id).title} soltado en la posición ${to + 1} de ${order.length}.`);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setDraft(null);
        setActive(null);
        say('Movimiento cancelado.');
      }
    };

    /** Cuando el reacomodo cambia el hueco del widget en vuelo, su capa debe seguir bajo el puntero. */
    const refresh = () => {
      const se = session.current;
      const run = se?.run;
      if (!se || !run) return;
      run.slot = { left: run.cell.offsetLeft, top: run.cell.offsetTop };
      applyLift(se, run);
    };

    return { pointerDown, keyDown, refresh, reset };
  }, [gridRef]);

  useLayoutEffect(() => {
    controller.refresh();
  }, [draft, controller]);

  useEffect(() => () => controller.reset(), [controller]);

  /** Aborta cualquier gesto en curso (p. ej. al salir del modo personalizar). */
  const cancel = useMemo(
    () => () => {
      controller.reset();
      setDraft(null);
      setActive(null);
    },
    [controller],
  );

  const shown = useMemo(() => applyOrder(items, draft), [items, draft]);

  return {
    /** Widgets en el orden que se muestra (con el borrador aplicado mientras se arrastra). */
    items: shown,
    active,
    /** Celda cuya capa levantada se mueve sola: su hueco, no la celda, es lo que se anima al reacomodar. */
    pinnedId: active && active.mode !== 'keyboard' ? active.id : null,
    sorting: active?.mode === 'pointer',
    pointerDown: controller.pointerDown,
    keyDown: controller.keyDown,
    cancel,
  };
}
