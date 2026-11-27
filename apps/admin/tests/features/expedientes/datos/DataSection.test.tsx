import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DataSection,
  Dato,
  DatoGrid,
  FormInlineError,
  SectionFormFooter,
  describeMutationError,
} from '@/features/expedientes/datos/DataSection';

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  });
}

function Harness({ canEdit = true }: { canEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  return (
    <DataSection
      title="Domicilio"
      editLabel="domicilio"
      canEdit={canEdit}
      editing={editing}
      onStartEdit={() => setEditing(true)}
      savedTick={tick}
      editForm={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            setTick((t) => t + 1);
          }}
        >
          <label>
            Calle
            <input name="calle" />
          </label>
          <SectionFormFooter
            pending={false}
            saved={false}
            onCancel={() => setEditing(false)}
            submitLabel="Guardar domicilio"
          />
        </form>
      }
    >
      <DatoGrid>
        <Dato label="Dirección" value="Av. Central 100" />
      </DatoGrid>
    </DataSection>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DataSection (alternancia vista y edición animada)', () => {
  it('muestra la vista y no monta el formulario hasta pulsar «Editar»', () => {
    setReducedMotion(false);
    render(<Harness />);

    expect(screen.getByRole('heading', { name: 'Domicilio' })).toBeTruthy();
    expect(screen.getByText('Av. Central 100')).toBeTruthy();
    expect(screen.queryByLabelText('Calle')).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar domicilio' }).textContent).toBe('Editar');
  });

  it('no muestra el botón «Editar» sin permiso', () => {
    setReducedMotion(false);
    render(<Harness canEdit={false} />);
    expect(screen.queryByRole('button', { name: /Editar/i })).toBeNull();
  });

  it('abre el formulario, enfoca el primer campo y oculta la vista a tecnologías de asistencia', async () => {
    setReducedMotion(false);
    const { container } = render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));

    const input = await screen.findByLabelText('Calle');
    await waitFor(() => expect(document.activeElement).toBe(input));

    const viewPane = container.querySelector('.vc-sec__pane--view');
    expect(viewPane?.getAttribute('aria-hidden')).toBe('true');
    expect(viewPane?.hasAttribute('inert')).toBe(true);
    await waitFor(() => {
      expect(container.querySelector('.vc-sec__pane--edit')?.getAttribute('data-open')).toBe('true');
    });
  });

  it('al cancelar colapsa, desmonta el formulario y devuelve el foco a «Editar»', async () => {
    setReducedMotion(false);
    const { container } = render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await screen.findByLabelText('Calle');
    await waitFor(() =>
      expect(container.querySelector('.vc-sec__pane--edit')?.getAttribute('data-open')).toBe('true'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Mientras dura la animación de salida el formulario sigue montado pero colapsado.
    expect(container.querySelector('.vc-sec__pane--edit')?.getAttribute('data-open')).toBe('false');
    await waitFor(() => expect(screen.queryByLabelText('Calle')).toBeNull(), { timeout: 1500 });

    expect(container.querySelector('.vc-sec__pane--view')?.getAttribute('data-open')).toBe('true');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar domicilio' }));
    });
  });

  it('muestra la palomita «Guardado» en el encabezado tras guardar', async () => {
    setReducedMotion(false);
    render(<Harness />);

    expect(screen.queryByText('Guardado')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await screen.findByLabelText('Calle');
    fireEvent.submit(screen.getByLabelText('Calle').closest('form') as HTMLFormElement);

    const status = await screen.findByText('Guardado');
    expect(status.closest('[role="status"]')).toBeTruthy();
  });

  it('con prefers-reduced-motion monta y desmonta el formulario sin esperar animaciones', () => {
    setReducedMotion(true);
    const { container } = render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    expect(screen.getByLabelText('Calle')).toBeTruthy();
    expect(container.querySelector('.vc-sec__pane--edit')?.getAttribute('data-open')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Calle')).toBeNull();
  });
});

describe('Dato y rejilla de datos', () => {
  it('muestra «Sin registrar» cuando no hay valor', () => {
    render(
      <DatoGrid>
        <Dato label="Referencias" value="   " />
      </DatoGrid>,
    );
    expect(screen.getByText('Referencias')).toBeTruthy();
    expect(screen.getByText('Sin registrar')).toBeTruthy();
  });

  it('resalta una sola vez el valor que cambió, pero no al montar', () => {
    const { container, rerender } = render(<Dato label="Ocupación" value="Docente" />);
    expect(container.querySelector('.vc-dato__flash')).toBeNull();

    rerender(<Dato label="Ocupación" value="Docente" />);
    expect(container.querySelector('.vc-dato__flash')).toBeNull();

    rerender(<Dato label="Ocupación" value="Enfermera" />);
    expect(container.querySelector('.vc-dato__flash')).not.toBeNull();
    expect(screen.getByText('Enfermera')).toBeTruthy();
  });

  it('renderiza la acción de la tarjeta', () => {
    render(<Dato label="CURP" value="ABCD" action={<button type="button">Copiar</button>} />);
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
  });
});

