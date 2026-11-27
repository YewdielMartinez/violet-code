import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { findScrollContainer, useScrollToTopOnStep } from '@/shared/hooks/useScrollToTopOnStep';

interface HarnessProps {
  step: number;
  withSteps?: boolean;
  focusHeading?: boolean;
}

function Harness({ step, withSteps = false, focusHeading }: HarnessProps) {
  const formRef = useRef<HTMLFormElement>(null);
  useScrollToTopOnStep(step, formRef, { focusHeading });
  return (
    <main data-testid="scroller" style={{ overflowY: 'auto' }}>
      <form ref={formRef} data-testid="form">
        <section data-mk-step={withSteps ? '' : undefined} data-mk-current="" hidden={false}>
          <h3 data-testid="heading">Paso {step}</h3>
          <button type="button">Siguiente</button>
        </section>
      </form>
    </main>
  );
}

function setup() {
  const view = render(<Harness step={0} />);
  const scroller = view.getByTestId('scroller');
  const form = view.getByTestId('form');
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
  scroller.scrollTop = 500;
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  // El formulario quedó 480 px por encima del borde superior del contenedor (scroll abajo, junto a "Siguiente").
  form.getBoundingClientRect = () => ({ top: -480 }) as DOMRect;
  return { ...view, scroller, form, scrollTo };
}

function mockReducedMotion(reduced: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({ matches: reduced && query.includes('prefers-reduced-motion'), media: query }) as MediaQueryList) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

afterEach(() => cleanup());

describe('useScrollToTopOnStep', () => {
  it('no hace scroll en el primer render', () => {
    const { scrollTo } = setup();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('sube al inicio del formulario (no abajo) al avanzar y al retroceder', () => {
    const { rerender, scrollTo } = setup();
    rerender(<Harness step={1} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // 500 (actual) - 480 (formulario sobre el borde) - 16 (margen) = 4; siempre hacia arriba, nunca más abajo de 500.
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 4, behavior: 'smooth' });

    rerender(<Harness step={0} />);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo.mock.calls[1][0].top).toBeLessThan(500);
  });

  it('no desplaza si el inicio del formulario ya es visible (nunca baja)', () => {
    const { rerender, form, scrollTo } = setup();
    form.getBoundingClientRect = () => ({ top: 24 }) as DOMRect;
    rerender(<Harness step={1} />);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('usa scroll instantáneo con prefers-reduced-motion', () => {
    const restore = mockReducedMotion(true);
    try {
      const { rerender, scrollTo } = setup();
      rerender(<Harness step={1} />);
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 4, behavior: 'auto' });
    } finally {
      restore();
    }
  });

  it('enfoca el encabezado del paso con preventScroll y tabIndex -1', () => {
    const { rerender, getByTestId } = setup();
    const heading = getByTestId('heading');
    const focus = vi.spyOn(heading, 'focus');
    rerender(<Harness step={1} />);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(heading);
  });

  it('con Steps de motion-kit espera a mk:step (paso visible) para enfocar y reafirma el scroll', () => {
    const view = render(<Harness step={0} withSteps />);
    const scroller = view.getByTestId('scroller');
    const form = view.getByTestId('form');
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    scroller.scrollTop = 500;
    scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    form.getBoundingClientRect = () => ({ top: -480 }) as DOMRect;
    const heading = view.getByTestId('heading');

    view.rerender(<Harness step={1} withSteps />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(heading);

    act(() => {
      form.dispatchEvent(new CustomEvent('mk:step', { bubbles: true }));
    });
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(heading);
  });

  it('no mueve el foco con focusHeading: false', () => {
    const view = render(<Harness step={0} focusHeading={false} />);
    view.rerender(<Harness step={1} focusHeading={false} />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('findScrollContainer', () => {
  it('devuelve el ancestro con overflow-y desplazable y null si solo se desplaza la ventana', () => {
    const view = render(
      <div>
        <div data-testid="outer" style={{ overflowY: 'auto' }}>
          <div>
            <span data-testid="inner" />
          </div>
        </div>
        <span data-testid="free" />
      </div>,
    );
    expect(findScrollContainer(view.getByTestId('inner'))).toBe(view.getByTestId('outer'));
    expect(findScrollContainer(view.getByTestId('free'))).toBeNull();
  });
});
