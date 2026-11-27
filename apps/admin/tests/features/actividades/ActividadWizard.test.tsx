import { useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActividadFormValue } from '@/features/actividades/useActividadForm';

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

vi.mock('@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository', () => ({
  supabaseActividadPreventivaRepository: {
    list: vi.fn().mockResolvedValue([]),
    listTipos: vi.fn().mockResolvedValue([{ id: 1, clave: 'taller', nombre: 'Taller' }]),
    listEmpleados: vi.fn().mockResolvedValue([]),
  },
}));

import { ActividadWizardSteps } from '@/features/actividades/ActividadWizard';

const VALUE: ActividadFormValue = {
  titulo: 'Taller',
  tipoActividadId: 1,
  tipoInstitucion: 'comunidad',
  nivelEducativo: '',
  sede: 'Parque',
  direccion: '',
  referencias: '',
  asistentes: '',
  cuando: new Date(2026, 11, 4, 9, 0),
  colonia: null,
  participantes: [],
};

function Harness({ step, withAnchor = true }: { step: number; withAnchor?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <main data-testid="scroller" style={{ overflowY: 'auto' }}>
        <div ref={anchorRef} data-testid="card">
          <ActividadWizardSteps
            formId="f"
            formRef={formRef}
            scrollAnchorRef={withAnchor ? anchorRef : undefined}
            step={step}
            stepError={null}
            invalidField={null}
            value={VALUE}
            onChange={() => {}}
            asentamientos={[]}
            asentamientosLoading={false}
            onNext={() => {}}
            onSubmit={() => {}}
          />
        </div>
      </main>
    </QueryClientProvider>
  );
}

function setup() {
  const view = render(<Harness step={0} />);
  const scroller = screen.getByTestId('scroller');
  const card = screen.getByTestId('card');
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
  scroller.scrollTop = 600;
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  // La tarjeta quedó por encima del borde del contenedor (el scroll estaba abajo, junto al botón «Siguiente»).
  card.getBoundingClientRect = () => ({ top: -580 }) as DOMRect;
  return { ...view, scrollTo };
}

let originalMatchMedia: typeof window.matchMedia;
const windowScrollTo = vi.fn();

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  window.scrollTo = windowScrollTo as unknown as typeof window.scrollTo;
});

afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
  windowScrollTo.mockReset();
});

describe('ActividadWizardSteps · scroll al cambiar de paso', () => {
  it('no hace scroll al montar', () => {
    const { scrollTo } = setup();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('al avanzar sube al inicio del formulario en el contenedor real (no en window)', () => {
    const { rerender, scrollTo } = setup();

    rerender(<Harness step={1} />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 4, behavior: 'smooth' });
    expect(windowScrollTo).not.toHaveBeenCalled();
  });

  it('al retroceder también sube al inicio', () => {
    const { rerender, scrollTo } = setup();
    rerender(<Harness step={1} />);
    scrollTo.mockClear();

    rerender(<Harness step={0} />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('con prefers-reduced-motion el scroll es inmediato', () => {
    window.matchMedia = ((query: string) =>
      ({ matches: query.includes('prefers-reduced-motion'), media: query }) as MediaQueryList) as typeof window.matchMedia;
    const { rerender, scrollTo } = setup();

    rerender(<Harness step={1} />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 4, behavior: 'auto' });
  });

  it('sin scrollAnchorRef usa el formulario como ancla', () => {
    const view = render(<Harness step={0} withAnchor={false} />);
    const scroller = view.getAllByTestId('scroller')[0];
    const form = scroller.querySelector('form') as HTMLFormElement;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    scroller.scrollTop = 300;
    scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    form.getBoundingClientRect = () => ({ top: -280 }) as DOMRect;

    view.rerender(<Harness step={1} withAnchor={false} />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
