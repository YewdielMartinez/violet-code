import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateBox, observedCount, sameSize, sizeOfEntry, useElementBox } from '@/features/dashboard/widgets/box';

type Callback = (entries: ResizeObserverEntry[]) => void;

/** ResizeObserver de prueba: cuenta instancias y permite disparar entradas a mano. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed = new Set<Element>();
  disconnected = false;
  callback: Callback;
  constructor(callback: Callback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
}

const entry = (target: Element, w: number, h: number): ResizeObserverEntry =>
  ({
    target,
    contentRect: { width: w, height: h },
    contentBoxSize: [{ inlineSize: w, blockSize: h }],
  }) as unknown as ResizeObserverEntry;

let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const queued = frames;
  frames = [];
  act(() => queued.forEach((cb) => cb(0)));
};

function Probe({ id, onRender }: { id: string; onRender?: () => void }) {
  const [ref, box] = useElementBox<HTMLDivElement>();
  onRender?.();
  return (
    <div ref={ref} data-testid={id}>
      {box ? `${box.w}x${box.h}` : 'estimate'}
    </div>
  );
}

const original = globalThis.ResizeObserver;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  frames = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = original;
  vi.unstubAllGlobals();
});

describe('useElementBox: observador compartido', () => {
  it('usa un solo ResizeObserver para todos los widgets y lo suelta al desmontar', () => {
    const { unmount, getAllByText } = render(
      <>
        <Probe id="a" />
        <Probe id="b" />
        <Probe id="c" />
      </>,
    );
    expect(getAllByText('estimate')).toHaveLength(3);
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(FakeResizeObserver.instances[0].observed.size).toBe(3);
    expect(observedCount()).toBe(3);

    unmount();
    expect(observedCount()).toBe(0);
    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });

  it('no lee clientWidth/clientHeight: parte de la estimación y la corrige la primera notificación', () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get');
    const { getByTestId } = render(<Probe id="a" />);
    expect(getByTestId('a').textContent).toBe('estimate');

    const [observer] = FakeResizeObserver.instances;
    act(() => observer.callback([entry(getByTestId('a'), 321.4, 150.2)]));
    // Hasta el siguiente cuadro no se notifica a React.
    expect(getByTestId('a').textContent).toBe('estimate');
    runFrame();
    expect(getByTestId('a').textContent).toBe('321x150');
    expect(width).not.toHaveBeenCalled();
    expect(height).not.toHaveBeenCalled();
    width.mockRestore();
    height.mockRestore();
  });

  it('agrupa las notificaciones de varios widgets en un solo cuadro', () => {
    const { getByTestId } = render(
      <>
        <Probe id="a" />
        <Probe id="b" />
      </>,
    );
    const [observer] = FakeResizeObserver.instances;
    act(() => observer.callback([entry(getByTestId('a'), 200, 100)]));
    act(() => observer.callback([entry(getByTestId('b'), 400, 300)]));
    expect(frames).toHaveLength(1);
    runFrame();
    expect(getByTestId('a').textContent).toBe('200x100');
    expect(getByTestId('b').textContent).toBe('400x300');
  });

  it('ignora cajas vacías y cambios de menos de 1 px', () => {
    const onRender = vi.fn();
    const { getByTestId } = render(<Probe id="a" onRender={onRender} />);
    const [observer] = FakeResizeObserver.instances;

    act(() => observer.callback([entry(getByTestId('a'), 0, 0)]));
    runFrame();
    expect(getByTestId('a').textContent).toBe('estimate');

    act(() => observer.callback([entry(getByTestId('a'), 300, 120)]));
    runFrame();
    expect(getByTestId('a').textContent).toBe('300x120');

    const renders = onRender.mock.calls.length;
    act(() => observer.callback([entry(getByTestId('a'), 300.4, 119.7)]));
    runFrame();
    expect(onRender.mock.calls.length).toBe(renders);
    expect(getByTestId('a').textContent).toBe('300x120');

    act(() => observer.callback([entry(getByTestId('a'), 340, 120)]));
    runFrame();
    expect(getByTestId('a').textContent).toBe('340x120');
  });

  it('sin ResizeObserver conserva la estimación (jsdom, SSR)', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    const { getByTestId } = render(<Probe id="a" />);
    expect(getByTestId('a').textContent).toBe('estimate');
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });
});

describe('sizeOfEntry / sameSize / estimateBox', () => {
  it('prefiere contentBoxSize y cae a contentRect', () => {
    const rect = { width: 10.6, height: 20.2 } as DOMRectReadOnly;
    expect(sizeOfEntry({ contentRect: rect, contentBoxSize: [{ inlineSize: 99, blockSize: 88 }] })).toEqual({
      w: 99,
      h: 88,
    });
    expect(sizeOfEntry({ contentRect: rect, contentBoxSize: undefined as never })).toEqual({ w: 11, h: 20 });
  });

  it('considera igual lo que difiere menos de 1 px', () => {
    expect(sameSize({ w: 10, h: 10 }, { w: 10.5, h: 9.6 })).toBe(true);
    expect(sameSize({ w: 10, h: 10 }, { w: 11, h: 10 })).toBe(false);
  });

  it('la estimación depende solo del tamaño de la celda (no del DOM)', () => {
    expect(estimateBox('s')).toMatchObject({ measured: false, size: 's' });
    expect(estimateBox('wide').w).toBeGreaterThan(estimateBox('m').w);
  });
});
