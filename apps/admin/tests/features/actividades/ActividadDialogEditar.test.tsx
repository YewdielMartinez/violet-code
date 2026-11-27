import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActividadPreventivaItem } from '@/domain/models/ActividadPreventiva';
import type { ActividadDialogProps } from '@/features/actividades/ActividadDialog';
import { act } from './fixtures';

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

const { toastMock, actualizarMock, listTiposMock, listEmpleadosMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  actualizarMock: vi.fn(),
  listTiposMock: vi.fn(),
  listEmpleadosMock: vi.fn(),
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yewdiel21/motion-kit/react')>()),
  toast: toastMock,
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseActividadPreventivaRepository', () => ({
  supabaseActividadPreventivaRepository: {
    list: vi.fn().mockResolvedValue([]),
    registrar: vi.fn(),
    actualizar: actualizarMock,
    actualizarEstado: vi.fn(),
    listTipos: listTiposMock,
    listEmpleados: listEmpleadosMock,
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseSepomexRepository', () => ({
  supabaseSepomexRepository: {
    listCatalogo: vi.fn().mockResolvedValue([]),
    listAsentamientos: vi.fn().mockResolvedValue([]),
  },
}));

import { ActividadDialog } from '@/features/actividades/ActividadDialog';

const HIDDEN = { hidden: true } as const;
const AHORA = new Date('2026-12-03T17:00:00Z');

const PENDIENTE = act('e1', '2026-12-04T17:00:00Z', {
  titulo: 'Violencia en el noviazgo',
  sede: 'Secundaria Técnica 12',
  tipoInstitucion: 'escuela',
  nivelEducativo: 'secundaria',
  numeroAsistentes: 80,
  participantes: [{ empleadoId: 'emp-1', nombre: 'Laura Pérez', rol: 'psicologia' }],
  actualizadoEn: '2026-12-01T10:00:00.123456+00:00',
  creadoPorNombre: 'Marta Ruiz',
});

function renderDialog(actividad: ActividadPreventivaItem, puedeRegistrar = true, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const state: ActividadDialogProps['state'] = { kind: 'detalle', actividad };
  render(
    <QueryClientProvider client={client}>
      <ActividadDialog state={state} onClose={onClose} ahora={AHORA} puedeRegistrar={puedeRegistrar} />
    </QueryClientProvider>,
  );
  return { onClose };
}

/** El menú ⋮ monta tras el morph de apertura (`useDialogSettled`). */
async function abrirMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Más acciones', ...HIDDEN }));
}

async function abrirEdicion(actividad: ActividadPreventivaItem = PENDIENTE, onClose = vi.fn()) {
  renderDialog(actividad, true, onClose);
  await screen.findByText('Lugar');
  await abrirMenu();
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Editar', ...HIDDEN }));
  return { onClose, titulo: (await screen.findByLabelText('Título *')) as HTMLInputElement };
}

/** La confirmación vive siempre montada: «abierta» es que su `<dialog>` esté abierto. */
function confirmacionAbierta(): boolean {
  return Array.from(document.querySelectorAll('dialog')).some((d) => d.open && d.textContent?.includes('Cambios sin guardar'));
}

beforeEach(() => {
  listTiposMock.mockResolvedValue([
    { id: 1, clave: 'conferencia', nombre: 'Conferencia' },
    { id: 2, clave: 'taller', nombre: 'Taller' },
  ]);
  listEmpleadosMock.mockResolvedValue([{ id: 'emp-1', nombre: 'Laura Pérez', rol: 'psicologia' }]);
});

afterEach(() => {
  cleanup();
  toastMock.mockReset();
  actualizarMock.mockReset();
});

