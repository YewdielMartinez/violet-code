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

const { toastMock, registrarMock, actualizarEstadoMock, listTiposMock, listEmpleadosMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  actualizarEstadoMock: vi.fn(),
  registrarMock: vi.fn(),
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
    registrar: registrarMock,
    actualizarEstado: actualizarEstadoMock,
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

const TIPOS = [
  { id: 1, clave: 'conferencia', nombre: 'Conferencia' },
  { id: 2, clave: 'taller', nombre: 'Taller' },
];

function renderDialog(state: ActividadDialogProps['state'], onClose = vi.fn(), puedeRegistrar = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <ActividadDialog state={state} onClose={onClose} ahora={AHORA} puedeRegistrar={puedeRegistrar} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

beforeEach(() => {
  listTiposMock.mockResolvedValue(TIPOS);
  listEmpleadosMock.mockResolvedValue([{ id: 'emp-1', nombre: 'Laura Pérez', rol: 'psicologia' }]);
  registrarMock.mockResolvedValue({ actividadId: 'nueva', totalParticipantes: 1 });
  actualizarEstadoMock.mockResolvedValue({ actividadId: 'x', estado: 'realizada', realizadaEn: null });
});

afterEach(() => {
  cleanup();
  toastMock.mockReset();
  registrarMock.mockReset();
  actualizarEstadoMock.mockReset();
});

describe('ActividadDialog · nueva actividad', () => {
  it('no envía y marca los campos obligatorios si el formulario está vacío', async () => {
    const { onClose } = renderDialog({ kind: 'crear' });

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar actividad', ...HIDDEN }));

    expect(await screen.findByText('El título de la actividad debe tener entre 1 y 200 caracteres.')).toBeTruthy();
    expect(screen.getByText('Selecciona el tipo de actividad preventiva.')).toBeTruthy();
    expect(screen.getByText('Selecciona el tipo de institución.')).toBeTruthy();
    expect(screen.getByText('La sede de la actividad debe tener entre 1 y 200 caracteres.')).toBeTruthy();
    expect(screen.getByText('Revisa los campos marcados.')).toBeTruthy();
    expect(registrarMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el nivel educativo solo aparece cuando la institución es una escuela', async () => {
    renderDialog({ kind: 'crear' });

    expect(screen.queryByRole('radiogroup', { name: 'Nivel educativo', ...HIDDEN })).toBeNull();
    fireEvent.click(await screen.findByRole('radio', { name: 'Escuela', ...HIDDEN }));
    expect(screen.getByRole('radiogroup', { name: 'Nivel educativo', ...HIDDEN })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Empresa privada', ...HIDDEN }));
    expect(screen.queryByRole('radiogroup', { name: 'Nivel educativo', ...HIDDEN })).toBeNull();
  });

  it('registra la actividad, avisa con un toast y cierra el diálogo', async () => {
    const { onClose } = renderDialog({ kind: 'crear' });

    fireEvent.change(await screen.findByLabelText('Título de la actividad'), { target: { value: '  Violencia en el noviazgo ' } });
    fireEvent.click(await screen.findByRole('radio', { name: 'Taller', ...HIDDEN }));
    fireEvent.click(screen.getByRole('radio', { name: 'Escuela', ...HIDDEN }));
    fireEvent.click(screen.getByRole('radio', { name: 'Secundaria', ...HIDDEN }));
    fireEvent.change(screen.getByLabelText('Sede de la actividad'), { target: { value: 'Secundaria Técnica 12' } });
    fireEvent.change(screen.getByLabelText('Número de asistentes'), { target: { value: '80' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Laura Pérez', ...HIDDEN }));

    fireEvent.click(screen.getByRole('button', { name: 'Registrar actividad', ...HIDDEN }));

    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(1));
    expect(registrarMock.mock.calls[0][0]).toMatchObject({
      titulo: '  Violencia en el noviazgo ',
      tipoActividadId: 2,
      tipoInstitucion: 'escuela',
      nivelEducativo: 'secundaria',
      sede: 'Secundaria Técnica 12',
      numeroAsistentes: 80,
      participantesIds: ['emp-1'],
      asentamientoId: null,
    });
    expect(registrarMock.mock.calls[0][0].programadaEn).toMatch(/T09:00:00-07:00$/);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Actividad registrada'), { tone: 'success' });
  });

  it('muestra el error del servidor y no cierra el diálogo', async () => {
    registrarMock.mockRejectedValue({ code: '42501', message: 'Sin permiso' });
    const { onClose } = renderDialog({ kind: 'crear' });

    fireEvent.change(await screen.findByLabelText('Título de la actividad'), { target: { value: 'Taller' } });
    fireEvent.click(await screen.findByRole('radio', { name: 'Taller', ...HIDDEN }));
    fireEvent.click(screen.getByRole('radio', { name: 'Comunidad', ...HIDDEN }));
    fireEvent.change(screen.getByLabelText('Sede de la actividad'), { target: { value: 'Parque' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar actividad', ...HIDDEN }));

    expect(await screen.findByText('Tu rol no tiene permiso para esta acción.')).toBeTruthy();
    expect(toastMock).toHaveBeenCalledWith('Tu rol no tiene permiso para esta acción.', { tone: 'error' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ActividadDialog · detalle', () => {
  const COMPLETA = act('d1', '2026-12-04T17:00:00Z', {
    titulo: 'Violencia en el noviazgo',
    sede: 'Secundaria Técnica 12',
    tipoInstitucion: 'escuela',
    nivelEducativo: 'secundaria',
    asentamientoNombre: 'Centro',
    codigoPostal: '81200',
    municipio: 'Ahome',
    numeroAsistentes: 80,
    participantes: [{ empleadoId: 'e1', nombre: 'Laura Pérez', rol: 'psicologia' }],
    creadoPorNombre: 'Marta Ruiz',
  });

  async function abrir(actividad: ActividadPreventivaItem, puedeRegistrar = true) {
    const utils = renderDialog({ kind: 'detalle', actividad }, vi.fn(), puedeRegistrar);
    await screen.findByText('Lugar');
    return utils;
  }

  /** El menú ⋮ monta tras el morph de apertura (`useDialogSettled`). */
  async function abrirMenu() {
    await screen.findByRole('button', { name: 'Más acciones', ...HIDDEN });
  }

  it('muestra los datos de la actividad en tarjetas tonales como el detalle de la cita', async () => {
    await abrir(COMPLETA);

    expect(screen.getByRole('heading', { name: 'Actividad', ...HIDDEN })).toBeTruthy();
    expect(screen.getByText('Violencia en el noviazgo')).toBeTruthy();
    expect(screen.getByText('Fecha y hora')).toBeTruthy();
    expect(screen.getByText('Secundaria Técnica 12')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Escuela · Secundaria')).toBeTruthy();
    expect(screen.getByText('Centro · CP 81200 · Ahome')).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
    expect(screen.getByText('Laura Pérez')).toBeTruthy();
    expect(screen.getByText('Registrada por Marta Ruiz.')).toBeTruthy();
    expect(screen.queryByText('Vencida')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar actividad', ...HIDDEN })).toBeNull();
  });

  it('una pendiente con fecha pasada muestra «Vencida» y la pista para cerrarla', async () => {
    await abrir(act('v', '2026-12-01T17:00:00Z'));
    expect(screen.getByText('Vencida')).toBeTruthy();
    expect(screen.getByText(/sigue pendiente/)).toBeTruthy();
  });

  it('sin actividad.registrar no hay acciones de estado (ni pie ni menú ⋮)', async () => {
    await abrir(COMPLETA, false);

    expect(screen.getByText('Tu rol no puede modificar esta actividad.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcar como realizada', ...HIDDEN })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reabrir', ...HIDDEN })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Más acciones', ...HIDDEN })).toBeNull();
  });

  it('pendiente: «Marcar como realizada» en el pie y «Cancelar actividad» en el menú ⋮', async () => {
    await abrir(COMPLETA);
    await abrirMenu();

    expect(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Cancelar actividad', ...HIDDEN })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reabrir', ...HIDDEN })).toBeNull();
  });

  it('marca como realizada con asistentes y observaciones, de forma optimista, con toast', async () => {
    let resolver: (v: unknown) => void = () => {};
    actualizarEstadoMock.mockReturnValue(new Promise((res) => (resolver = res)));
    await abrir(COMPLETA);

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));
    fireEvent.change(await screen.findByLabelText('Asistentes (opcional)'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Observaciones de cierre (opcional)'), {
      target: { value: '  Muy participativos ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));

    await waitFor(() => expect(actualizarEstadoMock).toHaveBeenCalledTimes(1));
    expect(actualizarEstadoMock.mock.calls[0][0]).toEqual({
      actividadId: 'd1',
      estado: 'realizada',
      numeroAsistentes: 55,
      observaciones: 'Muy participativos',
    });
    // Optimista: el detalle ya muestra el cambio aunque el servidor no haya respondido.
    expect(await screen.findByText('Realizada')).toBeTruthy();
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText('Muy participativos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reabrir', ...HIDDEN })).toBeTruthy();

    resolver({ actividadId: 'd1', estado: 'realizada', realizadaEn: '2026-12-03T18:00:00Z' });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Actividad marcada como realizada.', { tone: 'success' }));
  });

  it('realizar sin asistentes ni observaciones es válido (ambos opcionales)', async () => {
    await abrir(act('d2', '2026-12-04T17:00:00Z'));

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));

    await waitFor(() => expect(actualizarEstadoMock).toHaveBeenCalledTimes(1));
    expect(actualizarEstadoMock.mock.calls[0][0]).toEqual({
      actividadId: 'd2',
      estado: 'realizada',
      numeroAsistentes: null,
      observaciones: null,
    });
  });

  it('valida asistentes fuera de rango sin llamar al servidor', async () => {
    await abrir(COMPLETA);

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));
    fireEvent.change(await screen.findByLabelText('Asistentes (opcional)'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));

    expect(await screen.findByText('El número de asistentes debe ser un entero entre 0 y 10000.')).toBeTruthy();
    expect(actualizarEstadoMock).not.toHaveBeenCalled();
  });

  it('cancela desde el menú ⋮ con motivo opcional y deja la actividad como cancelada', async () => {
    await abrir(COMPLETA);
    await abrirMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar actividad', ...HIDDEN }));
    fireEvent.change(await screen.findByLabelText('Motivo de cancelación (opcional)'), { target: { value: 'Lluvia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación', ...HIDDEN }));

    await waitFor(() => expect(actualizarEstadoMock).toHaveBeenCalledTimes(1));
    expect(actualizarEstadoMock.mock.calls[0][0]).toEqual({
      actividadId: 'd1',
      estado: 'cancelada',
      motivoCancelacion: 'Lluvia',
    });
    expect(await screen.findByText('Cancelada')).toBeTruthy();
    expect(screen.getByText('Lluvia')).toBeTruthy();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Actividad cancelada.', { tone: 'success' }));
  });

  it('cancelar sin motivo no se bloquea', async () => {
    await abrir(COMPLETA);
    await abrirMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar actividad', ...HIDDEN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cancelación', ...HIDDEN }));

    await waitFor(() => expect(actualizarEstadoMock).toHaveBeenCalledTimes(1));
    expect(actualizarEstadoMock.mock.calls[0][0]).toMatchObject({ estado: 'cancelada', motivoCancelacion: null });
  });

  it.each(['realizada', 'cancelada'] as const)('una %s se puede reabrir como pendiente', async (estado) => {
    await abrir(act('r1', '2026-12-04T17:00:00Z', { estado }));

    expect(screen.queryByRole('button', { name: 'Marcar como realizada', ...HIDDEN })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir', ...HIDDEN }));

    await waitFor(() => expect(actualizarEstadoMock).toHaveBeenCalledTimes(1));
    expect(actualizarEstadoMock.mock.calls[0][0]).toEqual({ actividadId: 'r1', estado: 'pendiente' });
    expect(await screen.findByText('Pendiente')).toBeTruthy();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Actividad reabierta como pendiente.', { tone: 'success' }));
  });

  it('si el servidor rechaza el cambio, revierte el estado, conserva el formulario y avisa', async () => {
    actualizarEstadoMock.mockRejectedValue({ code: '42501', message: 'Sin permiso' });
    await abrir(COMPLETA);

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));
    fireEvent.change(await screen.findByLabelText('Asistentes (opcional)'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como realizada', ...HIDDEN }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('Tu rol no tiene permiso para esta acción.', { tone: 'error' }),
    );
    // Vuelve el panel con lo escrito y el mensaje; el estado sigue siendo Pendiente.
    expect((screen.getByLabelText('Asistentes (opcional)') as HTMLInputElement).value).toBe('55');
    expect(screen.getByText('Tu rol no tiene permiso para esta acción.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver', ...HIDDEN }));
    expect(await screen.findByText('Pendiente')).toBeTruthy();
    expect(screen.queryByText('Realizada')).toBeNull();
  });
});
