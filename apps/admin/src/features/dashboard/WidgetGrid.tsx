import { Component, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { orderSignature } from './dragSort';
import { captureFlip, MOTION, playFlip, prefersReducedMotion, type FlipSnapshot } from './flip';
import type { LayoutItem, WidgetId, WidgetSize } from './layout';
import { useWidgetDrag } from './useWidgetDrag';
import { WidgetShell, type CellPhase } from './WidgetShell';

interface FlipGridProps {
  rootRef: RefObject<HTMLDivElement | null>;
  /** Cambia cuando algo mueve o redimensiona celdas: dispara la animación FLIP. */
  signature: string;
  /** Celda cuyo widget en vuelo se mueve solo; de ella solo se anima el hueco. */
  pinnedId: string | null;
  sorting: boolean;
  initial: boolean;
  children: ReactNode;
}

/**
 * Cuadrícula con animación de reacomodo FLIP. Es una clase para usar `getSnapshotBeforeUpdate`, el único
 * punto del ciclo de React donde se puede leer el DOM justo ANTES de que cambie (posiciones visuales de
 * origen) y `componentDidUpdate` para animar hacia las nuevas, antes de pintar.
 */
class FlipGrid extends Component<FlipGridProps, object, FlipSnapshot | null> {
  getSnapshotBeforeUpdate(prev: FlipGridProps): FlipSnapshot | null {
    const root = this.props.rootRef.current;
    if (!root || prev.signature === this.props.signature) return null;
    return captureFlip(root, prev.pinnedId);
  }

  componentDidUpdate(_prev: FlipGridProps, _state: object, snapshot: FlipSnapshot | null) {
    const root = this.props.rootRef.current;
    if (root && snapshot) playFlip(root, snapshot, this.props.pinnedId);
  }

  render() {
    const { rootRef, sorting, initial, children } = this.props;
    return (
      <div
        ref={rootRef}
        className="vc-dash__grid"
        data-sorting={sorting || undefined}
        data-initial={initial || undefined}
      >
        {children}
      </div>
    );
  }
}

interface GridProps {
  items: LayoutItem[];
  editing: boolean;
  /** Algo fuera de la cuadrícula la empuja (p. ej. el panel de personalizar): se anima el desplazamiento. */
  shiftKey?: string;
  render: (id: WidgetId) => ReactNode;
  onMove: (id: WidgetId, delta: -1 | 1) => void;
  onResize: (id: WidgetId, size: WidgetSize) => void;
  onHide: (id: WidgetId) => void;
  onReorder: (id: WidgetId, toIndex: number) => void;
  onAnnounce: (text: string) => void;
}

/**
 * Cuadrícula de widgets del tablero.
 * - Arrastre con asa (puntero) o teclado: ver `useWidgetDrag`.
 * - Reacomodo, cambio de tamaño y aparición: FLIP (transform/opacity).
 * - Ocultar: la celda se desvanece y recién entonces sale, para que los vecinos cierren el hueco.
 */
export function WidgetGrid({ items, editing, shiftKey = '', render, onMove, onResize, onHide, onReorder, onAnnounce }: GridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useWidgetDrag({ items, gridRef, onReorder, onAnnounce });
  const shown = drag.items;
  const signature = orderSignature(shown, shiftKey);

  // La entrada escalonada solo vale para la primera pintura; los widgets que aparecen después usan FLIP.
  const [initial, setInitial] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setInitial(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const { cancel } = drag;
  useEffect(() => {
    if (!editing) cancel();
  }, [editing, cancel]);

  const [leaving, setLeaving] = useState<WidgetId | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );
  const hide = (id: WidgetId) => {
    if (leaving) return;
    if (prefersReducedMotion()) {
      onHide(id);
      return;
    }
    setLeaving(id);
    leaveTimer.current = setTimeout(() => {
      setLeaving(null);
      onHide(id);
    }, MOTION.leave);
  };

  const phaseOf = (id: WidgetId): CellPhase | undefined => {
    if (drag.active?.id !== id) return undefined;
    return drag.active.mode === 'pointer' ? 'drag' : drag.active.mode === 'keyboard' ? 'grab' : 'settle';
  };

  return (
    <div className="vc-dash">
      <FlipGrid rootRef={gridRef} signature={signature} pinnedId={drag.pinnedId} sorting={drag.sorting} initial={initial}>
        {shown.map((item, index) => (
          <WidgetShell
            key={item.id}
            id={item.id}
            size={item.size}
            index={index}
            count={shown.length}
            editing={editing}
            phase={phaseOf(item.id)}
            leaving={leaving === item.id}
            onMove={onMove}
            onResize={onResize}
            onHide={hide}
            onHandlePointerDown={drag.pointerDown}
            onHandleKeyDown={drag.keyDown}
          >
            {render(item.id)}
          </WidgetShell>
        ))}
      </FlipGrid>
    </div>
  );
}