describe('ActividadDialog · edición en el mismo diálogo', () => {
  it('«Editar» solo aparece para pendientes y con actividad.registrar', async () => {
    renderDialog(act('r', '2026-12-04T17:00:00Z', { estado: 'realizada' }));
    await screen.findByText('Lugar');
    expect(screen.queryByRole('button', { name: 'Más acciones', ...HIDDEN })).toBeNull();
    cleanup();

    renderDialog(PENDIENTE, false);
    await screen.findByText('Lugar');
    expect(screen.queryByRole('button', { name: 'Más acciones', ...HIDDEN })).toBeNull();
    cleanup();

    renderDialog(PENDIENTE, true);
    await screen.findByText('Lugar');
    await abrirMenu();
    expect(screen.getByRole('menuitem', { name: 'Editar', ...HIDDEN })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Cancelar actividad', ...HIDDEN })).toBeTruthy();
  });

  it('pasa del detalle al formulario precargado dentro del mismo diálogo', async () => {
    const { titulo } = await abrirEdicion();

    expect(titulo.value).toBe('Violencia en el noviazgo');
    expect((screen.getByLabelText(/^Sede \*/) as HTMLInputElement).value).toBe('Secundaria Técnica 12');
    expect(screen.getByRole('heading', { name: 'Editar actividad', ...HIDDEN })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar cambios', ...HIDDEN })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver', ...HIDDEN })).toBeTruthy();
    // El detalle ya no se ve y la vista entrante desliza hacia adelante.
    expect(screen.queryByText('Registrada por Marta Ruiz.')).toBeNull();
    expect(document.querySelector('.vc-dlg-view')?.getAttribute('data-dir')).toBe('forward');
    // Un solo diálogo de actividad.
    expect(document.querySelectorAll('dialog.act-dialog')).toHaveLength(1);
  });

  it('guarda los cambios con el bloqueo optimista, avisa y vuelve al detalle con los datos nuevos', async () => {
    actualizarMock.mockResolvedValue({ actividadId: 'e1', totalParticipantes: 1, actualizadoEn: '2026-12-02T10:00:00.5+00:00' });
    const { titulo } = await abrirEdicion();

    fireEvent.change(titulo, { target: { value: '  Taller de igualdad ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios', ...HIDDEN }));

    await waitFor(() => expect(actualizarMock).toHaveBeenCalledTimes(1));
    expect(actualizarMock.mock.calls[0][0]).toMatchObject({
      actividadId: 'e1',
      actualizadoEn: '2026-12-01T10:00:00.123456+00:00',
      titulo: '  Taller de igualdad ',
      tipoActividadId: 1,
      tipoInstitucion: 'escuela',
      nivelEducativo: 'secundaria',
      sede: 'Secundaria Técnica 12',
      numeroAsistentes: 80,
      participantesIds: ['emp-1'],
      programadaEn: expect.stringMatching(/^2026-12-04T\d\d:\d\d:00-07:00$/),
    });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Cambios de la actividad guardados.', { tone: 'success' }));
    // Vuelve al detalle, deslizando hacia atrás, ya con el título nuevo.
    expect(await screen.findByText('Taller de igualdad')).toBeTruthy();
    expect(screen.queryByLabelText('Título *')).toBeNull();
    expect(document.querySelector('.vc-dlg-view')?.getAttribute('data-dir')).toBe('back');
  });

  it('valida con las reglas del alta y no llama al servidor', async () => {
    const { titulo } = await abrirEdicion();

    fireEvent.change(titulo, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios', ...HIDDEN }));

    expect(await screen.findByText('El título de la actividad debe tener entre 1 y 200 caracteres.')).toBeTruthy();
    expect(actualizarMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Título *')).toBeTruthy();
  });

  it('si el servidor rechaza el guardado se queda en el formulario con lo capturado', async () => {
    actualizarMock.mockRejectedValue({ code: '23505', message: 'Esta actividad fue modificada por otra persona. Recarga los datos.' });
    const { titulo } = await abrirEdicion();

    fireEvent.change(titulo, { target: { value: 'Otro título' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios', ...HIDDEN }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('Esta actividad fue modificada por otra persona. Recarga los datos.', {
        tone: 'error',
      }),
    );
    expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe('Otro título');
    expect(screen.getByRole('button', { name: 'Guardar cambios', ...HIDDEN })).toBeTruthy();
  });

  it('«Cancelar» sin cambios vuelve al detalle sin guardar ni confirmar', async () => {
    await abrirEdicion();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar', ...HIDDEN }));

    expect(await screen.findByText('Lugar')).toBeTruthy();
    expect(actualizarMock).not.toHaveBeenCalled();
    expect(confirmacionAbierta()).toBe(false);
    expect(document.querySelector('.vc-dlg-view')?.getAttribute('data-dir')).toBe('back');
  });

  it('con cambios pide confirmación: seguir editando conserva lo escrito y descartar vuelve al detalle', async () => {
    const { titulo } = await abrirEdicion();
    fireEvent.change(titulo, { target: { value: 'Cambiado' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar', ...HIDDEN }));
    await waitFor(() => expect(confirmacionAbierta()).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando', ...HIDDEN }));
    expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe('Cambiado');

    fireEvent.click(screen.getByRole('button', { name: 'Volver', ...HIDDEN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar cambios', ...HIDDEN }));

    expect(await screen.findByText('Lugar')).toBeTruthy();
    expect(screen.getByText('Violencia en el noviazgo')).toBeTruthy();
    expect(actualizarMock).not.toHaveBeenCalled();
  });

  it('cerrar el diálogo con cambios sin guardar pide confirmación y no cierra hasta descartar', async () => {
    const onClose = vi.fn();
    const { titulo } = await abrirEdicion(PENDIENTE, onClose);
    fireEvent.change(titulo, { target: { value: 'Cambiado' } });

    const dialog = document.querySelector('dialog.act-dialog') as HTMLDialogElement;
    const cierre = new CustomEvent('mk:close', { bubbles: true, cancelable: true });
    dialog.dispatchEvent(cierre);

    expect(cierre.defaultPrevented).toBe(true);
    await waitFor(() => expect(confirmacionAbierta()).toBe(true));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios', ...HIDDEN }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cerrar sin cambios no se frena', async () => {
    await abrirEdicion();

    const dialog = document.querySelector('dialog.act-dialog') as HTMLDialogElement;
    const cierre = new CustomEvent('mk:close', { bubbles: true, cancelable: true });
    dialog.dispatchEvent(cierre);

    expect(cierre.defaultPrevented).toBe(false);
  });
});
