import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

const { toastMock, registrarMock, listTiposMock, listEmpleadosMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
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

function renderDialog(state: ActividadDialogProps['state'], onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <ActividadDialog state={state} onClose={onClose} ahora={AHORA} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

beforeEach(() => {
  listTiposMock.mockResolvedValue(TIPOS);
  listEmpleadosMock.mockResolvedValue([{ id: 'emp-1', nombre: 'Laura Pérez', rol: 'psicologia' }]);
  registrarMock.mockResolvedValue({ actividadId: 'nueva', totalParticipantes: 1 });
});

afterEach(() => {
  cleanup();
  toastMock.mockReset();
  registrarMock.mockReset();
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
  it('muestra los datos de la actividad y el personal participante', async () => {
    renderDialog({
      kind: 'detalle',
      actividad: act('d1', '2026-12-04T17:00:00Z', {
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
      }),
    });

    expect(await screen.findByText('Secundaria Técnica 12')).toBeTruthy();
    expect(screen.getAllByText('Violencia en el noviazgo').length).toBeGreaterThan(0);
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Escuela · Secundaria')).toBeTruthy();
    expect(screen.getByText('Centro · CP 81200 · Ahome')).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
    expect(screen.getByText('Laura Pérez')).toBeTruthy();
    expect(screen.getByText('Registrada por Marta Ruiz.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar actividad', ...HIDDEN })).toBeNull();
  });
});
