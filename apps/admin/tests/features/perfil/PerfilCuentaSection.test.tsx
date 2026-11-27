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

import { PerfilCuentaSection } from '@/features/perfil/PerfilCuentaSection';
import { login, sessionStore } from '@/shared/auth/session';

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
  permisos: ['agenda.crear', 'agenda.ver', 'expediente.escribir', 'expediente.ver', 'nota_psicologia.acceder'],
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

function renderPage(enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PerfilCuentaSection enabled={enabled} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function findSection(name: string) {
  return screen.findByRole('region', { name });
}

describe('PerfilCuentaSection', () => {
  beforeEach(() => {
    setReducedMotion();
    Object.values(repo).forEach((fn) => fn.mockReset());
    repo.onAuthStateChange.mockImplementation(() => () => {});
    repo.miPerfil.mockResolvedValue(PERFIL);
    repo.logout.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('muestra nombre, correo, rol, área, estado y teléfono', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Claudia Trabajo Social' })).toBeTruthy();
    const cuenta = await findSection('Datos de la cuenta');
    expect(within(cuenta).getByText('ts@demo.violetcode.local')).toBeTruthy();
    expect(within(cuenta).getByText('Rol')).toBeTruthy();
    expect(within(cuenta).getByText('Área')).toBeTruthy();
    expect(within(cuenta).getAllByText('Trabajo Social')).toHaveLength(2);
    expect(within(cuenta).getByText('Activa')).toBeTruthy();
    const contacto = await findSection('Datos de contacto');
    expect(within(contacto).getByText('667 123 4567')).toBeTruthy();
  });

  it('muestra los permisos plegados y los lista agrupados al pulsar «Ver permisos»', async () => {
    renderPage();
    expect(await screen.findByText('5 permisos activos en tu cuenta.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Expedientes' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Ver permisos' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Ocultar permisos' }).getAttribute('aria-expanded')).toBe('true');
    const expedientes = await screen.findByRole('group', { name: 'Expedientes' });
    expect(within(expedientes).getByText('Ver expedientes')).toBeTruthy();
    expect(within(expedientes).getByText('Crear y editar expedientes')).toBeTruthy();
    const agenda = screen.getByRole('group', { name: 'Agenda' });
    expect(within(agenda).getByText('Crear citas')).toBeTruthy();
    const notas = screen.getByRole('group', { name: 'Notas de psicología' });
    expect(within(notas).getByText('Notas privadas de Psicología')).toBeTruthy();
  });

  it('en UMECA muestra la dependencia y que no hay permisos operativos', async () => {
    repo.miPerfil.mockResolvedValue({
      ...PERFIL,
      tipo: 'externo',
      rol: 'umeca',
      areaId: null,
      areaClave: null,
      areaNombre: null,
      dependencia: 'umeca',
      permisos: [],
    });
    renderPage();
    const cuenta = await findSection('Datos de la cuenta');
    expect(within(cuenta).getByText('Dependencia')).toBeTruthy();
    expect(within(cuenta).getByText('UMECA')).toBeTruthy();
    expect(screen.getByText(/no tiene permisos operativos/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver permisos' })).toBeNull();
  });

  it('no pide el perfil mientras la sección no está habilitada', async () => {
    renderPage(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(repo.miPerfil).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Cargando perfil' })).toBeTruthy();
  });

  it('muestra un error con opción de reintentar si falla la carga', async () => {
    repo.miPerfil.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText('No se pudo cargar tu perfil')).toBeTruthy();
  });

  it('edita nombre y teléfono, guarda con el RPC y muestra «Guardado»', async () => {
    repo.actualizarMiPerfil.mockResolvedValue({ nombre: 'Claudia Editada', telefono: '6680001122' });
    renderPage();
    const contacto = await findSection('Datos de contacto');
    fireEvent.click(within(contacto).getByRole('button', { name: 'Editar datos de contacto' }));

    const nombre = await within(contacto).findByLabelText(/Nombre completo/);
    fireEvent.change(nombre, { target: { value: 'Claudia Editada' } });
    fireEvent.change(within(contacto).getByLabelText(/Teléfono/), { target: { value: '668 000 1122' } });
    fireEvent.click(within(contacto).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(repo.actualizarMiPerfil).toHaveBeenCalledWith({ nombre: 'Claudia Editada', telefono: '6680001122' }),
    );
    expect(await within(contacto).findByText('Guardado')).toBeTruthy();
  });

  it('no guarda un nombre vacío ni un teléfono incompleto y avisa en línea', async () => {
    renderPage();
    const contacto = await findSection('Datos de contacto');
    fireEvent.click(within(contacto).getByRole('button', { name: 'Editar datos de contacto' }));

    fireEvent.change(await within(contacto).findByLabelText(/Nombre completo/), { target: { value: '   ' } });
    fireEvent.click(within(contacto).getByRole('button', { name: 'Guardar cambios' }));
    expect((await within(contacto).findByRole('alert')).textContent).toMatch(/nombre completo/i);

    fireEvent.change(within(contacto).getByLabelText(/Nombre completo/), { target: { value: 'Ana' } });
    fireEvent.change(within(contacto).getByLabelText(/Teléfono/), { target: { value: '12345' } });
    fireEvent.click(within(contacto).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(within(contacto).getByRole('alert').textContent).toMatch(/10 dígitos/));
    expect(repo.actualizarMiPerfil).not.toHaveBeenCalled();
  });

  it('actualiza el nombre de la sesión (nav) tras guardar', async () => {
    repo.login.mockResolvedValue({
      accessToken: 't',
      expiresAt: '2030-01-01T00:00:00Z',
      user: {
        id: 'u-1',
        email: 'ts@demo.violetcode.local',
        displayName: 'Claudia Trabajo Social',
        role: 'trabajo_social',
        areaId: 1,
        areaClave: 'trabajo_social',
        areaNombre: 'Trabajo Social',
        activo: true,
      },
    });
    await login('ts@demo.violetcode.local', 'x');
    repo.actualizarMiPerfil.mockResolvedValue({ nombre: 'Claudia Editada', telefono: null });

    renderPage();
    const contacto = await findSection('Datos de contacto');
    fireEvent.click(within(contacto).getByRole('button', { name: 'Editar datos de contacto' }));
    fireEvent.change(await within(contacto).findByLabelText(/Nombre completo/), { target: { value: 'Claudia Editada' } });
    fireEvent.click(within(contacto).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(sessionStore.getSnapshot().session?.user.displayName).toBe('Claudia Editada'));
  });

  describe('cambio de contraseña', () => {
    async function openForm() {
      renderPage();
      const seccion = await findSection('Contraseña');
      fireEvent.click(within(seccion).getByRole('button', { name: 'Cambiar contraseña' }));
      await within(seccion).findByLabelText('Contraseña actual');
      return seccion;
    }

    function fill(seccion: HTMLElement, actual: string, nueva: string, confirmar: string) {
      fireEvent.change(within(seccion).getByLabelText('Contraseña actual'), { target: { value: actual } });
      fireEvent.change(within(seccion).getByLabelText('Nueva contraseña'), { target: { value: nueva } });
      fireEvent.change(within(seccion).getByLabelText('Confirmar nueva contraseña'), { target: { value: confirmar } });
      fireEvent.click(within(seccion).getByRole('button', { name: 'Guardar contraseña' }));
    }

    it('valida longitud, letras y números, igualdad y confirmación sin llamar al servicio', async () => {
      const seccion = await openForm();

      fill(seccion, 'Vieja1234', 'corta1', 'corta1');
      expect((await within(seccion).findByRole('alert')).textContent).toMatch(/al menos 8 caracteres/);

      fill(seccion, 'Vieja1234', 'sololetrasaqui', 'sololetrasaqui');
      await waitFor(() => expect(within(seccion).getByRole('alert').textContent).toMatch(/letras y números/));

      fill(seccion, 'Vieja1234', 'Nueva1234', 'Otra12345');
      await waitFor(() => expect(within(seccion).getByRole('alert').textContent).toMatch(/no coinciden/));

      fill(seccion, 'Vieja1234', 'Vieja1234', 'Vieja1234');
      await waitFor(() => expect(within(seccion).getByRole('alert').textContent).toMatch(/distinta/));

      expect(repo.cambiarContrasena).not.toHaveBeenCalled();
    });

    it('cambia la contraseña y muestra «Guardado»', async () => {
      repo.cambiarContrasena.mockResolvedValue(undefined);
      const seccion = await openForm();
      fill(seccion, 'Vieja1234', 'Nueva1234', 'Nueva1234');
      await waitFor(() => expect(repo.cambiarContrasena).toHaveBeenCalledWith('Vieja1234', 'Nueva1234'));
      expect(await within(seccion).findByText('Guardado')).toBeTruthy();
    });

    it('muestra el error cuando la contraseña actual es incorrecta', async () => {
      repo.cambiarContrasena.mockRejectedValue(new Error('La contraseña actual no es correcta.'));
      const seccion = await openForm();
      fill(seccion, 'Mala12345', 'Nueva1234', 'Nueva1234');
      expect((await within(seccion).findByRole('alert')).textContent).toBe('La contraseña actual no es correcta.');
    });
  });

  it('Escape dentro de un formulario en edición lo cancela y no sube al diálogo contenedor', async () => {
    const onKeyDown = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <div onKeyDown={(e) => onKeyDown(e.key)}>
            <PerfilCuentaSection />
          </div>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const contacto = await findSection('Datos de contacto');
    fireEvent.click(within(contacto).getByRole('button', { name: 'Editar datos de contacto' }));
    const nombre = await within(contacto).findByLabelText(/Nombre completo/);
    fireEvent.keyDown(nombre, { key: 'Escape' });
    expect(onKeyDown).not.toHaveBeenCalledWith('Escape');
    await waitFor(() => expect(within(contacto).queryByLabelText(/Nombre completo/)).toBeNull());
  });

  it('«Cerrar sesión» cierra la sesión', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(repo.logout).toHaveBeenCalled());
  });
});
