import { StrictMode, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Agresor } from '@/domain/models/Agresor';
import type { StaffRole, StaffUser } from '@/domain/models/Auth';
import type { ExpedienteResumen } from '@/domain/models/Persona';

const {
  getByIdMock,
  registerConsultMock,
  listarPorFichaMock,
  registrarAgresorConsultaMock,
  listarParentescosMock,
  listarOcupacionesMock,
  listarAsentamientosMock,
  toastMock,
  useAuthMock,
} = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  registerConsultMock: vi.fn(),
  listarPorFichaMock: vi.fn(),
  registrarAgresorConsultaMock: vi.fn(),
  listarParentescosMock: vi.fn(),
  listarOcupacionesMock: vi.fn(),
  listarAsentamientosMock: vi.fn(),
  toastMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('@/shared/auth/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseExpedienteRepository', () => ({
  supabaseExpedienteRepository: {
    list: vi.fn().mockResolvedValue([]),
    getById: getByIdMock,
    verifyByCurp: vi.fn(),
    registerConsult: registerConsultMock,
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseAgresorRepository', () => ({
  supabaseAgresorRepository: {
    listarPorFicha: listarPorFichaMock,
    crear: vi.fn(),
    actualizar: vi.fn(),
    registrarConsulta: registrarAgresorConsultaMock,
    listarParentescos: listarParentescosMock,
    listarOcupaciones: listarOcupacionesMock,
    listarAsentamientosAhome: listarAsentamientosMock,
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseSepomexRepository', () => ({
  supabaseSepomexRepository: {
    listAsentamientos: vi.fn().mockResolvedValue([]),
    getCatalogosFicha: vi.fn(),
    listCatalogo: (catalogo: string) =>
      catalogo === 'parentesco'
        ? listarParentescosMock()
        : catalogo === 'ocupacion'
          ? listarOcupacionesMock()
          : Promise.resolve([]),
  },
}));

vi.mock('@/features/expedientes/ficha/FichaDetalleResumen', () => ({
  FichaDetalleResumen: () => <div data-testid="ficha-resumen" />,
}));

vi.mock('@/features/expedientes/ficha/FichaGestionAcciones', () => ({
  FichaGestionAcciones: () => <div data-testid="ficha-gestion" />,
}));

vi.mock('@/features/expedientes/DocumentosAdjuntosPanel', () => ({
  DocumentosAdjuntosPanel: () => <div data-testid="documentos-panel" />,
}));

vi.mock('@/features/expedientes/agresor/motionCompat', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    prefersReducedMotion: () => true,
    useAgresorCascade: () => undefined,
    AgresorFlipGroup: Pass,
    AgresorRadioGroup: () => null,
    AgresorGlassSwitch: () => null,
    AgresorDialog: {
      Root: Pass,
      Trigger: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
          {children}
        </button>
      ),
      Content: () => null,
      Header: Pass,
      Title: Pass,
      Close: () => null,
      Body: Pass,
      Footer: Pass,
    },
  };
});

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    useCascade: undefined,
    useTabs: () => ({ current: null }),
    EmptyState: ({
      title,
      description,
      actions,
      onAction,
    }: {
      title?: string;
      description?: string;
      actions?: ReadonlyArray<{ id: string; label: string }>;
      onAction?: (id: string) => void;
    }) => (
      <div>
        <p>{title}</p>
        <p>{description}</p>
        {actions?.map((action) => (
          <button key={action.id} type="button" onClick={() => onAction?.(action.id)}>
            {action.label}
          </button>
        ))}
      </div>
    ),
    Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Select: ({
      label,
      value,
      onChange,
    }: {
      label?: string;
      value?: string;
      onChange?: (v: string) => void;
    }) => (
      <input
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
    LoadingButton: ({ children, type }: { children?: ReactNode; type?: 'button' | 'submit' }) => (
      <button type={type}>{children}</button>
    ),
    toast: toastMock,
  };
});

import ExpedienteDetailPage from '@/features/expedientes/ExpedienteDetailPage';

const SAMPLE_EXPEDIENTE: ExpedienteResumen = {
  id: '55555555-5555-4555-8555-555555555501',
  folio: 'SEM-2026-0001',
  estado: 'en_seguimiento',
  creadoEn: '2026-11-20T10:00:00Z',
  actualizadoEn: '2026-11-25T10:00:00Z',
  enListaUrgencias: true,
  persona: {
    id: '33333333-3333-4333-8333-333333333301',
    curp: 'MEZA910315MSLGRN04',
    nombres: 'Adriana',
    apellidoPaterno: 'Meza',
    apellidoMaterno: 'Gutiérrez',
    nombreCompleto: 'Adriana Meza Gutiérrez',
    sexo: 'M',
    fechaNacimiento: '1991-03-15',
    entidadNacimiento: 'SL',
    celular: '6681000001',
  },
};

const SAMPLE_AGRESOR: Agresor = {
  id: '77777777-7777-4777-8777-777777777701',
  fichaId: SAMPLE_EXPEDIENTE.id,
  nombres: 'Roberto',
  apellidoPaterno: 'Salazar',
  apellidoMaterno: 'Pineda',
  parentescoId: 1,
  parentescoOtro: null,
  asentamientoId: 10,
  codigoPostal: null,
  calle: 'Calle Allende',
  numeroExterior: '305',
  numeroInterior: null,
  referencias: null,
  ocupacionId: 2,
  ocupacionOtra: null,
  drogas: ['marihuana'],
  especificacionDroga: null,
  especificacionArma: null,
  observaciones: 'Antecedentes registrados.',
  activo: true,
  actualizadoEn: '2026-11-25T10:00:00Z',
};

