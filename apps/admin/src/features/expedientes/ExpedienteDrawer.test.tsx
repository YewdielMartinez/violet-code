import { StrictMode, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Agresor } from '@/domain/models/Agresor';
import type { ExpedienteResumen } from '@/domain/models/Persona';

const {
  listarPorFichaMock,
  registrarConsultaMock,
  listarParentescosMock,
  listarOcupacionesMock,
  listarAsentamientosMock,
} = vi.hoisted(() => ({
  listarPorFichaMock: vi.fn(),
  registrarConsultaMock: vi.fn(),
  listarParentescosMock: vi.fn(),
  listarOcupacionesMock: vi.fn(),
  listarAsentamientosMock: vi.fn(),
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

vi.mock('./ficha/FichaDetalleResumen', () => ({
  FichaDetalleResumen: () => <div data-testid="ficha-resumen" />,
}));

vi.mock('./ficha/FichaGestionAcciones', () => ({
  FichaGestionAcciones: () => null,
}));

vi.mock('./DocumentosAdjuntosPanel', () => ({
  DocumentosAdjuntosPanel: () => <div data-testid="documentos-panel" />,
}));

vi.mock('@yewdiel21/motion-kit/react', () => ({
  Dialog: {
    Root: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div>{children}</div> : null,
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    Close: ({ label }: { label?: string }) => <button type="button">{label ?? 'Cerrar'}</button>,
    Body: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  },
  Drawer: {
    Root: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div data-testid="drawer-root">{children}</div> : null,
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
    Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    Close: ({ label }: { label?: string }) => <button type="button">{label ?? 'Cerrar'}</button>,
    Body: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  },
  EmptyState: ({ title, description }: { title?: string; description?: string }) => (
    <div>
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
  Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Select: ({ label, value, onChange }: { label?: string; value?: string; onChange?: (v: string) => void }) => (
    <input aria-label={label} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
  ),
  LoadingButton: ({ children, type }: { children?: ReactNode; type?: 'button' | 'submit' }) => (
    <button type={type}>{children}</button>
  ),
  toast: vi.fn(),
}));

import { ExpedienteDrawer } from './ExpedienteDrawer';

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
  utilizoArmaUObjeto: false,
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
});

afterEach(() => {
  cleanup();
});

describe('ExpedienteDrawer (RBAC y bitácora RF-05 / RF-22)', () => {
  it('no renderiza las pestañas Persona agresora ni Documentos para recepción y UMECA', () => {
    for (const role of ['recepcion', 'umeca'] as const) {
      cleanup();
      renderWithQuery(
        <ExpedienteDrawer expediente={SAMPLE_EXPEDIENTE} userRole={role} canManage={false} onClose={vi.fn()} />,
      );

      expect(screen.getByRole('tab', { name: /Resumen/i })).toBeTruthy();
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
});
