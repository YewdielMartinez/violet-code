import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiPerfil } from '@/domain/models/Perfil';

const { repo } = vi.hoisted(() => ({
  repo: {
    miPerfil: vi.fn(),
    actualizarMiPerfil: vi.fn(),
    cambiarContrasena: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    getUmecaCitas: vi.fn(),
  },
}));

vi.mock('@/infrastructure/supabase/adapters/SupabaseAuthRepository', () => ({
  supabaseAuthRepository: repo,
}));

// El kit real necesita layout/animación; aquí basta con una cáscara que, como el real, deja el contenido
// montado aunque el diálogo esté cerrado (por eso la sección debe cargar datos solo cuando `open`).
vi.mock('@yewdiel21/motion-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yewdiel21/motion-kit/react')>();
  return {
    ...actual,
    useDialog: () => ({ instance: { current: null } }),
    Dialog: {
      Root: ({ children }: { children: ReactNode }) => <div data-testid="dialog">{children}</div>,
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
      Close: () => <button type="button">Cerrar</button>,
      Body: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  };
});

import { SettingsDialog } from '@/features/settings/SettingsDialog';

const PERFIL: MiPerfil = {
  id: 'u-1',
  tipo: 'empleado',
  nombre: 'Claudia Trabajo Social',
  correo: 'ts@demo.violetcode.local',
  telefono: '6671234567',
  rol: 'trabajo_social',
  areaId: 1,
  areaClave: 'trabajo_social',
  areaNombre: 'Trabajo Social',
  dependencia: null,
  activo: true,
  permisos: ['agenda.ver', 'expediente.ver'],
  creadoEn: '2026-11-20T10:00:00Z',
};

function setReducedMotion() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
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

function renderDialog(open: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (isOpen: boolean) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsDialog open={isOpen} onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(ui(open));
  return { ...view, setOpen: (isOpen: boolean) => view.rerender(ui(isOpen)) };
}

describe('Configuración > Cuenta', () => {
  beforeEach(() => {
    setReducedMotion();
    Object.values(repo).forEach((fn) => fn.mockReset());
    repo.onAuthStateChange.mockImplementation(() => () => {});
    repo.miPerfil.mockResolvedValue(PERFIL);
    repo.logout.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('no pide el perfil mientras el diálogo está cerrado y lo carga al abrir', async () => {
    const { setOpen } = renderDialog(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(repo.miPerfil).not.toHaveBeenCalled();

    setOpen(true);
    expect(await screen.findByRole('heading', { name: 'Claudia Trabajo Social' })).toBeTruthy();
    expect(repo.miPerfil).toHaveBeenCalledTimes(1);
  });

  it('muestra el perfil en la pestaña Cuenta y permite cambiar a Seguridad', async () => {
    renderDialog(true);
    const contacto = await screen.findByRole('region', { name: 'Datos de contacto' });
    expect(within(contacto).getByText('667 123 4567')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Datos de la cuenta' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Contraseña' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Seguridad/ }));
    expect(await screen.findByText('Sesión protegida')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Datos de contacto' })).toBeNull();
  });

  it('edita el contacto dentro del diálogo y guarda con el RPC', async () => {
    repo.actualizarMiPerfil.mockResolvedValue({ nombre: 'Claudia Editada', telefono: '6671234567' });
    renderDialog(true);
    const contacto = await screen.findByRole('region', { name: 'Datos de contacto' });
    fireEvent.click(within(contacto).getByRole('button', { name: 'Editar datos de contacto' }));
    fireEvent.change(await within(contacto).findByLabelText(/Nombre completo/), { target: { value: 'Claudia Editada' } });
    fireEvent.click(within(contacto).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(repo.actualizarMiPerfil).toHaveBeenCalledWith({ nombre: 'Claudia Editada', telefono: '6671234567' }),
    );
  });

  it('valida la contraseña nueva sin llamar al servicio y Escape cancela solo el formulario', async () => {
    renderDialog(true);
    const seccion = await screen.findByRole('region', { name: 'Contraseña' });
    fireEvent.click(within(seccion).getByRole('button', { name: 'Cambiar contraseña' }));
    fireEvent.change(await within(seccion).findByLabelText('Contraseña actual'), { target: { value: 'Vieja1234' } });
    fireEvent.change(within(seccion).getByLabelText('Nueva contraseña'), { target: { value: 'corta1' } });
    fireEvent.change(within(seccion).getByLabelText('Confirmar nueva contraseña'), { target: { value: 'corta1' } });
    fireEvent.click(within(seccion).getByRole('button', { name: 'Guardar contraseña' }));
    expect((await within(seccion).findByRole('alert')).textContent).toMatch(/al menos 8 caracteres/);
    expect(repo.cambiarContrasena).not.toHaveBeenCalled();

    // DataSection hace preventDefault en Escape: el navegador no dispara `cancel` sobre el <dialog> del kit.
    const notPrevented = fireEvent.keyDown(within(seccion).getByLabelText('Contraseña actual'), { key: 'Escape' });
    expect(notPrevented).toBe(false);
    await waitFor(() => expect(within(seccion).queryByLabelText('Contraseña actual')).toBeNull());
  });

  it('«Cerrar sesión» desde Cuenta cierra la sesión', async () => {
    renderDialog(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(repo.logout).toHaveBeenCalled());
  });
});
