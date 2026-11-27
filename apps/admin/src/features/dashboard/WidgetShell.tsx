import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { MOTION } from './flip';
import { SIZE_SPECS, widgetDef, type WidgetId, type WidgetSize } from './layout';
import { usePresence } from './usePresence';
import { WidgetSizeProvider } from './widgets/box';

/** Estado de arrastre de la celda: drag (puntero), grab (levantado con teclado), settle (asentándose al soltar). */
export type CellPhase = 'drag' | 'grab' | 'settle';

interface WidgetShellProps {
  id: WidgetId;
  size: WidgetSize;
  /** Posición entre los widgets visibles (para el escalonado de entrada y las flechas). */
  index: number;
  count: number;
  editing: boolean;
  onMove: (id: WidgetId, delta: -1 | 1) => void;
  onResize: (id: WidgetId, size: WidgetSize) => void;
  onHide: (id: WidgetId) => void;
  phase?: CellPhase;
  /** Se está ocultando: la celda se desvanece antes de salir de la cuadrícula. */
  leaving?: boolean;
  onHandlePointerDown?: (id: WidgetId, event: PointerEvent<HTMLElement>) => void;
  onHandleKeyDown?: (id: WidgetId, event: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}

const ICON_BUTTON =
  'grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-35';

/**
 * Celda de la cuadrícula: fija el tamaño (columnas × filas), da el tamaño al widget y, en modo
 * personalizar, agrega los controles: asa para arrastrar, flechas, selector de tamaño y ocultar.
 * El contenido queda inerte en edición para que un clic no navegue ni cambie filtros.
 *
 * Capas: la celda ocupa su lugar en la cuadrícula (y es lo que se anima al reacomodar); `.vc-cell__slot` es
 * el hueco que se ve al arrastrar; `.vc-cell__lift` es el widget con sus controles, que se levanta y sigue al puntero.
 */
export function WidgetShell({
  id,
  size,
  index,
  count,
  editing,
  onMove,
  onResize,
  onHide,
  phase,
  leaving,
  onHandlePointerDown,
  onHandleKeyDown,
  children,
}: WidgetShellProps) {
  const def = widgetDef(id);
  const spec = SIZE_SPECS[size];
  const style = { '--i': Math.min(index, 12) } as CSSProperties;
  const controls = usePresence(editing, MOTION.presence);
  const lifted = phase === 'drag' || phase === 'grab';

  return (
    <div
      className="vc-cell"
      data-cs={spec.cols}
      data-rs={spec.rows}
      data-size={size}
      data-editing={editing || undefined}
      data-cell-id={id}
      data-dragging={phase === 'drag' || undefined}
      data-grabbed={phase === 'grab' || undefined}
      data-settling={phase === 'settle' || undefined}
      data-lifted={lifted || undefined}
      data-leaving={leaving || undefined}
      style={style}
    >
      <div className="vc-cell__slot" data-cell-slot="" aria-hidden />
      <div className="vc-cell__lift">
        <div className="vc-cell__inner" inert={editing} aria-hidden={editing || undefined}>
          <WidgetSizeProvider value={size}>{children}</WidgetSizeProvider>
        </div>

        {controls.mounted ? (
          <div
            role="group"
            aria-label={`Controles de ${def.title}`}
            data-state={controls.state}
            inert={controls.state === 'out'}
            className="vc-cell__controls absolute inset-x-2 bottom-2 z-10 flex items-center gap-0.5 rounded-2xl border border-outline-variant bg-surface-container-high p-1 shadow-md"
          >
            <button
              type="button"
              data-vc-handle=""
              aria-pressed={phase === 'grab'}
              aria-label={`Arrastrar ${def.title}. También con teclado: Espacio para levantar, flechas para mover.`}
              title="Arrastrar para reordenar"
              onPointerDown={onHandlePointerDown ? (event) => onHandlePointerDown(id, event) : undefined}
              onKeyDown={onHandleKeyDown ? (event) => onHandleKeyDown(id, event) : undefined}
              className={`${ICON_BUTTON} cursor-grab touch-none select-none`}
            >
              <Icon name="drag_indicator" />
            </button>
            <button
              type="button"
              aria-label={`Mover ${def.title} antes`}
              title="Mover antes"
              disabled={index === 0}
              onClick={() => onMove(id, -1)}
              className={ICON_BUTTON}
            >
              <Icon name="arrow_back" />
            </button>
            <button
              type="button"
              aria-label={`Mover ${def.title} después`}
              title="Mover después"
              disabled={index === count - 1}
              onClick={() => onMove(id, 1)}
              className={ICON_BUTTON}
            >
              <Icon name="arrow_forward" />
            </button>
            <select
              aria-label={`Tamaño de ${def.title}`}
              value={size}
              onChange={(e) => onResize(id, e.target.value as WidgetSize)}
              className="mx-1 h-9 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
              {def.sizes.map((s) => (
                <option key={s} value={s}>
                  {SIZE_SPECS[s].label} ({SIZE_SPECS[s].hint})
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Ocultar ${def.title}`}
              title="Ocultar"
              onClick={() => onHide(id)}
              className={ICON_BUTTON}
            >
              <Icon name="visibility_off" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
