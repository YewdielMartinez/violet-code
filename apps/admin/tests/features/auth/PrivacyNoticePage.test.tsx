import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@yewdiel21/motion-kit/react';

import PrivacyNoticePage from '@/features/auth/PrivacyNoticePage';

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

afterEach(cleanup);

function renderAt(entries: Parameters<typeof MemoryRouter>[0]['initialEntries'], initialIndex?: number) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
        <Routes>
          <Route path="/login" element={<p>pantalla login</p>} />
          <Route path="/otra" element={<p>pantalla previa</p>} />
          <Route path="/aviso-de-privacidad" element={<PrivacyNoticePage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('PrivacyNoticePage', () => {
  it('muestra el logo de Ahome, el título y el texto completo del aviso', () => {
    renderAt(['/aviso-de-privacidad']);

    expect(screen.getByRole('heading', { level: 1, name: 'Aviso de privacidad' })).toBeTruthy();
    const logo = screen.getByAltText('Municipio de Ahome');
    expect(logo.getAttribute('src')).toBe('/logo-ahome.png');
    expect(screen.getByText(/Borrador para el prototipo/)).toBeTruthy();
    expect(screen.getByText(/exclusivamente para brindar atención, orientación y seguimiento/)).toBeTruthy();
    expect(screen.getByText(/bitácora de auditoría/)).toBeTruthy();
    expect(screen.getByText('datos sintéticos')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(3);
    // Es una página, no un diálogo.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ofrece el cambio de tema como en el login', () => {
    renderAt(['/aviso-de-privacidad']);
    expect(screen.getByRole('button', { name: /Cambiar a modo (claro|oscuro)/ })).toBeTruthy();
  });

  it('Volver regresa a la pantalla anterior cuando hay historial', () => {
    renderAt(['/otra', '/aviso-de-privacidad'], 1);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText('pantalla previa')).toBeTruthy();
  });

  it('Volver lleva a /login si se abrió directo (sin historial)', () => {
    renderAt(['/aviso-de-privacidad']);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText('pantalla login')).toBeTruthy();
  });
});

describe('PrivacyNoticeLink', () => {
  it('enlaza a la página (no abre un diálogo) y puede abrirse en otra pestaña', async () => {
    const { PrivacyNoticeLink } = await import('@/features/auth/PrivacyNoticeLink');
    render(
      <MemoryRouter>
        <PrivacyNoticeLink />
        <PrivacyNoticeLink newTab />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link', { name: 'Aviso de privacidad' });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/aviso-de-privacidad');
    expect(links[0].getAttribute('target')).toBeNull();
    expect(links[1].getAttribute('href')).toBe('/aviso-de-privacidad');
    expect(links[1].getAttribute('target')).toBe('_blank');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
