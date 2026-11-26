import { StrictMode, type CSSProperties, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Agresor } from '@/domain/models/Agresor';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import {
  calculateAge,
  formatFechaNacimiento,
  formatPhoneDisplay,
  formatSexo,
} from '@/features/expedientes/drawer/formatters';

const {
  listarPorFichaMock,
  registrarConsultaMock,
  listarParentescosMock,
  listarOcupacionesMock,
  listarAsentamientosMock,
  toastMock,
} = vi.hoisted(() => ({
  listarPorFichaMock: vi.fn(),
  registrarConsultaMock: vi.fn(),
  listarParentescosMock: vi.fn(),
  listarOcupacionesMock: vi.fn(),
  listarAsentamientosMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseAgresorRepository', () => ({
  supabaseAgresorRepository: {
    listarPorFicha: listarPorFichaMock,
    crear: vi.fn(),
    actualizar: vi.fn(),
    registrarConsulta: registrarConsultaMock,
    listarParentescos: listarParentescosMock,
    listarOcupaciones: listarOcupacionesMock,
    listarAsentamientosAhome: listarAsentamientosMock,
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

// La sección de agresor envuelve su lista en un Dialog.Root propio (el diálogo crece desde el botón);
// aquí se simula sin ocultar la lista, que el Dialog real siempre muestra.
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

vi.mock('@yewdiel21/motion-kit/react', () => ({
  useCascade: undefined,
  Dialog: {
    Root: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div data-testid="dialog-root">{children}</div> : null,
    Content: ({
      children,
      className,
      style,
    }: {
      children?: ReactNode;
      className?: string;
      style?: CSSProperties;
    }) => (
      <div data-testid="dialog-content" className={className} style={style}>
        {children}
      </div>
    ),
    Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
    Title: ({ children, className }: { children?: ReactNode; className?: string }) => (
      <h2 className={className}>{children}</h2>
    ),
    Close: ({ label }: { label?: string }) => (
      <button type="button" aria-label={label ?? 'Cerrar'}>
        {label ?? 'Cerrar'}
      </button>
    ),
    Body: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  },
  useDialog: () => ({
    open: true,
    setOpen: vi.fn(),
    instance: { current: null },
  }),
  useTabs: () => ({ current: null }),
  EmptyState: ({ title, description }: { title?: string; description?: string }) => (
    <div>
      <p>{title}</p>
      <p>{description}</p>
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
  }) => <input aria-label={label} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />,
  LoadingButton: ({ children, type }: { children?: ReactNode; type?: 'button' | 'submit' }) => (
    <button type={type}>{children}</button>
  ),
  toast: toastMock,
}));

import { ExpedienteDrawer } from '@/features/expedientes/ExpedienteDrawer';

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
  tieneConsumoDroga: true,
  drogas: ['marihuana'],
  especificacionDroga: null,
  especificacionArma: null,
  observaciones: 'Antecedentes registrados.',
  activo: true,
  actualizadoEn: '2026-11-25T10:00:00Z',
};

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '*', element: ui }]);
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  listarPorFichaMock.mockReset().mockResolvedValue([SAMPLE_AGRESOR]);
  registrarConsultaMock.mockReset().mockResolvedValue(undefined);
  listarParentescosMock.mockReset().mockResolvedValue([{ id: 1, clave: 'expareja', nombre: 'Expareja' }]);
  listarOcupacionesMock.mockReset().mockResolvedValue([{ id: 2, clave: 'empleada', nombre: 'Empleada(o)' }]);
  listarAsentamientosMock.mockReset().mockResolvedValue([]);
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ExpedienteDrawer (RBAC, rediseño y bitácora RF-05 / RF-22)', () => {
  it('no renderiza las pestañas Persona agresora ni Documentos para recepción y UMECA', () => {
    for (const role of ['recepcion', 'umeca'] as const) {
      cleanup();
      renderWithQuery(
        <ExpedienteDrawer expediente={SAMPLE_EXPEDIENTE} userRole={role} canManage={false} onClose={vi.fn()} />,
      );

      expect(screen.getByRole('tab', { name: /Datos/i })).toBeTruthy();
      expect(screen.queryByRole('tab', { name: /Persona agresora/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Documentos/i })).toBeNull();
    }
  });

  it('registra consulta de ficha una sola vez en StrictMode y consulta de agresor al editar', async () => {
    renderWithQuery(
      <ExpedienteDrawer expediente={SAMPLE_EXPEDIENTE} userRole="trabajo_social" canManage={false} onClose={vi.fn()} />,
    );

    const tabAgresor = screen.getByRole('tab', { name: /Persona agresora/i });
    expect(screen.getByRole('tab', { name: /Documentos/i })).toBeTruthy();
    expect(registrarConsultaMock).not.toHaveBeenCalled();

    fireEvent.click(tabAgresor);

    await waitFor(() => {
      expect(screen.getByText('Roberto Salazar Pineda')).toBeTruthy(); 
    });

    expect(registrarConsultaMock).toHaveBeenCalledTimes(1);
    expect(registrarConsultaMock).toHaveBeenCalledWith('ficha_registro', SAMPLE_EXPEDIENTE.id);

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));

    await waitFor(() => {
      expect(registrarConsultaMock).toHaveBeenCalledTimes(2);
    });
    expect(registrarConsultaMock).toHaveBeenNthCalledWith(2, 'agresor', SAMPLE_AGRESOR.id);
  });

  it('muestra la tarjeta hero con identidad, estado, contacto y acciones rápidas', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderWithQuery(
      <ExpedienteDrawer expediente={SAMPLE_EXPEDIENTE} userRole="trabajo_social" canManage={true} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Adriana Meza Gutiérrez' })).toBeTruthy();
    expect(screen.getByText('SEM-2026-0001')).toBeTruthy();
    expect(screen.getByText('Femenino')).toBeTruthy();
    const expectedAge = calculateAge(SAMPLE_EXPEDIENTE.persona.fechaNacimiento);
    expect(screen.getByText(`${expectedAge} años`)).toBeTruthy();
    expect(screen.getByText(formatFechaNacimiento(SAMPLE_EXPEDIENTE.persona.fechaNacimiento))).toBeTruthy();

    expect(screen.getByText('En seguimiento')).toBeTruthy();
    expect(screen.getByText('Prioritario')).toBeTruthy();
    expect(screen.getByText('MEZA910315MSLGRN04')).toBeTruthy();
    expect(screen.getByText('668 100 0001')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Llamar' }).getAttribute('href')).toBe('tel:6681000001');
    expect(screen.getByTestId('ficha-gestion')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar CURP' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('MEZA910315MSLGRN04');
      expect(toastMock).toHaveBeenCalledWith('CURP copiada al portapapeles.', { tone: 'success' });
    });
  });

  it('alterna el botón Expandir y oculta la zona de gestión cuando canManage es false', () => {
    renderWithQuery(
      <ExpedienteDrawer expediente={SAMPLE_EXPEDIENTE} userRole="psicologia" canManage={false} onClose={vi.fn()} />,
    );

    expect(screen.queryByTestId('ficha-gestion')).toBeNull();

    const expandButton = screen.getByRole('button', { name: /Expandir/i });
    expect(expandButton.getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByTestId('dialog-content').style as CSSStyleDeclaration).getPropertyValue('--vc-drawer-width')).toBe('680px');

    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', { name: /Contraer/i });
    expect(collapseButton.getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('dialog-content').style as CSSStyleDeclaration).getPropertyValue('--vc-drawer-width')).toBe('960px');
  });
});

describe('drawer formatters', () => {
  it('calcula edad y formatea sexo, fecha y teléfono sin desfase de zona horaria', () => {
    expect(calculateAge('1991-03-15', new Date(2026, 2, 14))).toBe(34);
    expect(calculateAge('1991-03-15', new Date(2026, 2, 15))).toBe(35);
    expect(calculateAge('invalida')).toBeNull();
    expect(formatSexo('M')).toBe('Femenino');
    expect(formatSexo('H')).toBe('Masculino');
    expect(formatPhoneDisplay('6681000001')).toBe('668 100 0001');
    expect(formatPhoneDisplay(null)).toBeNull();
    expect(formatFechaNacimiento('1991-03-15')).toMatch(/1991/);
  });
});
