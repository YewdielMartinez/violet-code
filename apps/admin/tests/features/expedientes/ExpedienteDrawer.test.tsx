import { StrictMode, useRef, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Agresor } from '@/domain/models/Agresor';
import type { ExpedienteResumen } from '@/domain/models/Persona';
import { decorateExpedienteRows } from '@/features/expedientes/drawer/expedientesTableConfig';
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

vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    useCascade: undefined,
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

const SECOND_EXPEDIENTE: ExpedienteResumen = {
  id: '55555555-5555-4555-8555-555555555502',
  folio: 'SEM-2026-0002',
  estado: 'abierto',
  creadoEn: '2026-11-21T10:00:00Z',
  actualizadoEn: '2026-11-26T10:00:00Z',
  enListaUrgencias: false,
  persona: {
    id: '33333333-3333-4333-8333-333333333302',
    curp: 'LOPA880720MSLNRR09',
    nombres: 'Laura',
    apellidoPaterno: 'López',
    apellidoMaterno: 'Paredes',
    nombreCompleto: 'Laura López Paredes',
    sexo: 'M',
    fechaNacimiento: '1988-07-20',
    entidadNacimiento: 'SL',
    celular: null,
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
    expect(await screen.findByTestId('ficha-gestion')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar CURP' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('MEZA910315MSLGRN04');
      expect(toastMock).toHaveBeenCalledWith('CURP copiada al portapapeles.', { tone: 'success' });
    });
  });

  it('alterna el botón Expandir y oculta la zona de gestión cuando canManage es false', async () => {
    renderWithQuery(
      <ExpedienteDrawer expediente={SAMPLE_EXPEDIENTE} userRole="psicologia" canManage={false} onClose={vi.fn()} />,
    );

    await screen.findByTestId('ficha-resumen');
    expect(screen.queryByTestId('ficha-gestion')).toBeNull();

    const dialog = document.querySelector<HTMLDialogElement>('dialog.vc-expediente-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog!.hasAttribute('open')).toBe(true);

    const expandButton = screen.getByRole('button', { name: /Expandir/i });
    expect(expandButton.getAttribute('aria-pressed')).toBe('false');
    expect(dialog!.style.getPropertyValue('--vc-drawer-width')).toBe('680px');

    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', { name: /Contraer/i });
    expect(collapseButton.getAttribute('aria-pressed')).toBe('true');
    expect(dialog!.style.getPropertyValue('--vc-drawer-width')).toBe('960px');
  });

  it('abre, cierra completamente sin dejar cascarón y vuelve a abrir otro expediente de forma repetida', async () => {
    const expedientes = [SAMPLE_EXPEDIENTE, SECOND_EXPEDIENTE];

    function DrawerHarness() {
      const [searchParams, setSearchParams] = useSearchParams();
      const anchorRef = useRef<HTMLElement | null>(null);
      const selectedId = searchParams.get('expediente');
      const selected = expedientes.find((item) => item.id === selectedId) ?? null;

      function openRow(exp: ExpedienteResumen, el: HTMLElement) {
        anchorRef.current = el;
        setSearchParams({ expediente: exp.id }, { replace: true });
      }

      function closeRow() {
        anchorRef.current = null;
        setSearchParams({}, { replace: true });
      }

      return (
        <div>
          {expedientes.map((exp) => (
            <button
              key={exp.id}
              type="button"
              onClick={(event) => openRow(exp, event.currentTarget)}
            >
              Abrir {exp.folio}
            </button>
          ))}
          <button type="button" onClick={closeRow}>
            Quitar param URL
          </button>

          <ExpedienteDrawer
            expediente={selected}
            anchor={anchorRef}
            userRole="trabajo_social"
            canManage={false}
            onClose={closeRow}
          />
        </div>
      );
    }

    renderWithQuery(<DrawerHarness />);

    // El Dialog puede remontarse (reapertura durante el cierre), así que se consulta cada vez.
    const getDialog = () => document.querySelector<HTMLDialogElement>('dialog.vc-expediente-dialog');
    const dialog = { hasAttribute: (name: string) => getDialog()?.hasAttribute(name) ?? false };
    expect(getDialog()).not.toBeNull();
    expect(dialog!.hasAttribute('open')).toBe(false);

    // 1. Abrir primer expediente
    fireEvent.click(screen.getByRole('button', { name: 'Abrir SEM-2026-0001' }));
    await waitFor(() => {
      expect(dialog!.hasAttribute('open')).toBe(true);
    });
    expect(screen.getByRole('heading', { name: 'Adriana Meza Gutiérrez' })).toBeTruthy();

    // 2. Cerrar con el botón X nativo de Dialog.Close -> no debe quedar abierto ni con contenido
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(dialog!.hasAttribute('open')).toBe(false);
    });
    expect(screen.queryByRole('heading', { name: 'Adriana Meza Gutiérrez' })).toBeNull();

    // 3. Reabrir con el segundo expediente
    fireEvent.click(screen.getByRole('button', { name: 'Abrir SEM-2026-0002' }));
    await waitFor(() => {
      expect(dialog!.hasAttribute('open')).toBe(true);
    });
    expect(screen.getByRole('heading', { name: 'Laura López Paredes' })).toBeTruthy();
    expect(screen.getByText('SEM-2026-0002')).toBeTruthy();

    // 4. Cerrar quitando ?expediente de la URL (cierre controlado / botón Atrás)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar param URL' }));
    await waitFor(() => {
      expect(dialog!.hasAttribute('open')).toBe(false);
    });
    expect(screen.queryByRole('heading', { name: 'Laura López Paredes' })).toBeNull();

    // 5. Reabrir de nuevo y cerrar con evento cancel (Escape)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir SEM-2026-0001' }));
    await waitFor(() => {
      expect(dialog!.hasAttribute('open')).toBe(true);
    });
    fireEvent(getDialog()!, new Event('cancel', { cancelable: true }));
    await waitFor(() => {
      expect(dialog!.hasAttribute('open')).toBe(false);
    });
    expect(screen.queryByRole('heading', { name: 'Adriana Meza Gutiérrez' })).toBeNull();
  });

  it('monta el detalle de inmediato cuando prefers-reduced-motion está activo', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      renderWithQuery(
        <ExpedienteDrawer
          expediente={SAMPLE_EXPEDIENTE}
          userRole="trabajo_social"
          canManage={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId('ficha-resumen')).toBeTruthy();
      expect(screen.getByTestId('ficha-gestion')).toBeTruthy();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('drawer formatters y tabla', () => {
  it('decora filas de expedientes una sola vez sin duplicar envoltorios compartidos', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.dataset.id = SAMPLE_EXPEDIENTE.id;

    const tdFolio = document.createElement('td');
    tdFolio.dataset.key = 'folio';
    tdFolio.textContent = SAMPLE_EXPEDIENTE.folio;

    const tdNombre = document.createElement('td');
    tdNombre.dataset.key = 'nombreCompleto';
    tdNombre.textContent = SAMPLE_EXPEDIENTE.persona.nombreCompleto;

    tr.append(tdFolio, tdNombre);
    tbody.append(tr);
    table.append(tbody);

    decorateExpedienteRows(tbody);
    decorateExpedienteRows(tbody);

    expect(tr.tabIndex).toBe(0);
    expect(tr.dataset.vcDecorated).toBe('1');
    // Sin texto compartido: las celdas quedan intactas.
    expect(tdFolio.hasAttribute('data-mk-shared')).toBe(false);
    expect(tdNombre.textContent).toBe(SAMPLE_EXPEDIENTE.persona.nombreCompleto);
  });
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
