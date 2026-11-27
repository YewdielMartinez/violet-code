import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivacionItem } from '@/domain/models/Derivacion';

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

const {
  useAuthMock,
  listDerivacionesMock,
  listByFichaMock,
  createDerivacionMock,
  updateEstadoMock,
  listCatalogoMock,
  listDirectoryMock,
  listExpedientesMock,
  toastMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  listDerivacionesMock: vi.fn(),
  listByFichaMock: vi.fn(),
  createDerivacionMock: vi.fn(),
  updateEstadoMock: vi.fn(),
  listCatalogoMock: vi.fn(),
  listDirectoryMock: vi.fn(),
  listExpedientesMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseDerivacionRepository', () => ({
  supabaseDerivacionRepository: {
    list: listDerivacionesMock,
    listByFicha: listByFichaMock,
    create: createDerivacionMock,
    updateEstado: updateEstadoMock,
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseSepomexRepository', () => ({
  supabaseSepomexRepository: {
    listCatalogo: listCatalogoMock,
    listAsentamientos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseDirectorioRepository', () => ({
  supabaseDirectorioRepository: {
    list: listDirectoryMock,
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseExpedienteRepository', () => ({
  supabaseExpedienteRepository: {
    list: listExpedientesMock,
    verifyByCurp: vi.fn(),
    registerConsult: vi.fn(),
  },
}));

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    toast: toastMock,
    // El Select del kit es un menú propio; en jsdom se simula con un <select> nativo.
    Select: ({ label, value, options = [], onChange }: { label?: string; value?: string; options?: { value: string; label: string }[]; onChange?: (v: string) => void }) => (
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)}>
        <option value="">Selecciona…</option>
        {options.filter((o) => o.value !== '').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ),
  };
});

import CanalizacionesPage from '@/features/canalizaciones/CanalizacionesPage';
import { DerivacionesExpedientePanel } from '@/features/expedientes/DerivacionesExpedientePanel';

const SAMPLE_DERIVACION: DerivacionItem = {
  id: 'der-1',
  fichaId: 'ficha-1',
  folio: 'SEM-2026-0010',
  usuariaNombre: 'Laura Méndez',
  areaOrigenId: 1,
  areaOrigenNombre: 'Trabajo Social',
  areaDestinoId: 2,
  areaDestinoNombre: 'Psicología',
  institucionId: null,
  institucionNombre: null,
  institucionOtra: null,
  destino: 'psicologia',
  motivo: 'Contención emocional inicial por crisis reciente.',
  fechaDerivacion: '2026-11-26',
  estado: 'pendiente',
  creadoEn: '2026-11-26T12:00:00Z',
};

const SAMPLE_CONCLUIDA: DerivacionItem = {
  ...SAMPLE_DERIVACION,
  id: 'der-2',
  folio: 'SEM-2026-0011',
  usuariaNombre: 'María Robles',
  destino: 'fiscalia',
  areaDestinoId: null,
  areaDestinoNombre: null,
  institucionId: 10,
  institucionNombre: 'Fiscalía General del Estado',
  motivo: 'Acompañamiento para presentar denuncia formal.',
  estado: 'concluida',
};

function renderWithApp(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '*', element: ui }]);
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: { id: 'emp-1', role: 'trabajo_social', areaId: 1 },
  });
  listDerivacionesMock.mockReset().mockResolvedValue([SAMPLE_DERIVACION, SAMPLE_CONCLUIDA]);
  listByFichaMock.mockReset().mockResolvedValue([SAMPLE_DERIVACION]);
  createDerivacionMock.mockReset().mockResolvedValue({ id: 'der-new' });
  updateEstadoMock.mockReset().mockResolvedValue(undefined);
  listCatalogoMock.mockReset().mockResolvedValue([
    { id: 1, clave: 'trabajo_social', nombre: 'Trabajo Social' },
    { id: 2, clave: 'psicologia', nombre: 'Psicología' },
    { id: 3, clave: 'juridico', nombre: 'Jurídico' },
  ]);
  listDirectoryMock.mockReset().mockResolvedValue([
    { id: 10, nombre: 'Fiscalía General del Estado', categoria: 'seguridad', telefono: null, horario: null, direccion: null },
  ]);
  listExpedientesMock.mockReset().mockResolvedValue([
    {
      id: 'ficha-1',
      folio: 'SEM-2026-0010',
      estado: 'abierto',
      creadoEn: '2026-11-20T10:00:00Z',
      actualizadoEn: '2026-11-26T10:00:00Z',
      enListaUrgencias: false,
      persona: {
        id: 'per-1',
        curp: 'MELA900101MSLXXX01',
        nombres: 'Laura',
        apellidoPaterno: 'Méndez',
        apellidoMaterno: null,
        nombreCompleto: 'Laura Méndez',
        sexo: 'M',
        fechaNacimiento: '1990-01-01',
        entidadNacimiento: 'SL',
        celular: null,
      },
    },
  ]);
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function getDialog(selector = 'dialog.vc-canalizacion-form-dialog') {
  return document.querySelector<HTMLDialogElement>(selector);
}

