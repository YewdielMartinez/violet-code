import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhenVisible } from '@/features/dashboard/widgets/useWhenVisible';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void;
  constructor(callback: (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  disconnect() {}
  show() {
    this.callback([{ isIntersecting: true }]);
  }
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useWhenVisible(ref);
  return <div ref={ref}>{ready ? 'chart' : 'skeleton'}</div>;
}

const original = globalThis.IntersectionObserver;
let idle: (() => void)[] = [];

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  idle = [];
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => idle.push(cb));
  vi.stubGlobal('cancelIdleCallback', () => {});
});

afterEach(() => {
  cleanup();
  globalThis.IntersectionObserver = original;
  vi.unstubAllGlobals();
});

describe('useWhenVisible', () => {
  it('sin IntersectionObserver monta de inmediato', () => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('chart');
  });

  it('muestra el esqueleto hasta que es visible y el navegador queda libre', () => {
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('skeleton');

    act(() => FakeIntersectionObserver.instances[0].show());
    expect(container.textContent).toBe('skeleton');

    act(() => idle.forEach((cb) => cb()));
    expect(container.textContent).toBe('chart');
  });
});