describe('Mensajes de error en línea', () => {
  it('FormInlineError solo se renderiza con mensaje y usa role alert', () => {
    const { rerender } = render(<FormInlineError message={null} />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<FormInlineError message="No se pudo guardar." />);
    expect(screen.getByRole('alert').textContent).toBe('No se pudo guardar.');
  });

  it('describeMutationError distingue conflicto optimista, mensaje propio y respaldo', () => {
    expect(describeMutationError({ code: '23505' }, 'x')).toMatch(/modificado por otra persona/i);
    expect(describeMutationError(new Error('Sin permisos'), 'x')).toBe('Sin permisos');
    expect(describeMutationError('boom', 'Respaldo')).toBe('Respaldo');
  });

  it('SectionFormFooter deshabilita ambos botones mientras guarda', async () => {
    setReducedMotion(false);
    await act(async () => {
      render(<SectionFormFooter pending saved={false} onCancel={vi.fn()} submitLabel="Guardar" />);
    });
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('DataSection: scroll accesible al editar', () => {
  const VIEWPORT = 800;
  const SECTION_HEIGHT = 400;
  let scroller: HTMLElement;
  let scrollTo: ReturnType<typeof vi.fn>;
  let scrollTop: number;
  /** Posicion de la seccion en el contenido desplazable (cambia si crece algo por encima). */
  let sectionOffset: number;

  function mountScrollable(initialTop: number, offset: number) {
    scrollTop = initialTop;
    sectionOffset = offset;
    const view = render(
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        <Harness />
      </div>,
    );
    scroller = view.getByTestId('scroller');
    scrollTo = vi.fn((opts: ScrollToOptions) => {
      scrollTop = opts.top ?? 0;
    });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => VIEWPORT });
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    scroller.getBoundingClientRect = () => ({ top: 0, bottom: VIEWPORT }) as DOMRect;
    const section = view.container.querySelector('section.vc-sec') as HTMLElement;
    section.getBoundingClientRect = () =>
      ({
        top: sectionOffset - scrollTop,
        bottom: sectionOffset - scrollTop + SECTION_HEIGHT,
        height: SECTION_HEIGHT,
      }) as DOMRect;
    return view;
  }

  it('al abrir espera a que termine la expansion y lleva el encabezado arriba con 16 px de margen', async () => {
    setReducedMotion(false);
    mountScrollable(100, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    expect(scrollTo).not.toHaveBeenCalled();

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(scrollTo).toHaveBeenCalledWith({ top: 100 + (1000 - 100) - 16, behavior: 'smooth' });
  });

  it('enfoca el primer campo con preventScroll y anuncia el modo de edicion en una region polite', async () => {
    setReducedMotion(false);
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const { container } = mountScrollable(0, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    const input = await screen.findByLabelText('Calle');
    await waitFor(() => expect(document.activeElement).toBe(input));

    const index = focusSpy.mock.contexts.indexOf(input);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(focusSpy.mock.calls[index][0]).toEqual({ preventScroll: true });

    const live = container.querySelector('.sr-only[aria-live="polite"]');
    expect(live?.textContent).toBe('Editando Domicilio');
  });

  it('no desplaza si la seccion ya cabe completa en la vista', async () => {
    setReducedMotion(false);
    const { container } = mountScrollable(0, 100);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await screen.findByLabelText('Calle');
    await waitFor(
      () =>
        expect(container.querySelector('.vc-sec__pane--edit')?.getAttribute('data-settled')).toBe('true'),
      { timeout: 1500 },
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('al cancelar regresa al scroll exacto previo en paralelo con el colapso y devuelve el foco a Editar', async () => {
    setReducedMotion(false);
    const { container } = mountScrollable(100, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(scrollTop).toBe(984);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Inmediato: el formulario sigue montado (colapsando) y el scroll ya viaja de vuelta.
    expect(container.querySelector('.vc-sec__pane--edit')?.getAttribute('data-open')).toBe('false');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'smooth' });

    await waitFor(() => expect(screen.queryByLabelText('Calle')).toBeNull(), { timeout: 1500 });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar domicilio' })),
    );
  });

  it('Escape cancela la edicion y restaura el scroll', async () => {
    setReducedMotion(false);
    mountScrollable(100, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    const input = await screen.findByLabelText('Calle');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1), { timeout: 1500 });

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'smooth' });
    await waitFor(() => expect(screen.queryByLabelText('Calle')).toBeNull(), { timeout: 1500 });
  });

  it('Escape no cancela si un menu abierto lo consume primero', async () => {
    setReducedMotion(true);
    mountScrollable(0, 100);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    const input = await screen.findByLabelText('Calle');
    input.setAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('Calle')).not.toBeNull();
  });

  it('al guardar tambien regresa al scroll previo', async () => {
    setReducedMotion(false);
    mountScrollable(100, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1), { timeout: 1500 });

    fireEvent.submit(screen.getByLabelText('Calle').closest('form') as HTMLFormElement);

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'smooth' });
    await waitFor(() => expect(screen.queryByLabelText('Calle')).toBeNull(), { timeout: 1500 });
  });

  it('si cambio la altura por encima, no restaura el valor viejo: trae el encabezado a la vista', async () => {
    setReducedMotion(false);
    mountScrollable(100, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1), { timeout: 1500 });

    // Algo por encima crecio 1000 px mientras se editaba: el encabezado quedaria fuera de la vista.
    sectionOffset = 2000;
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 984 + (2000 - 984) - 16, behavior: 'smooth' });
  });

  it('con prefers-reduced-motion el scroll es instantaneo (behavior auto), de ida y de vuelta', async () => {
    setReducedMotion(true);
    mountScrollable(100, 1000);

    fireEvent.click(screen.getByRole('button', { name: 'Editar domicilio' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 984, behavior: 'auto' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'auto' });
    expect(screen.queryByLabelText('Calle')).toBeNull();
  });
});
