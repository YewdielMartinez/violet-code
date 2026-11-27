import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION } from '@/features/dashboard/flip';
import { reorderVisible, setItemVisible, type LayoutItem, type WidgetId } from '@/features/dashboard/layout';
import { WidgetGrid } from '@/features/dashboard/WidgetGrid';
import { WidgetShell } from '@/features/dashboard/WidgetShell';

const ITEMS: LayoutItem[] = [
  { id: 'kpi_alerts', size: 's', visible: true },
  { id: 'kpi_citas', size: 's', visible: true },
  { id: 'alerts', size: 'l', visible: true },
  { id: 'cases', size: 'm', visible: true },
];

const originalMatchMedia = window.matchMedia;

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const order = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.vc-dash__grid > .vc-cell')].map((cell) => cell.dataset.cellId);

const cellOf = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`[data-cell-id="${id}"]`)!;

interface HarnessProps {
  editing?: boolean;
  onReorder?: (id: WidgetId, toIndex: number) => void;
  onAnnounce?: (text: string) => void;
  onHide?: (id: WidgetId) => void;
}

/** Tablero con estado propio, como lo guarda DashboardPage (el orden «guardado» cambia solo al soltar). */
function Harness({ editing = true, onReorder, onAnnounce, onHide }: HarnessProps) {
  const [items, setItems] = useState(ITEMS);
  return (
    <WidgetGrid
      items={items.filter((i) => i.visible)}
      editing={editing}
      render={(id) => <p>widget {id}</p>}
      onMove={() => {}}
      onResize={() => {}}
      onHide={(id) => {
        onHide?.(id);
        setItems((current) => setItemVisible(current, id, false));
      }}
      onReorder={(id, to) => {
        onReorder?.(id, to);
        setItems((current) => reorderVisible(current, id, to));
      }}
      onAnnounce={onAnnounce ?? (() => {})}
    />
  );
}

const handleOf = (title: string) => screen.getByRole('button', { name: new RegExp(`^Arrastrar ${title}\\.`) });