function makeUser(role: StaffRole): StaffUser {
  return {
    id: 'user-1',
    email: 'staff@semujeres.gob.mx',
    displayName: 'Personal de Prueba',
    role,
    areaId: 1,
    areaClave: 'ts',
    areaNombre: 'Trabajo Social',
    dependencia: null,
    activo: true,
    permisos: [],
  };
}

function renderDetailPage(initialPath = `/expedientes/${SAMPLE_EXPEDIENTE.id}`) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/expedientes', element: <div data-testid="expedientes-list" /> },
      { path: '/expedientes/:id', element: <ExpedienteDetailPage /> },
    ],
    { initialEntries: [initialPath] },
  );
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  useAuthMock.mockReset().mockReturnValue({ status: 'authenticated', user: makeUser('trabajo_social') });
  getByIdMock.mockReset().mockResolvedValue(SAMPLE_EXPEDIENTE);
  registerConsultMock.mockReset().mockResolvedValue(undefined);
  listarPorFichaMock.mockReset().mockResolvedValue([SAMPLE_AGRESOR]);
  registrarAgresorConsultaMock.mockReset().mockResolvedValue(undefined);
  listarParentescosMock.mockReset().mockResolvedValue([{ id: 1, clave: 'expareja', nombre: 'Expareja' }]);
  listarOcupacionesMock.mockReset().mockResolvedValue([{ id: 2, clave: 'empleada', nombre: 'Empleada(o)' }]);
  listarAsentamientosMock.mockReset().mockResolvedValue([]);
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ExpedienteDetailPage', () => {
  it('renderiza identidad, resumen y registra consulta una sola vez en StrictMode', async () => {
    renderDetailPage();

    expect(await screen.findByRole('heading', { name: 'Adriana Meza Gutiérrez' })).toBeTruthy();
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal');
    const identityCard = screen.getByRole('region', { name: 'Resumen de la usuaria' });
    expect(within(identityCard).getByText('SEM-2026-0001')).toBeTruthy();
    expect(within(identityCard).getByText('MEZA910315MSLGRN04')).toBeTruthy();
    expect(within(identityCard).getByText('En seguimiento')).toBeTruthy();
    expect(within(identityCard).getByText('Urgente')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Llamar' })).toBeNull();
    expect(screen.getByTestId('ficha-resumen')).toBeTruthy();
    // La zona de gestión ya no vive en la pestaña Datos (archivar/desarchivar está en el menú del listado).
    expect(screen.queryByTestId('ficha-gestion')).toBeNull();

    await waitFor(() => {
      expect(registerConsultMock).toHaveBeenCalledTimes(1);
    });
    expect(registerConsultMock).toHaveBeenCalledWith(SAMPLE_EXPEDIENTE.id);
  });

  it('oculta las pestañas sensibles para recepción y UMECA', async () => {
    for (const role of ['recepcion', 'umeca'] as const) {
      cleanup();
      useAuthMock.mockReturnValue({ status: 'authenticated', user: makeUser(role) });
      renderDetailPage();

      expect(await screen.findByTestId('ficha-resumen')).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Datos/i })).toBeTruthy();
      expect(screen.queryByRole('tab', { name: /Persona agresora/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Documentos/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Canalizaciones/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Órdenes/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Seguimiento/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Notas privadas/i })).toBeNull();
    }
  });

  it('monta Persona agresora al hacer clic, la mantiene oculta al volver a Datos y no duplica bitácora', async () => {
    renderDetailPage();

    const tabAgresor = await screen.findByRole('tab', { name: /Persona agresora/i });
    fireEvent.click(tabAgresor);

    await waitFor(() => {
      expect(screen.getByText('Roberto Salazar Pineda')).toBeTruthy();
    });
    expect(registrarAgresorConsultaMock).toHaveBeenCalledTimes(1);
    expect(registrarAgresorConsultaMock).toHaveBeenCalledWith('ficha_registro', SAMPLE_EXPEDIENTE.id);

    fireEvent.click(screen.getByRole('tab', { name: /Datos/i }));
    expect(screen.getByTestId('ficha-resumen')).toBeTruthy();
    expect(
      screen.getByText('Roberto Salazar Pineda').closest('[role="tabpanel"]')?.hasAttribute('hidden'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: /Persona agresora/i }));
    expect(
      screen.getByText('Roberto Salazar Pineda').closest('[role="tabpanel"]')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(registrarAgresorConsultaMock).toHaveBeenCalledTimes(1);
  });

  it('muestra «Expediente no encontrado» cuando getById devuelve null y permite volver al listado', async () => {
    getByIdMock.mockResolvedValueOnce(null);
    renderDetailPage();

    expect(await screen.findByText('Expediente no encontrado')).toBeTruthy();
    expect(registerConsultMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Volver a expedientes' }));
    expect(await screen.findByTestId('expedientes-list')).toBeTruthy();
  });
});