async function openCreateDialog(trigger: HTMLElement, expectedPlacement: 'side' | 'center' = 'side') {
  fireEvent.click(trigger);
  await waitFor(() => expect(getDialog()?.hasAttribute('open')).toBe(true));
  const dialog = getDialog()!;
  expect(dialog.getAttribute('data-mk-placement')).toBe(
    expectedPlacement === 'center' ? null : expectedPlacement,
  );
  return dialog;
}

describe('Canalizaciones: diálogo de alta, detalle lateral y filtros', () => {
  it('registra una canalización desde el panel del expediente con un diálogo simple y avanza estado', async () => {
    renderWithApp(<DerivacionesExpedientePanel fichaId="ficha-1" folio="SEM-2026-0010" />);

    expect(await screen.findByText('Contención emocional inicial por crisis reciente.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /Registrar nueva canalización/i })).toBeNull();

    const dialog = await openCreateDialog(screen.getByRole('button', { name: /Canalizar/i }), 'center');
    await waitFor(() => expect(listCatalogoMock).toHaveBeenCalledWith('area'));

    // Expediente fijo: no hay selector de expediente.
    expect(within(dialog).queryByRole('combobox', { name: 'Expediente' })).toBeNull();
    expect(within(dialog).getByText('SEM-2026-0010')).toBeTruthy();

    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Destino' }), { target: { value: 'juridico' } });
    fireEvent.change(within(dialog).getByLabelText(/Motivo y observaciones/i), {
      target: { value: 'Asesoría jurídica por pensión y guardia.' },
    });
    await waitFor(() => expect(listCatalogoMock).toHaveBeenCalled());
    fireEvent.click(within(dialog).getByRole('button', { name: /Registrar canalización/i }));

    await waitFor(() => {
      expect(createDerivacionMock).toHaveBeenCalledWith({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'juridico',
        areaDestinoId: 3,
        institucionId: null,
        institucionOtra: '',
        motivo: 'Asesoría jurídica por pensión y guardia.',
      });
    });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('Canalización registrada correctamente.', { tone: 'success' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Pasar a en proceso/i }));
    await waitFor(() => expect(updateEstadoMock).toHaveBeenCalledWith('der-1', 'en_proceso'));
  });

  it('muestra la tabla a ancho completo, sin tarjeta fija de detalle ni formulario inline', async () => {
    renderWithApp(<CanalizacionesPage />);

    expect(await screen.findByText('SEM-2026-0010')).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: /Detalle de canalización/i })).toBeNull();
    expect(screen.queryByText('Selecciona una canalización')).toBeNull();
    expect(screen.queryByRole('region', { name: /Registrar nueva canalización/i })).toBeNull();
    expect(screen.queryByRole('group', { name: /Filtrar canalizaciones por estado/i })).toBeNull();
    expect(getDialog('dialog.vc-canalizacion-dialog')?.hasAttribute('open') ?? false).toBe(false);
  });

  it('abre el detalle en un panel lateral al pulsar una fila y cambia el estado', async () => {
    renderWithApp(<CanalizacionesPage />);

    fireEvent.click(await screen.findByText('SEM-2026-0010'));

    await waitFor(() => expect(getDialog('dialog.vc-canalizacion-dialog')?.hasAttribute('open')).toBe(true));
    const drawer = getDialog('dialog.vc-canalizacion-dialog')!;
    expect(drawer.getAttribute('data-mk-placement')).toBe('side');
    expect(within(drawer).getAllByText('Laura Méndez').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('Contención emocional inicial por crisis reciente.')).toBeTruthy();
    expect(within(drawer).getByRole('button', { name: /Abrir expediente/i })).toBeTruthy();

    // Las acciones pesadas se montan al terminar la animación de apertura (0,7 s).
    const advance = await within(drawer).findByRole('button', { name: /Pasar a en proceso/i }, { timeout: 3000 });
    fireEvent.click(advance);
    await waitFor(() => expect(updateEstadoMock).toHaveBeenCalledWith('der-1', 'en_proceso'));
  });

  it('filtra por estado desde el menú «Estado» con conteos', async () => {
    renderWithApp(<CanalizacionesPage />);
    expect(await screen.findByText('SEM-2026-0011')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Filtrar por estado/i }));
    const concluidas = await screen.findByRole('menuitem', { name: /Concluidas/i }, { timeout: 3000 });
    expect(within(concluidas).getByText('1')).toBeTruthy();
    fireEvent.click(concluidas);

    await waitFor(() => expect(screen.queryByText('SEM-2026-0010')).toBeNull());
    expect(screen.getByText('SEM-2026-0011')).toBeTruthy();
  });

  it('valida el alta en línea y aplica RN-01 (menor de 18 años a Psicología)', async () => {
    const [base] = await listExpedientesMock();
    listExpedientesMock.mockResolvedValue([
      { ...base, persona: { ...base.persona, fechaNacimiento: `${new Date().getFullYear() - 10}-01-01` } },
    ]);
    renderWithApp(<CanalizacionesPage />);
    await screen.findByText('SEM-2026-0010');

    const dialog = await openCreateDialog(screen.getByRole('button', { name: /Nueva canalización/i }));

    // Vacío: errores inline y no se llama al repositorio.
    // El cuerpo del formulario se monta tras el primer frame (skeleton mientras tanto).
    fireEvent.click(await within(dialog).findByRole('button', { name: /Registrar canalización/i }));
    expect(await within(dialog).findByText('Selecciona el expediente a canalizar.')).toBeTruthy();
    expect(within(dialog).getByText('Describe el motivo de la canalización.')).toBeTruthy();
    expect(createDerivacionMock).not.toHaveBeenCalled();

    fireEvent.focus(within(dialog).getByRole('combobox', { name: 'Expediente' }));
    const expedienteOption = await within(dialog).findByRole('option', { name: /SEM-2026-0010/ });
    fireEvent.click(expedienteOption);
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Destino' }), { target: { value: 'psicologia' } });
    expect(await within(dialog).findByText(/mayores de 18 años \(RN-01\)/)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/Motivo y observaciones/i), { target: { value: 'Contención.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Registrar canalización/i }));
    await waitFor(() => expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0));
    expect(createDerivacionMock).not.toHaveBeenCalled();

    // Destino externo permitido: pide la institución y registra.
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Destino' }), { target: { value: 'refugio' } });
    fireEvent.change(within(dialog).getByLabelText(/Nombre de la institución externa/i), {
      target: { value: 'Casa Amiga' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Registrar canalización/i }));
    await waitFor(() =>
      expect(createDerivacionMock).toHaveBeenCalledWith({
        fichaId: 'ficha-1',
        areaOrigenId: 1,
        destino: 'refugio',
        areaDestinoId: null,
        institucionId: null,
        institucionOtra: 'Casa Amiga',
        motivo: 'Contención.',
      }),
    );
  });

  it('permite cerrar el panel de nueva canalización y volver a abrirlo sin quedarse pegado', async () => {
    renderWithApp(<CanalizacionesPage />);
    await screen.findByText('SEM-2026-0010');

    const trigger = screen.getByRole('button', { name: /Nueva canalización/i });
    const firstDialog = await openCreateDialog(trigger);

    fireEvent.click(within(firstDialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(getDialog()?.hasAttribute('open') ?? false).toBe(false), { timeout: 2000 });

    const reopenedDialog = await openCreateDialog(trigger);
    expect(reopenedDialog.hasAttribute('open')).toBe(true);
  });
});