beforeEach(() => {
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

describe('WidgetGrid: mover con teclado (animado igual que con puntero)', () => {
  it('Espacio levanta, las flechas reacomodan en vivo y Espacio guarda al soltar', () => {
    const onReorder = vi.fn();
    const onAnnounce = vi.fn();
    const { container } = render(<Harness onReorder={onReorder} onAnnounce={onAnnounce} />);
    const handle = handleOf('Alertas pendientes');

    fireEvent.keyDown(handle, { key: ' ' });
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-grabbed')).toBe(true);
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-lifted')).toBe(true);
    expect(handle.getAttribute('aria-pressed')).toBe('true');
    expect(onAnnounce).toHaveBeenLastCalledWith(expect.stringContaining('levantado, posición 1 de 4'));

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(order(container)).toEqual(['kpi_citas', 'alerts', 'kpi_alerts', 'cases']);
    expect(onReorder).not.toHaveBeenCalled(); // todavía es un borrador
    expect(onAnnounce).toHaveBeenLastCalledWith('Alertas pendientes: posición 3 de 4.');

    fireEvent.keyDown(handle, { key: ' ' });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith('kpi_alerts', 2);
    expect(order(container)).toEqual(['kpi_citas', 'alerts', 'kpi_alerts', 'cases']);
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-lifted')).toBe(false);
  });

  it('Escape descarta el borrador y deja el orden guardado intacto', () => {
    const onReorder = vi.fn();
    const onAnnounce = vi.fn();
    const { container } = render(<Harness onReorder={onReorder} onAnnounce={onAnnounce} />);
    const handle = handleOf('Citas de hoy');

    fireEvent.keyDown(handle, { key: 'Enter' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(order(container)).toEqual(['kpi_alerts', 'alerts', 'kpi_citas', 'cases']);
    fireEvent.keyDown(handle, { key: 'Escape' });

    expect(order(container)).toEqual(['kpi_alerts', 'kpi_citas', 'alerts', 'cases']);
    expect(onReorder).not.toHaveBeenCalled();
    expect(onAnnounce).toHaveBeenLastCalledWith('Movimiento cancelado.');
    expect(cellOf(container, 'kpi_citas').hasAttribute('data-grabbed')).toBe(false);
  });

  it('no sale de los extremos y soltar sin mover no guarda nada', () => {
    const onReorder = vi.fn();
    const { container } = render(<Harness onReorder={onReorder} />);
    const handle = handleOf('Alertas pendientes');

    fireEvent.keyDown(handle, { key: ' ' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(order(container)[0]).toBe('kpi_alerts');
    fireEvent.keyDown(handle, { key: ' ' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('sin tecla de levantar, las flechas no hacen nada', () => {
    const { container } = render(<Harness />);
    fireEvent.keyDown(handleOf('Alertas pendientes'), { key: 'ArrowRight' });
    expect(order(container)).toEqual(['kpi_alerts', 'kpi_citas', 'alerts', 'cases']);
  });
});

describe('WidgetGrid: arrastre con puntero sobre tamaños mixtos', () => {
  // jsdom no calcula layout: las celdas se miden como una fila de 100 px (según su posición en el DOM).
  const defineBox = (name: 'offsetLeft' | 'offsetTop' | 'offsetWidth' | 'offsetHeight', value: (index: number) => number) =>
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        const parent = this.parentElement;
        return parent?.classList.contains('vc-dash__grid') ? value([...parent.children].indexOf(this)) : 0;
      },
    });

  beforeEach(() => {
    defineBox('offsetLeft', (i) => i * 120);
    defineBox('offsetTop', () => 0);
    defineBox('offsetWidth', () => 100);
    defineBox('offsetHeight', () => 100);
  });

  afterEach(() => {
    for (const name of ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight']) {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
    }
  });

  const pointer = (type: string, x: number, y: number) =>
    act(() => {
      const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      window.dispatchEvent(event);
    });

  it('levanta con el asa, reacomoda en vivo según el puntero y guarda una sola vez al soltar', () => {
    const onReorder = vi.fn();
    const { container } = render(<Harness onReorder={onReorder} />);
    const handle = handleOf('Alertas pendientes');

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-dragging')).toBe(false); // aún no pasa el umbral

    pointer('pointermove', 12, 10); // 2 px: sigue siendo un clic
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-dragging')).toBe(false);

    pointer('pointermove', 260, 20); // sobre la tercera celda (alerts, 2×2)
    const cell = cellOf(container, 'kpi_alerts');
    expect(cell.hasAttribute('data-dragging')).toBe(true);
    expect(cell.hasAttribute('data-lifted')).toBe(true);
    expect(container.querySelector('.vc-dash__grid')?.hasAttribute('data-sorting')).toBe(true);
    expect(order(container)).toEqual(['kpi_citas', 'alerts', 'kpi_alerts', 'cases']);
    expect(onReorder).not.toHaveBeenCalled();

    pointer('pointermove', 130, 20); // de vuelta sobre la segunda celda original
    expect(order(container)).toEqual(['kpi_citas', 'kpi_alerts', 'alerts', 'cases']);

    pointer('pointermove', 370, 20); // cuarta celda
    expect(order(container)).toEqual(['kpi_citas', 'alerts', 'cases', 'kpi_alerts']);

    pointer('pointerup', 370, 20);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith('kpi_alerts', 3);
    expect(order(container)).toEqual(['kpi_citas', 'alerts', 'cases', 'kpi_alerts']);
    // Asentándose: sigue con z-index alto pero ya no «levantado».
    expect(cell.hasAttribute('data-settling')).toBe(true);
    expect(cell.hasAttribute('data-lifted')).toBe(false);
    expect(container.querySelector('.vc-dash__grid')?.hasAttribute('data-sorting')).toBe(false);
  });

  it('termina el asentamiento y libera la celda', () => {
    vi.useFakeTimers();
    const { container } = render(<Harness />);
    fireEvent.pointerDown(handleOf('Alertas pendientes'), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    pointer('pointermove', 130, 20);
    pointer('pointerup', 130, 20);
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-settling')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(MOTION.settle + 100);
    });
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-settling')).toBe(false);
  });

  it('soltar sobre su propio lugar no guarda ni reordena', () => {
    const onReorder = vi.fn();
    const { container } = render(<Harness onReorder={onReorder} />);
    fireEvent.pointerDown(handleOf('Alertas pendientes'), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    pointer('pointermove', 60, 20);
    pointer('pointerup', 60, 20);
    expect(onReorder).not.toHaveBeenCalled();
    expect(order(container)).toEqual(['kpi_alerts', 'kpi_citas', 'alerts', 'cases']);
  });

  it('Escape cancela el arrastre: el orden vuelve y no se guarda nada', () => {
    const onReorder = vi.fn();
    const { container } = render(<Harness onReorder={onReorder} />);
    fireEvent.pointerDown(handleOf('Alertas pendientes'), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    pointer('pointermove', 260, 20);
    expect(order(container)[0]).toBe('kpi_citas');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(order(container)).toEqual(['kpi_alerts', 'kpi_citas', 'alerts', 'cases']);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('con «reducir movimiento» no queda estado de asentamiento', () => {
    setReducedMotion(true);
    const { container } = render(<Harness />);
    fireEvent.pointerDown(handleOf('Alertas pendientes'), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    pointer('pointermove', 260, 20);
    pointer('pointerup', 260, 20);
    expect(cellOf(container, 'kpi_alerts').hasAttribute('data-settling')).toBe(false);
    expect(order(container)).toEqual(['kpi_citas', 'alerts', 'kpi_alerts', 'cases']);
  });

  it('salir del modo personalizar a mitad de un gesto lo cancela', () => {
    const { container, rerender } = render(<Harness editing />);
    fireEvent.pointerDown(handleOf('Alertas pendientes'), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    pointer('pointermove', 260, 20);
    expect(order(container)[0]).toBe('kpi_citas');
    rerender(<Harness editing={false} />);
    expect(order(container)).toEqual(['kpi_alerts', 'kpi_citas', 'alerts', 'cases']);
    expect(container.querySelector('[data-dragging]')).toBeNull();
  });
});

describe('WidgetGrid: ocultar con desvanecido', () => {
  it('la celda se desvanece y solo después sale; los vecinos cierran el hueco', () => {
    vi.useFakeTimers();
    const onHide = vi.fn();
    const { container } = render(<Harness onHide={onHide} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Citas de hoy' }));
    expect(cellOf(container, 'kpi_citas').hasAttribute('data-leaving')).toBe(true);
    expect(onHide).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MOTION.leave + 10);
    });
    expect(onHide).toHaveBeenCalledWith('kpi_citas');
    expect(order(container)).toEqual(['kpi_alerts', 'alerts', 'cases']);
  });

  it('con «reducir movimiento» sale al instante', () => {
    setReducedMotion(true);
    const onHide = vi.fn();
    const { container } = render(<Harness onHide={onHide} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Citas de hoy' }));
    expect(onHide).toHaveBeenCalledWith('kpi_citas');
    expect(order(container)).toEqual(['kpi_alerts', 'alerts', 'cases']);
  });
});

describe('WidgetShell: controles al entrar y salir del modo personalizar', () => {
  const noop = () => {};
  const shell = (editing: boolean) => (
    <WidgetShell id="alerts" size="l" index={1} count={3} editing={editing} onMove={noop} onResize={noop} onHide={noop}>
      <p>contenido</p>
    </WidgetShell>
  );

  it('al salir, los controles se desvanecen (inertes) antes de desmontarse', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(shell(true));
    expect(container.querySelector('.vc-cell__controls')?.getAttribute('data-state')).toBe('in');

    rerender(shell(false));
    const controls = container.querySelector('.vc-cell__controls');
    expect(controls?.getAttribute('data-state')).toBe('out');
    expect(controls?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.vc-cell__inner')?.hasAttribute('inert')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(MOTION.presence + 20);
    });
    expect(container.querySelector('.vc-cell__controls')).toBeNull();
  });

  it('al entrar, parten ocultos (estado «pre») y pasan a «in» en el siguiente cuadro', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(shell(false));
    expect(container.querySelector('.vc-cell__controls')).toBeNull();

    rerender(shell(true));
    expect(container.querySelector('.vc-cell__controls')?.getAttribute('data-state')).toBe('pre');
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(container.querySelector('.vc-cell__controls')?.getAttribute('data-state')).toBe('in');
  });

  it('con «reducir movimiento» entran y salen sin estados intermedios', () => {
    setReducedMotion(true);
    const { container, rerender } = render(shell(false));
    rerender(shell(true));
    expect(container.querySelector('.vc-cell__controls')?.getAttribute('data-state')).toBe('in');
    rerender(shell(false));
    expect(container.querySelector('.vc-cell__controls')).toBeNull();
  });
});
