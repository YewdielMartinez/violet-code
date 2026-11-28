import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@yewdiel21/motion-kit/react';

import LoginPage from '@/features/auth/LoginPage';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/features/auth/demoAccounts';
import * as session from '@/shared/auth/session';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function openLogin() {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
}

describe('Login · acceso rápido de demostración', () => {
  it('no muestra los chips con la bandera apagada y fuera de desarrollo', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_DEMO_LOGIN', '');
    openLogin();
    expect(screen.queryByText('Acceso rápido para la demo')).toBeNull();
    expect(screen.queryByRole('button', { name: /cuenta de demostración/i })).toBeNull();
  });

  it('muestra un chip por rol con VITE_DEMO_LOGIN=true aunque no sea desarrollo', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_DEMO_LOGIN', 'true');
    openLogin();
    expect(screen.getByText('Acceso rápido para la demo')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /cuenta de demostración/i })).toHaveLength(DEMO_ACCOUNTS.length);
    expect(screen.getByRole('button', { name: 'Usar cuenta de demostración de Titular' })).toBeTruthy();
  });

  it('también se muestra en desarrollo sin la bandera', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DEMO_LOGIN', '');
    openLogin();
    expect(screen.getAllByRole('button', { name: /cuenta de demostración/i })).toHaveLength(DEMO_ACCOUNTS.length);
  });

  it('al pulsar un rol rellena correo y contraseña, marca el chip y no envía el formulario', () => {
    vi.stubEnv('VITE_DEMO_LOGIN', 'true');
    const login = vi.spyOn(session, 'login').mockResolvedValue(undefined as never);
    openLogin();

    const chip = screen.getByRole('button', { name: 'Usar cuenta de demostración de Trabajo Social' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);

    expect((document.querySelector('input[name="email"]') as HTMLInputElement).value).toBe('trabajo.social@demo.violetcode.local');
    expect((document.querySelector('input[name="password"]') as HTMLInputElement).value).toBe(DEMO_PASSWORD);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-demo-filled]').length).toBeGreaterThan(0);
    expect(login).not.toHaveBeenCalled();
    // El foco queda en el botón de envío para que la persona pulse «Entrar».
    expect(document.activeElement?.getAttribute('type')).toBe('submit');

    // Editar el correo apaga la selección.
    fireEvent.change(document.querySelector('input[name="email"]') as HTMLInputElement, { target: { value: 'otra@x.com' } });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });
});
